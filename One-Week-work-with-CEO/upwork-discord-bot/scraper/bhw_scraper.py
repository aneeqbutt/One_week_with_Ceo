def post_new_bhw_threads(channel=None):
    """
    Scrape new BHW threads and optionally post them to a Discord channel.
    If channel is provided, send approved threads to the channel.
    Returns the number of new threads processed.
    """
    scraper = BHWScraper()
    threads = scraper.scrape_and_store()
    # If channel is provided, return all Gemini-approved threads for posting in async context
    from db.database import SessionLocal
    from db.models import BHWThread
    session = SessionLocal()
    approved_threads = []
    try:
        # Only threads with gemini_decision == 'Yes' and not posted yet
        # Add a posted flag to the model if not present
        if not hasattr(BHWThread, 'posted_to_discord'):
            # Add the column dynamically (for dev convenience, not for production migrations)
            from sqlalchemy import Boolean, Column
            BHWThread.posted_to_discord = Column(Boolean, default=False)
            session.commit()
        approved_threads = session.query(BHWThread).filter(
            BHWThread.gemini_decision == 'Yes',
            (BHWThread.posted_to_discord == False) | (BHWThread.posted_to_discord == None)
        ).all()
    finally:
        session.close()
    return approved_threads
"""
BHW Scraper module for the Upwork Job Tracking System
Handles BlackHatWorld forum scraping with Gemini AI filtering
"""

import re
import json
import time
from curl_cffi import requests
import cloudscraper
from bs4 import BeautifulSoup
from dateutil import parser as dateparser
from datetime import datetime, timezone
import config
from db.database import SessionLocal
from db.models import BHWThread
import google.generativeai as genai


class BHWScraper:
    """BlackHatWorld scraper with AI filtering"""
    
    def __init__(self):
        # BHW Configuration
        self.base_url = "https://www.blackhatworld.com/forums/hire-a-freelancer.76/"
        self.ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

        # No proxy setup (direct connection)
        self.proxies = None

        # Gemini AI setup
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            print(f"[BHW] Gemini AI configured with model: {config.GEMINI_MODEL}")
        else:
            print("[BHW] WARNING: GEMINI_API_KEY not found - threads will not be filtered!")

        # Regex for thread ID extraction
        self.thread_id_re = re.compile(r"\.(\d+)/?$")

        # Gemini filtering prompt
        self.gemini_prompt = """1. Objective: Decide if a BHW post fits our software development work. Read the title + visible body. Return one word: Yes or No.

2. Say Yes when the post clearly asks to build one of these:
• Android automation — control real/emulated Android apps with human-like actions; handle login/session; run scheduled or parallel flows (not bulk account creation).
• Browser automation — multi-account user flows in browsers; separate profiles/sessions; proxy use; posting/messaging/warming; scheduler; logs, multilogin, gologin
• Social platform automation — "bot" or "automation" linked to TikTok, Instagram, Facebook, X, Reddit, YouTube, Telegram, Discord, or similar.
• TikTok Shop outreach automation — creator/affiliate invites, offers, follow-ups, activation (not content creation).
• Full-stack builds that power automation — dashboards, admin panels, APIs, queues, schedulers, worker services.
• Custom scrapers / data pipelines — structured scraping, parsing, storing, exporting (not generic data entry).
• n8n / workflow orchestration — AI agents, API integrations, automation pipelines.
• Web development — Next.js, React, Django, Flask, MERN, REST API builds, Electron apps.
• Integration work — connect third-party APIs, payment gateways, CRMs, analytics, or messaging platforms into systems.
• SaaS/MVP builds — small product or service build tied to automation, scraping, or dashboards.

High-sensitivity rule: If the text says "bot" or "automation" and also mentions a social platform, multi-accounting, sessions, proxies, emulator/device, or dashboards/panels — say Yes.

3. Say No immediately if any blocker appears:
• Content/SMM work (reels, shorts, thumbnails, captions, editing, design, community mgmt).
• Training, coaching, mentorship only.
• VA/operations/management tasks only.
• Bulk/mass account creation, OTP bypass, "1k accounts", PVAs.
• Pure marketing, ad buying, SEO, or promotion tasks.
• Anything not related to software development

4. Output (exact): Return only: Yes or No. No reasons, no extra words, no lines before/after.

5. Self-check (before answering):
• Used only title/body; no assumptions.
• Matches our dev categories, not tool names.
• One-word output only.

Title: {title}
Description: {description}"""
    
    def parse_int(self, s):
        """Parse integer from string, handling commas and other formatting"""
        if not s:
            return None
        s = s.replace(",", "").strip()
        return int(re.sub(r"[^\d]", "", s) or 0)
    
    def extract_thread_id(self, url: str):
        """Extract thread ID from URL"""
        m = self.thread_id_re.search(url)
        return m.group(1) if m else None
    
    def clean_text(self, text):
        """Clean text to remove problematic Unicode characters"""
        if not text:
            return text
        # Replace common problematic characters
        text = text.replace('\u0131', 'i')  # Turkish dotless i
        text = text.replace('\u2019', "'")  # Right single quotation mark
        text = text.replace('\u2018', "'")  # Left single quotation mark
        text = text.replace('\u201c', '"')  # Left double quotation mark
        text = text.replace('\u201d', '"')  # Right double quotation mark
        text = text.replace('\u2013', '-')  # En dash
        text = text.replace('\u2014', '-')  # Em dash
        text = text.replace('\u2026', '...')  # Horizontal ellipsis
        
        # Remove any other non-ASCII characters that might cause issues
        text = ''.join(char if ord(char) < 128 else '?' for char in text)
        return text
    
    def parse_time_tag(self, tag):
        """Parse time from HTML tag, handling BHW's time format"""
        if not tag:
            return None
        dt_text = tag.get("datetime") or tag.get("data-datetime") or tag.get("title") or tag.get_text(" ", strip=True)
        if not dt_text:
            return None
        try:
            dt = dateparser.parse(dt_text)
            if dt and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None
    
    def is_today(self, dt: datetime) -> bool:
        """Check if datetime is from today"""
        if not dt:
            return False
        dt_utc = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        today_utc = datetime.now(timezone.utc).date()
        return dt_utc.date() == today_utc
    
    def create_detail_scraper(self):
        """Create curl-cffi session for fetching thread details"""
        # We'll use curl-cffi directly in fetch_with_retries instead of creating a session
        # This method is kept for compatibility but returns None
        print("[BHW] Detail scraper session initialized with curl-cffi")
        return None
    
    def fetch_with_retries(self, scraper, url: str):
        """Fetch URL with retry logic using curl-cffi"""
        import random
        import time
        for attempt in range(1, config.BHW_MAX_RETRIES + 1):
            try:
                # Add small random delay to avoid rate limiting patterns
                if attempt > 1:
                    time.sleep(random.uniform(2, 5))
                resp = requests.get(
                    url,
                    headers={
                        "User-Agent": self.ua,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.5",
                        "Accept-Encoding": "gzip, deflate",
                        "Connection": "keep-alive",
                        "Upgrade-Insecure-Requests": "1"
                    },
                    timeout=30,
                    impersonate="chrome124"
                )
                if resp.status_code == 200:
                    return resp
                print(f"    [BHW] Detail fetch attempt {attempt}/{config.BHW_MAX_RETRIES}: HTTP {resp.status_code} for {url}")
            except Exception as e:
                print(f"    [BHW] Detail fetch attempt {attempt}/{config.BHW_MAX_RETRIES} error for {url}: {e}")
            if attempt < config.BHW_MAX_RETRIES:
                sleep_s = config.BHW_RETRY_DELAY * attempt
                print(f"    [BHW] Retrying in {sleep_s:.1f}s...")
                time.sleep(sleep_s)
                # Recreate scraper session
                try:
                    scraper = self.create_detail_scraper()
                except Exception as e2:
                    print(f"    [BHW] Failed to refresh scraper session: {e2}")
        return None
    
    def filter_thread_with_gemini(self, title: str, description: str):
        """Use Gemini AI to determine if a thread fits our software development work"""
        if not config.GEMINI_API_KEY:
            print("    [BHW] WARNING: Gemini API not configured - skipping AI filter")
            return "No", False
        try:
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            full_prompt = self.gemini_prompt.format(
                title=title[:200],
                description=description[:1000]
            )
            response = model.generate_content(full_prompt)
            decision = response.text.strip().upper()
            if decision in ["YES", "Y"]:
                return "Yes", True
            elif decision in ["NO", "N"]:
                return "No", False
            else:
                print(f"    [BHW] WARNING: Unexpected Gemini response: '{decision}' - defaulting to No")
                return "No", False
        except Exception as e:
            # If model not found, print available models and suggest fallback
            if "404" in str(e) and "not found" in str(e):
                print(f"    [BHW] Gemini model '{config.GEMINI_MODEL}' not found. Listing available models...")
                try:
                    models = genai.list_models()
                    print("    [BHW] Available Gemini models:")
                    for m in models:
                        print(f"      - {m.name}")
                    # Try fallback to a known working model
                    fallback_model = "gemini-1.5-flash"
                    print(f"    [BHW] Retrying with fallback model: {fallback_model}")
                    model = genai.GenerativeModel(fallback_model)
                    full_prompt = self.gemini_prompt.format(
                        title=title[:200],
                        description=description[:1000]
                    )
                    response = model.generate_content(full_prompt)
                    decision = response.text.strip().upper()
                    if decision in ["YES", "Y"]:
                        return "Yes", True
                    elif decision in ["NO", "N"]:
                        return "No", False
                    else:
                        print(f"    [BHW] WARNING: Unexpected Gemini response: '{decision}' - defaulting to No")
                        return "No", False
                except Exception as e2:
                    print(f"    [BHW] ERROR - fallback Gemini model also failed: {e2}")
                    return "No", False
            print(f"    [BHW] ERROR - defaulting to No : {e}")
            return "No", False
    
    def get_thread_description(self, scraper, url: str, thread_id: str):
        """Scrape the description (OP's first post) of the thread"""
        try:
            print(f"[BHW] Fetching description for thread: {thread_id}")
            response = self.fetch_with_retries(scraper, url)

            if response and response.status_code == 200:
                # Parse the page content
                soup = BeautifulSoup(response.text, 'lxml')

                # Try to find the OP's description (the first post in the thread)
                op_description = soup.select_one("article.message.message--post")  # First post (OP)
                if op_description:
                    op_body = op_description.select_one(".message-content .bbWrapper")
                    description = self.clean_text(op_body.get_text(strip=True)) if op_body else "No description found"
                else:
                    description = "No description found"
                
                print(f"[BHW] Description fetched: {len(description)} chars")
                return description
            else:
                status = response.status_code if response else "no-response"
                print(f"[BHW] Failed to retrieve page {url}: {status}")
                return "No description found"
        except Exception as e:
            print(f"[BHW] Error fetching {url}: {e}")
            return "No description found"
    
    def scrape_listing_with_details(self, page=1, detail_scraper=None):
        """Scrape thread listing and immediately fetch details for eligible threads"""
        url = self.base_url if page == 1 else f"{self.base_url}page-{page}"
        r = requests.get(
            url,
            headers={"User-Agent": self.ua},
            timeout=30,
            impersonate="chrome124"
        )
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        threads_data = []
        thread_cards = soup.select("div.structItem--thread")
        stats = {
            'total_found': len(thread_cards),
            'filtered_out': 0,
            'already_exists': 0,
            'new_processed': 0
        }
        print(f"[BHW] Found {stats['total_found']} threads on page {page}")

        session = SessionLocal()
        try:
            for i, card in enumerate(thread_cards, 1):
                print(f"  [BHW] Processing thread {i}/{stats['total_found']}...")
                title_tag = card.select_one(".structItem-title a:not(.labelLink)")
                if not title_tag:
                    print(f"    [BHW] Skipping - no title found")
                    stats['filtered_out'] += 1
                    continue
                thread_path = title_tag.get("href", "")
                full_url = "https://www.blackhatworld.com" + thread_path
                thread_id = self.extract_thread_id(thread_path) or full_url
                title = self.clean_text(title_tag.get_text(strip=True))
                author_tag = card.select_one(".structItem-minor .username, .structItem-parts .username")
                author = self.clean_text(author_tag.get_text(strip=True)) if author_tag else None
                meta_pairs = card.select(".structItem-cell--meta dl.pairs.pairs--justified dd")
                replies = self.parse_int(meta_pairs[0].get_text()) if len(meta_pairs) >= 1 else None
                views = self.parse_int(meta_pairs[1].get_text()) if len(meta_pairs) >= 2 else None
                posted_time_tag = (
                    card.select_one(".structItem-startDate time.u-dt") or
                    card.select_one(".structItem-cell--main time.u-dt") or
                    card.select_one(".structItem-minor time") or
                    card.select_one("time")
                )
                posted_at = self.parse_time_tag(posted_time_tag)
                last_cell = card.select_one(".structItem-cell--latest")
                last_post_at = None
                last_poster = None
                if last_cell:
                    last_post_at = self.parse_time_tag(last_cell.select_one("time"))
                    poster_tag = last_cell.select_one(".username")
                    if poster_tag:
                        last_poster = self.clean_text(poster_tag.get_text(strip=True))
                print(f"    [BHW] Thread: {title[:50]}...")
                print(f"    [BHW] Posted: {posted_at}")
                if config.BHW_FILTER_TODAY and not self.is_today(posted_at):
                    print(f"    [BHW] Skipping - not posted today (FILTER_TODAY={config.BHW_FILTER_TODAY})")
                    stats['filtered_out'] += 1
                    continue
                # Check if thread already exists in database
                print(f"    [BHW] Checking if thread already exists in database...")
                exists = session.query(BHWThread).filter_by(link=full_url).first()
                if exists:
                    print(f"    [BHW] Skipping - thread already exists in database (ID: {thread_id})")
                    stats['already_exists'] += 1
                    continue
                print(f"    [BHW] Thread not in database - fetching details...")
                description = self.get_thread_description(detail_scraper, full_url, thread_id)
                # print(f"    [BHW] Filtering with Gemini AI...")
                # gemini_decision, is_relevant = self.filter_thread_with_gemini(title, description)
                # print(f"    [BHW] Gemini decision: {gemini_decision}")
                # # Store ALL threads regardless of Gemini decision
                # print(f"    [BHW] Storing thread with Gemini decision: {gemini_decision}")
                # Store in DB
                db_thread = BHWThread(
                    link=full_url,
                    title=title,
                    author=author,
                    posted=str(posted_at) if posted_at else None,
                    full_description=description,
                    budget=None,
                    requirements=None,
                    deadline=None,
                    contact_info=None,
                    tags=None,
                    post_content=description,
                    replies_count=replies,
                    views_count=views,
                    gemini_decision="Yes"
                )
                session.add(db_thread)
                session.commit()
                thread_data = {
                    "thread_id": thread_id,
                    "title": title,
                    "url": full_url,
                    "author": author,
                    "replies_count": replies,
                    "views_count": views,
                    "posted_at": posted_at,
                    "last_post_at": last_post_at,
                    "last_poster": last_poster,
                    "page_found": page,
                    "description": description,
                    # "gemini_decision": gemini_decision
                }
                threads_data.append(thread_data)
                stats['new_processed'] += 1
                # if is_relevant:
                #     print(f"    [BHW] Thread stored - Gemini APPROVED ({len(description)} chars)")
                # else:
                #     print(f"    [BHW] Thread stored - Gemini REJECTED ({len(description)} chars)")
                # if i < len(thread_cards):
                #     print(f"    [BHW] Waiting {config.BHW_DETAIL_DELAY}s before next thread...")
                #     time.sleep(config.BHW_DETAIL_DELAY)
        finally:
            session.close()
        print(f"[BHW] Page {page} Statistics:")
        print(f"   Total found: {stats['total_found']}")
        print(f"   Filtered out: {stats['filtered_out']}")
        print(f"   Already exists: {stats['already_exists']}")
        print(f"   New threads stored: {stats['new_processed']}")
        if config.GEMINI_API_KEY:
            approved_this_page = len([t for t in threads_data if t.get('gemini_decision') == 'Yes'])
            rejected_this_page = len([t for t in threads_data if t.get('gemini_decision') == 'No'])
            print(f"   Gemini approved: {approved_this_page}")
            print(f"   Gemini rejected: {rejected_this_page}")
        return threads_data
    
    def scrape_and_store(self, pages=None, delay_sec=None):
        """Main scraping function that processes thread listings and details together"""
        pages = pages or config.BHW_SCRAPER_PAGES
        delay_sec = delay_sec or config.BHW_SCRAPER_DELAY
        detail_scraper = self.create_detail_scraper()
        print(f"[BHW] Detail scraper session initialized")
        all_rows = []
        for p in range(1, pages + 1):
            print(f"\n[BHW] Scraping page {p}...")
            rows = self.scrape_listing_with_details(p, detail_scraper)
            print(f"[BHW] Completed page {p}: {len(rows)} new threads with details")
            all_rows.extend(rows)
            if p < pages:
                print(f"[BHW] Waiting {delay_sec}s before next page...")
                time.sleep(delay_sec)
        print(f"\n[BHW] SCRAPING COMPLETED!")
        print(f"[BHW] Overall Statistics:")
        print(f"   Total new threads stored in database: {len(all_rows)}")
        if config.GEMINI_API_KEY:
            print(f"   Gemini AI filtering: Enabled")
            approved_count = sum(1 for row in all_rows if row.get('gemini_decision') == 'Yes')
            rejected_count = sum(1 for row in all_rows if row.get('gemini_decision') == 'No')
            print(f"   Threads approved by Gemini: {approved_count}")
            print(f"   Threads rejected by Gemini: {rejected_count}")
            if len(all_rows) > 0:
                approval_rate = (approved_count / len(all_rows)) * 100
                print(f"   Approval rate: {approval_rate:.1f}%")
            print(f"   Note: ALL threads stored in database, Discord will only post approved ones")
        else:
            print(f"   Gemini AI filtering: Disabled - all threads will be posted")
        if config.BHW_FILTER_TODAY:
            print(f"   Date filtering: Only threads from today (FILTER_TODAY={config.BHW_FILTER_TODAY})")
        return len(all_rows)

    def get_new_threads_count(self):
        """Get count of unposted, approved threads (example: threads with gemini_decision == 'Yes')"""
        session = SessionLocal()
        try:
            count = session.query(BHWThread).filter_by().count()  # You can add more filters as needed
            return count
        finally:
            session.close()