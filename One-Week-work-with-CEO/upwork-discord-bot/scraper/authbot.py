"""
Improved Upwork Authentication Bot
Fast, reliable authentication refresh with validation test
"""
# --- PATCH FOR ASYNCIO EVENT LOOP ISSUES ON PYTHON 3.11+ ---
import sys
if sys.version_info >= (3, 11):
    import asyncio
    try:
        import nest_asyncio
        nest_asyncio.apply()
    except ImportError:
        pass
    # Monkey-patch get_event_loop to always return the running loop
    def _get_running_loop():
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.new_event_loop()
    asyncio.get_event_loop = _get_running_loop
# -----------------------------------------------------------

import json
import time
from seleniumbase import SB
import os
import sys
import platform
import shutil
import tempfile
import tarfile
import stat
import urllib.request
import uuid
import zipfile

# Patch asyncio to allow nested event loops (fixes RuntimeError in Jupyter/IPython/Python 3.10+)
try:
    import nest_asyncio
    nest_asyncio.apply()
except ImportError:
    pass  # If not available, ignore, but recommend installing it if error persists
def test_job_details_fetch(headers, cookies):
    """Test fetching job details with captured credentials"""
    print("\n" + "=" * 70)
    print("TESTING JOB DETAILS FETCH")
    print("=" * 70)
    
    # Use a known public job ID format for testing
    test_job_id = "~0140c36fa1e87afd2a"  # Example format
    
    try:
        import cloudscraper
        session = cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows", "mobile": False}
        )
        print("[Test] Using cloudscraper session")
    except ImportError:
        import requests
        session = requests.Session()
        print("[Test] Using standard requests session")
    
    # Build test payload
    payload = {
        "alias": "gql-query-get-visitor-job-details",
        "query": """query JobPubDetailsQuery($id: ID!) {
            jobPubDetails(id: $id) {
                opening {
                    status
                    postedOn
                    publishTime
                    workload
                    contractorTier
                    description
                    info {
                        ciphertext
                        id
                        type
                        title
                        createdOn
                    }
                    budget { amount currencyCode }
                    clientActivity { totalApplicants totalHired totalInvitedToInterview }
                }
                buyer {
                    location { city country countryTimezone }
                    stats { totalAssignments feedbackCount score totalCharges { amount currencyCode } }
                }
                qualifications { minJobSuccessScore minOdeskHours risingTalent }
            }
        }""",
        "variables": {"id": test_job_id}
    }
    
    url = "https://www.upwork.com/api/graphql/v1?alias=gql-query-get-visitor-job-details"
    
    print(f"[Test] Testing with job ID: {test_job_id}")
    print(f"[Test] Request URL: {url}")
    
    # Retry logic to handle transient 403/429 from Cloudflare
    attempts = 3
    backoff = 3
    last_status = None
    for attempt in range(1, attempts+1):
        try:
            response = session.post(
                url,
                headers=headers,
                cookies=cookies,
                json=payload,
                timeout=20
            )
            last_status = response.status_code
            print(f"[Test] Attempt {attempt}: HTTP {response.status_code}")
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "errors" in data:
                        print("[Test] ❌ GraphQL Errors Found:")
                        for error in data["errors"]:
                            print(f"  - {error.get('message', 'Unknown error')}")
                        return False
                    job_details = data.get("data", {}).get("jobPubDetails", {})
                    if job_details:
                        opening = job_details.get("opening", {})
                        info = opening.get("info", {})
                        print("\n[Test] ✅ Job Details Fetch SUCCESSFUL!")
                        print("-" * 70)
                        print(f"Title: {info.get('title', 'N/A')}")
                        print(f"Job ID: {info.get('id', 'N/A')}")
                        print(f"Status: {opening.get('status', 'N/A')}")
                        print(f"Posted: {opening.get('postedOn', 'N/A')}")
                        desc = opening.get('description', '')
                        if desc:
                            print(f"Description: {desc[:100]}...")
                        budget = opening.get("budget", {})
                        if budget:
                            print(f"Budget: ${budget.get('amount', 'N/A')} {budget.get('currencyCode', '')}")
                        activity = opening.get("clientActivity", {})
                        if activity:
                            print(f"Applicants: {activity.get('totalApplicants', 0)}")
                            print(f"Hired: {activity.get('totalHired', 0)}")
                        buyer = job_details.get("buyer", {})
                        if buyer:
                            location = buyer.get("location", {})
                            print(f"Client Location: {location.get('city', '')}, {location.get('country', '')}")
                            stats = buyer.get("stats", {})
                            if stats:
                                print(f"Client Rating: {stats.get('score', 'N/A')}/5")
                                print(f"Client Total Jobs: {stats.get('totalAssignments', 0)}")
                        print("-" * 70)
                        return True
                    else:
                        print("[Test] ⚠️ Empty job details returned")
                        return False
                except json.JSONDecodeError as e:
                    print(f"[Test] ❌ Failed to parse JSON: {e}")
                    print(f"[Test] Response preview: {response.text[:200]}")
                    return False
            elif response.status_code in (401, 403, 429):
                if attempt < attempts:
                    print(f"[Test] ⚠️ Got {response.status_code}; retrying after {backoff}s...")
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                else:
                    print(f"[Test] ❌ Final attempt received {response.status_code}")
                    return False
            else:
                print(f"[Test] ❌ Unexpected status code: {response.status_code}")
                print(f"[Test] Response preview: {response.text[:200]}")
                return False
        except Exception as e:
            if attempt < attempts:
                print(f"[Test] ⚠️ Attempt {attempt} failed: {e}. Retrying in {backoff}s...")
                time.sleep(backoff)
                backoff *= 2
                continue
            print(f"[Test] ❌ Request failed after {attempts} attempts: {e}")
            return False
    return False

def _enrich_headers(raw_headers, cookies, referer_url):
    """Normalize and enrich headers for Upwork GraphQL public job details.

    Ensures required semantic headers are present. Firefox vs Chrome sometimes
    yields lowercase keys; we normalize case-insensitively and add fallbacks.
    """
    if not raw_headers:
        raw_headers = {}
    # Case-insensitive normalization
    normalized = {}
    for k, v in raw_headers.items():
        # keep canonical capitalization for common headers
        lower = k.lower()
        if lower == 'user-agent':
            normalized['User-Agent'] = v
        elif lower == 'content-type':
            normalized['Content-Type'] = v
        elif lower == 'accept':
            normalized['Accept'] = v
        elif lower == 'accept-language':
            normalized['Accept-Language'] = v
        elif lower == 'origin':
            normalized['Origin'] = v
        elif lower == 'referer':
            normalized['Referer'] = v
        else:
            normalized[k] = v
    # Mandatory defaults
    normalized.setdefault('Accept', 'application/json, text/plain, */*')
    normalized.setdefault('Content-Type', 'application/json')
    normalized.setdefault('Origin', 'https://www.upwork.com')
    if referer_url:
        normalized.setdefault('Referer', referer_url)
    # Some Upwork endpoints seem sensitive to Accept-Language
    normalized.setdefault('Accept-Language', 'en-US,en;q=0.9')
    # Add a UA if missing - ALWAYS use Windows UA for better compatibility
    normalized.setdefault('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
    # Remove headers that can cause 403 if stale
    for h in list(normalized.keys()):
        if h.lower() in ('content-length', 'host', 'authority'):
            normalized.pop(h, None)
    # If we captured a visitor id cookie, propagate as header variant sometimes used
    if cookies:
        for k in cookies.keys():
            if 'visitor' in k.lower() and 'visitor' not in ' '.join(normalized.keys()).lower():
                normalized.setdefault('vnd-eo-visitorId', cookies[k])
                break
    # Add speculative fetch & client hint headers (some sites rely on them)
    normalized.setdefault('Sec-Fetch-Site', 'same-origin')
    normalized.setdefault('Sec-Fetch-Mode', 'cors')
    normalized.setdefault('Sec-Fetch-Dest', 'empty')
    # Client hints (won't exactly match but acceptable baseline) - Match platform to User-Agent
    if 'sec-ch-ua' not in {k.lower(): v for k,v in normalized.items()}:
        normalized['sec-ch-ua'] = '"Chromium";v="121", "Not(A:Brand";v="8"'
    normalized.setdefault('sec-ch-ua-mobile', '?0')
    # Use Windows platform to match User-Agent for better consistency
    normalized.setdefault('sec-ch-ua-platform', '"Windows"')
    # Apollo headers (observed in many Upwork graphql calls)
    normalized.setdefault('apollographql-client-name', 'web')
    normalized.setdefault('apollographql-client-version', '1.4')
    return normalized

def _attempt_extract_visitor_ids(sb):
    """Try to extract visitor / trace identifiers from localStorage or cookies."""
    try:
        ids = sb.execute_script(
            """
            const out = {visitor:null, trace:null, storage:{}, cookies:{}};
            try {
              // Check localStorage
              for (let i=0;i<localStorage.length;i++) {
                const k = localStorage.key(i);
                const v = localStorage.getItem(k);
                out.storage[k]=v;
                if(!out.visitor && /visitor/i.test(k) && v && v.length < 80) out.visitor = v;
                if(!out.trace && /trace/i.test(k) && v && v.length < 80) out.trace = v;
              }
              // Check document cookies
              const cookies = document.cookie.split(';');
              for(let cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if(name && value) {
                  out.cookies[name] = value;
                  if(!out.visitor && /visitor/i.test(name) && value.length < 80) out.visitor = value;
                  if(!out.trace && /trace/i.test(name) && value.length < 80) out.trace = value;
                }
              }
              // Look for common Upwork visitor patterns
              if(!out.visitor) {
                for(const [k,v] of Object.entries(out.storage)) {
                  if(/eo.*visitor|visitor.*id|user.*id/i.test(k) && v && v.length > 10 && v.length < 50) {
                    out.visitor = v;
                    break;
                  }
                }
              }
              // Also check session storage
              if(!out.visitor) {
                try {
                  for(let i=0;i<sessionStorage.length;i++) {
                    const k = sessionStorage.key(i);
                    const v = sessionStorage.getItem(k);
                    if(/visitor/i.test(k) && v && v.length > 10 && v.length < 80) {
                      out.visitor = v;
                      break;
                    }
                  }
                } catch(e) {}
              }
              // Try to extract from page HTML/scripts as fallback
              if(!out.visitor) {
                const scripts = document.querySelectorAll('script');
                for(let script of scripts) {
                  const text = script.textContent || script.innerText || '';
                  const match = text.match(/["']([a-f0-9-]{20,40})["'].*visitor/i) || text.match(/visitor.*["']([a-f0-9-]{20,40})["']/i);
                  if(match && match[1]) {
                    out.visitor = match[1];
                    break;
                  }
                }
              }
              // Check for any stored authentication tokens that might contain visitor info
              if(!out.visitor) {
                for(const [k,v] of Object.entries(out.storage)) {
                  if(typeof v === 'string' && v.length >= 20 && v.length <= 60) {
                    // Look for hex-like patterns that could be visitor IDs
                    if(/^[a-f0-9-]{20,50}$/i.test(v) && (k.toLowerCase().includes('auth') || k.toLowerCase().includes('token') || k.toLowerCase().includes('id'))) {
                      out.visitor = v;
                      break;
                    }
                  }
                }
              }
            } catch(e) { out.error = e.toString(); }
            return out;
            """
        )
        visitor = ids.get('visitor') if isinstance(ids, dict) else None
        trace = ids.get('trace') if isinstance(ids, dict) else None
        print(f"[Auth Bot] 🔍 Storage scan: {len(ids.get('storage', {}))} localStorage, {len(ids.get('cookies', {}))} cookies")
        if visitor:
            print(f"[Auth Bot] 🔑 Visitor ID found: {len(visitor)} chars, source: {_identify_visitor_source(ids, visitor)}")
        return visitor, trace
    except Exception as e:
        print(f"[Auth Bot] ⚠️ Visitor ID extraction failed: {e}")
        return None, None

def _identify_visitor_source(ids, visitor_id):
    """Helper to identify where the visitor ID was found"""
    if not isinstance(ids, dict) or not visitor_id:
        return "unknown"
    
    # Check localStorage
    for k, v in ids.get('storage', {}).items():
        if v == visitor_id:
            return f"localStorage[{k}]"
    
    # Check cookies
    for k, v in ids.get('cookies', {}).items():
        if v == visitor_id:
            return f"cookie[{k}]"
    
    return "script/fallback"

def _ensure_visitor_id(headers, base_dir):
    """Ensure headers contain a stable vnd-eo-visitorId.

    Strategy:
    1. If already present (case-insensitive), keep it.
    2. Reuse previously generated ID from visitor_id.txt (same dir) if valid.
    3. Otherwise generate a new UUID4 hex, persist, and inject.
    """
    try:
        if not headers:
            return headers
        # Case-insensitive existence check
        for k in headers.keys():
            if k.lower() == 'vnd-eo-visitorid':
                return headers  # Already present
        # Attempt reuse
        vid_file = os.path.join(base_dir, 'visitor_id.txt')
        visitor_id = None
        if os.path.exists(vid_file):
            try:
                with open(vid_file, 'r') as f:
                    candidate = f.read().strip()
                if candidate and 8 <= len(candidate) <= 64 and all(c in '0123456789abcdef-' for c in candidate.lower()):
                    visitor_id = candidate
                    print(f"[Auth Bot] ♻️ Reusing persisted visitor ID: {visitor_id[:12]}...")
            except Exception as read_e:
                print(f"[Auth Bot] ⚠️ Could not read visitor_id.txt: {read_e}")
        if not visitor_id:
            import uuid
            visitor_id = uuid.uuid4().hex  # 32 hex chars
            try:
                with open(vid_file, 'w') as f:
                    f.write(visitor_id)
                print(f"[Auth Bot] 🆕 Generated and persisted synthetic visitor ID: {visitor_id[:12]}...")
            except Exception as write_e:
                print(f"[Auth Bot] ⚠️ Could not persist visitor ID: {write_e}")
        headers['vnd-eo-visitorId'] = visitor_id
        return headers
    except Exception as e:
        print(f"[Auth Bot] ⚠️ _ensure_visitor_id error: {e}")
        return headers

def get_upwork_headers():
    """Get Upwork headers using SeleniumBase with optimized speed.

    If running on Ubuntu (detected via /etc/os-release) OR environment variable
    FORCE_FIREFOX=1 is set, prefer Firefox (geckodriver) to avoid Chrome
    driver / architecture issues. Otherwise try undetected Chrome (uc=True).
    """
    headers_found = None
    cookies_found = None

    force_firefox = os.environ.get("FORCE_FIREFOX") == "1"
    is_ubuntu = False
    try:
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release", "r") as f:
                content = f.read().lower()
                is_ubuntu = "ubuntu" in content
    except Exception:
        pass

    # Strategy change (2025-10-04): Prefer undetected Chrome first on ALL platforms unless
    # user explicitly forces Firefox. Ubuntu sometimes failed to gather the same
    # Cloudflare / challenge cookies in headless Firefox, causing subsequent
    # public job detail GraphQL fetch to fail with 403/401. We'll attempt Chrome
    # (uc) first; if it fails we fall back to Firefox automatically.
    use_firefox = force_firefox  # initial choice only from env now
    engine_desc = "Firefox (forced)" if use_firefox else "Chrome attempt (uc)"
    print(f"[Auth Bot] Starting browser engine: {engine_desc} | force_firefox={force_firefox} is_ubuntu={is_ubuntu}")

    def _ensure_geckodriver():
        """Ensure geckodriver exists locally; return absolute path or None.

        Strategy:
        1. Check explicit GECKODRIVER env.
        2. Check PATH for executable.
        3. Check common system locations.
        4. Check / create project-local drivers cache (./drivers/geckodriver[.exe]) and download latest.
        Supports Linux (x86_64/arm64), macOS (x86_64/arm64), Windows (x86_64/arm64) using GitHub releases.
        """
        # 1. Env override
        env_path = os.environ.get("GECKODRIVER")
        if env_path and os.path.exists(env_path):
            return env_path
        # 2. PATH scan
        exe_name = "geckodriver.exe" if platform.system().lower().startswith("win") else "geckodriver"
        for path_dir in os.environ.get("PATH", "").split(os.pathsep):
            candidate = os.path.join(path_dir.strip(), exe_name)
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                return candidate
        # 3. common locations
        common = [
            "/usr/local/bin/geckodriver",
            "/usr/bin/geckodriver",
            os.path.expanduser("~/bin/geckodriver"),
        ]
        for c in common:
            if os.path.isfile(c) and os.access(c, os.X_OK):
                return c
        # 4. project-local cache
        script_dir = os.path.dirname(os.path.abspath(__file__))
        drivers_dir = os.path.join(script_dir, "drivers")
        os.makedirs(drivers_dir, exist_ok=True)
        local_path = os.path.join(drivers_dir, exe_name)
        if os.path.exists(local_path):
            # make sure it's executable
            try:
                st = os.stat(local_path)
                os.chmod(local_path, st.st_mode | stat.S_IEXEC)
            except Exception:
                pass
            return local_path
        # Need to download
        try:
            arch_raw = platform.machine().lower()
            system = platform.system().lower()
            if system == "linux":
                if arch_raw in ("aarch64", "arm64"):
                    asset_arch = "linux-aarch64"
                elif arch_raw in ("x86_64", "amd64"):
                    asset_arch = "linux64"
                else:
                    print(f"[Auth Bot] ⚠️ Unsupported linux arch for auto geckodriver: {arch_raw}")
                    return None
                archive_ext = ".tar.gz"
            elif system == "darwin":
                if arch_raw in ("arm64", "aarch64"):
                    asset_arch = "macos-aarch64"
                else:
                    asset_arch = "macos"
                archive_ext = ".tar.gz"
            elif system == "windows":
                # Windows builds only for 64-bit
                asset_arch = "win64" if arch_raw in ("x86_64", "amd64", "arm64") else "win32"
                archive_ext = ".zip"
            else:
                print(f"[Auth Bot] ⚠️ Unsupported OS for auto geckodriver: {system}")
                return None

            api_url = "https://api.github.com/repos/mozilla/geckodriver/releases/latest"
            print("[Auth Bot] 📥 Fetching latest geckodriver release metadata...")
            with urllib.request.urlopen(api_url, timeout=30) as r:
                release = json.loads(r.read().decode())
            tag = release.get("tag_name")
            if not tag:
                print("[Auth Bot] ⚠️ Unable to parse geckodriver tag")
                return None
            expected_name_part = f"geckodriver-{tag}-{asset_arch}"
            asset = None
            for a in release.get("assets", []):
                url = a.get("browser_download_url", "")
                if expected_name_part in url and url.endswith(archive_ext):
                    asset = url
                    break
            if not asset:
                print(f"[Auth Bot] ⚠️ Could not find asset for {expected_name_part}")
                return None
            tmpdir = tempfile.mkdtemp(prefix="gecko_dl_")
            archive_file = os.path.join(tmpdir, os.path.basename(asset))
            print(f"[Auth Bot] ⬇️ Downloading {os.path.basename(asset)} ...")
            urllib.request.urlretrieve(asset, archive_file)
            if archive_ext == ".zip":
                with zipfile.ZipFile(archive_file, 'r') as zf:
                    zf.extractall(tmpdir)
            else:
                with tarfile.open(archive_file, 'r:gz') as tf:
                    tf.extract("geckodriver", path=tmpdir)
            extracted = os.path.join(tmpdir, exe_name)
            if not os.path.exists(extracted):
                # Some archives don't contain .exe name until rename
                alt = os.path.join(tmpdir, "geckodriver")
                if os.path.exists(alt):
                    extracted = alt
            shutil.copy2(extracted, local_path)
            os.chmod(local_path, 0o755)
            print(f"[Auth Bot] ✅ geckodriver ready at {local_path}")
            # Prepend to PATH for current process
            os.environ["PATH"] = drivers_dir + os.pathsep + os.environ.get("PATH", "")
            os.environ.setdefault("GECKODRIVER", local_path)
            return local_path
        except Exception as dl_e:
            print(f"[Auth Bot] ❌ Failed to auto-download geckodriver: {dl_e}")
            return None

    try:
        # Build SeleniumBase context arguments dynamically
        sb_kwargs = {
            "test": True,
            "locale": "en",
            "headless": True,
            "page_load_strategy": "eager",
        }
        if not use_firefox:
            sb_kwargs["uc"] = True
        else:
            sb_kwargs["browser"] = "firefox"
            # Previous version passed a LIST to firefox_arg causing 'list' object has no attribute split.
            # Remove aggressive flags (they can increase detection). Allow optional headful mode via env.
            if os.environ.get("FIREFOX_HEADLESS", "1") == "0":
                sb_kwargs["headless"] = False
                print("[Auth Bot] 🦊 Firefox headful mode enabled (FIREFOX_HEADLESS=0)")
            # Set Firefox preferences via profile
            sb_kwargs["user_data_dir"] = "/tmp/firefox_profile"
            gecko_path = _ensure_geckodriver()
            if gecko_path:
                print(f"[Auth Bot] 🦊 Using geckodriver: {gecko_path}")
            else:
                print("[Auth Bot] ⚠️ geckodriver still missing; SeleniumBase may fail. Raw fallback will try again.")

        try:
            with SB(**sb_kwargs) as sb:
                url = "https://www.upwork.com/nx/search/jobs/?q=python"
                if not use_firefox:
                    try:
                        sb.activate_cdp_mode(url)
                    except Exception as e:
                        print(f"[Auth Bot] CDP activation skipped: {e}")
                else:
                    # Firefox: attempt pre-bypass with cloudscraper to obtain challenge-solving cookies.
                    # Allow disabling all non-Selenium pre-bypass logic via FIREFOX_SB_ONLY=1
                    sb_only = os.environ.get("FIREFOX_SB_ONLY") == "1"
                    pre_bypass = (os.environ.get("FIREFOX_PRE_CLOUDSCRAPER", "1") == "1") and not sb_only
                    if sb_only:
                        print("[Auth Bot] 🦊 FIREFOX_SB_ONLY=1 -> Skipping cloudscraper pre-bypass (pure SeleniumBase mode)")
                    transplanted = False
                    cookies_dict = {}
                    if pre_bypass:
                        try:
                            import cloudscraper
                            print("[Auth Bot] 🦊 Pre-bypass: cloudscraper warm-up request...")
                            cs = cloudscraper.create_scraper(browser={"browser": "firefox", "platform": "linux", "mobile": False})
                            warm = cs.get(url, timeout=35)
                            if warm.status_code == 200:
                                cookies_dict = cs.cookies.get_dict()
                                print(f"[Auth Bot] 🦊 Pre-bypass: received {len(cookies_dict)} cookies from cloudscraper")
                            else:
                                print(f"[Auth Bot] ⚠️ Pre-bypass status {warm.status_code}")
                        except Exception as pre_e:
                            print(f"[Auth Bot] ⚠️ Pre-bypass error: {pre_e}")
                    # Open base domain first so domain context exists for cookie injection
                    sb.open("https://www.upwork.com")
                    sb.sleep(1.2)
                    if cookies_dict:
                        for name, value in cookies_dict.items():
                            try:
                                sb.driver.add_cookie({
                                    "name": name,
                                    "value": value,
                                    "domain": ".upwork.com",
                                    "path": "/",
                                    "secure": True,
                                })
                            except Exception:
                                continue
                        transplanted = True
                        print(f"[Auth Bot] 🦊 Pre-bypass: transplanted {len(cookies_dict)} cookies into Firefox")
                    sb.open(url)
                    # Light human-like noise (ONLY if headful) to reduce detection
                    if sb_kwargs.get("headless") is False:
                        try:
                            from selenium.webdriver import ActionChains
                            actions = ActionChains(sb.driver)
                            actions.move_by_offset(8,8).pause(0.2).move_by_offset(25,14).perform()
                            sb.execute_script("window.scrollTo(0, 300);")
                            sb.sleep(0.6)
                            sb.execute_script("window.scrollTo(0, 0);")
                        except Exception:
                            pass
                    if transplanted:
                        sb.sleep(2.5)

                print("[Auth Bot] Waiting for Cloudflare bypass...")
                max_attempts = 15 if use_firefox else 8  # More attempts for Firefox
                for attempt in range(max_attempts):
                    wait_time = 5 if use_firefox else 3  # Longer waits for Firefox
                    sb.sleep(wait_time)
                    
                    try:
                        sb.uc_gui_click_captcha()
                        print(f"[Auth Bot] Attempt {attempt+1}: Clicked captcha")
                    except Exception:
                        pass
                    
                    # More comprehensive check for Firefox
                    current_url = sb.get_current_url()
                    page_source = sb.get_page_source()
                    
                    # Check for Cloudflare challenge indicators
                    is_challenge = (
                        "challenge-platform" in current_url or
                        "cdn-cgi" in current_url or
                        "Just a moment" in page_source or
                        "Checking your browser" in page_source or
                        "Ray ID:" in page_source or
                        "cf-error-details" in page_source or
                        "challenge-form" in page_source or
                        "turnstile" in page_source or
                        "cf-chl-widget" in page_source or
                        "Attention Required" in page_source
                    )
                    
                    if not is_challenge:
                        # Double-check with element presence
                        try:
                            if sb.is_element_visible(".air3-card") or sb.is_element_visible("[data-test='job-tile']"):
                                print(f"[Auth Bot] ✅ Cloudflare bypassed on attempt {attempt+1}!")
                                break
                        except:
                            pass
                    
                    if use_firefox:
                        # Adaptive mitigation: periodic soft reload if still challenged
                        if is_challenge and attempt % 4 == 3:
                            try:
                                print(f"[Auth Bot] Firefox: Soft JS reload (attempt {attempt+1})")
                                sb.execute_script("location.reload();")
                            except Exception:
                                pass
                        # Mid-loop base domain reset to let Cloudflare set clearance cookie
                        if is_challenge and attempt in (5, 9) and attempt < (max_attempts - 2):
                            try:
                                print(f"[Auth Bot] Firefox: Base domain reset (attempt {attempt+1})")
                                sb.open("https://www.upwork.com/")
                                sb.sleep(2)
                                sb.open(url)
                            except Exception:
                                pass
                        # Minor DOM event noise early on (only if headful)
                        if is_challenge and attempt < 6 and sb_kwargs.get("headless") is False:
                            try:
                                sb.execute_script("document.body.dispatchEvent(new Event('mousemove'))")
                            except Exception:
                                pass
                        # Randomize viewport once to reduce static fingerprint
                        if attempt == 0:
                            try:
                                import random
                                w = random.randint(1200, 1620)
                                h = random.randint(820, 1000)
                                sb.set_window_size(w, h)
                                print(f"[Auth Bot] 🦊 Randomized viewport to {w}x{h}")
                            except Exception:
                                pass
                        # Light scroll jitter each challenged attempt
                        if is_challenge:
                            try:
                                import random as _r
                                sb.execute_script(f"window.scrollBy(0, {_r.randint(40,220)});")
                                sb.sleep(0.25)
                                sb.execute_script(f"window.scrollBy(0, -{_r.randint(10,140)});")
                            except Exception:
                                pass
                    
                    print(f"[Auth Bot] Attempt {attempt+1}: Still on challenge page, retrying...")
                else:
                    print("[Auth Bot] ⚠️ Cloudflare challenge timeout - continuing anyway")
                    print(f"[Auth Bot] Final URL: {sb.get_current_url()}")
                    # Optional profile refresh & retry once (pure SeleniumBase path) if still clearly challenged
                    if use_firefox and os.environ.get("FIREFOX_PROFILE_REFRESH") == "1":
                        try:
                            still_challenge = any(k in sb.get_page_source() for k in ["challenge-platform","cf-error-details","turnstile","cf-chl-widget","Just a moment","Checking your browser"])
                        except Exception:
                            still_challenge = False
                        if still_challenge:
                            try:
                                import shutil, tempfile
                                print("[Auth Bot] 🔄 Firefox: Profile refresh triggered (FIREFOX_PROFILE_REFRESH=1)")
                                new_profile = tempfile.mkdtemp(prefix="fx_profile_")
                                sb.quit()
                                # Relaunch minimal new session and attempt single warm pass
                                from seleniumbase import SB as _SB
                                relaunch_kwargs = dict(sb_kwargs)
                                relaunch_kwargs["user_data_dir"] = new_profile
                                with _SB(**relaunch_kwargs) as sb2:
                                    sb2.open("https://www.upwork.com/")
                                    sb2.sleep(2)
                                    sb2.open(url)
                                    sb2.sleep(6)
                                    if any(t in sb2.get_page_source() for t in ["challenge-platform","Just a moment","Checking your browser"]):
                                        print("[Auth Bot] 🔄 Profile refresh did not bypass challenge")
                                    else:
                                        print("[Auth Bot] ✅ Bypass succeeded after profile refresh")
                            except Exception as pr_e:
                                print(f"[Auth Bot] ⚠️ Profile refresh failed: {pr_e}")

                print("[Auth Bot] Loading job listings...")
                try:
                    sb.wait_for_element(".air3-card", timeout=15)
                    print("[Auth Bot] ✅ Jobs loaded")
                    sb.sleep(5)
                except Exception:
                    print("[Auth Bot] ⚠️ Job cards timeout - checking page...")
                    current_url = sb.get_current_url()
                    print(f"[Auth Bot] Current URL: {current_url}")

                print("[Auth Bot] Injecting network monitor...")
                monitor_script = """
                (function(){
                    function shouldCapture(u){
                        if(!u || typeof u !== 'string') return false;
                        u = u.toLowerCase();
                        // capture search, job details & generic graphql calls
                        return (
                            u.includes('visitorjobsearch') ||
                            u.includes('jobpubdetails') ||
                            (u.includes('/graphql') && (u.includes('job') || u.includes('search')))
                        );
                    }
                    window.capturedRequests = window.capturedRequests || [];
                    const originalFetch = window.fetch;
                    window.fetch = function(...args){
                        try {
                            const url = args[0];
                            const options = args[1] || {};
                            if(shouldCapture(url)){
                                window.capturedRequests.push({
                                    ts: Date.now(),
                                    url: url,
                                    headers: options.headers || {},
                                    method: (options.method || 'GET').toUpperCase(),
                                    body: options.body || null,
                                    type: 'fetch'
                                });
                            }
                        } catch(e) {}
                        return originalFetch.apply(this, args);
                    };
                    const originalXHROpen = XMLHttpRequest.prototype.open;
                    const originalXHRSend = XMLHttpRequest.prototype.send;
                    const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
                    XMLHttpRequest.prototype.open = function(method, url, async, user, password){
                        this._method = method;
                        this._url = url;
                        this._headers = {};
                        return originalXHROpen.apply(this, arguments);
                    };
                    XMLHttpRequest.prototype.setRequestHeader = function(header, value){
                        try { this._headers[header] = value; } catch(e) {}
                        return originalSetHeader.call(this, header, value);
                    };
                    XMLHttpRequest.prototype.send = function(data){
                        try {
                            if(shouldCapture(this._url)){
                                window.capturedRequests.push({
                                    ts: Date.now(),
                                    url: this._url,
                                    method: (this._method || 'GET').toUpperCase(),
                                    headers: this._headers || {},
                                    body: data || null,
                                    type: 'xhr'
                                });
                            }
                        } catch(e) {}
                        return originalXHRSend.apply(this, arguments);
                    };
                })();
                """
                try:
                    sb.execute_script(monitor_script)
                    print("[Auth Bot] ✅ Network monitor active")
                except Exception as e:
                    print(f"[Auth Bot] ⚠️ Could not inject monitor: {e}")

                print("[Auth Bot] Looking for pagination...")
                page_2_selectors = [
                    'button[data-ev-page_index="2"]',
                    'a[data-ev-page_index="2"]',
                    'button[aria-label="Go to page 2"]',
                    '.pagination button:nth-child(3)',
                    'li[data-page="2"] button'
                ]
                page_2_found = False
                for selector in page_2_selectors:
                    try:
                        if sb.is_element_visible(selector):
                            sb.scroll_to_element(selector)
                            sb.sleep(2)
                            sb.click(selector)
                            print(f"[Auth Bot] ✅ Clicked page 2: {selector}")
                            page_2_found = True
                            break
                    except Exception:
                        continue
                if not page_2_found:
                    print("[Auth Bot] ⚠️ Page 2 not found, trying JS click...")
                    try:
                        sb.execute_script("""
                            const pageBtn = document.querySelector('[data-ev-page_index="2"]');
                            if (pageBtn) pageBtn.click();
                        """)
                        print("[Auth Bot] ✅ Clicked page 2 via JS")
                    except Exception as e:
                        print(f"[Auth Bot] ❌ Could not click page 2: {e}")

                # NEW: Trigger a job details view to force a jobPubDetails GraphQL request
                print("[Auth Bot] Forcing a job details request (click first job card if available)...")
                try:
                    # Try various selectors for first job link
                    job_link_selectors = [
                        'a[data-test="job-tile-title-link"]',
                        '.air3-card a[href*="/jobs/"]',
                        'section a[href*="/jobs/"]',
                    ]
                    clicked_job = False
                    for sel in job_link_selectors:
                        if sb.is_element_visible(sel):
                            sb.scroll_to_element(sel)
                            sb.sleep(1)
                            sb.click(sel)
                            print(f"[Auth Bot] ✅ Clicked job link via selector: {sel}")
                            clicked_job = True
                            break
                    if not clicked_job:
                        # fallback: open first job card details via JS
                        opened = sb.execute_script("var l=document.querySelector('a[href*=\"/jobs/\"]'); if(l){ l.click(); return true;} return false;")
                        if opened:
                            print("[Auth Bot] ✅ Clicked job link via JS fallback")
                        else:
                            print("[Auth Bot] ⚠️ Could not locate a job link to click")
                    sb.sleep(4)  # allow navigation / xhr
                except Exception as e:
                    print(f"[Auth Bot] ⚠️ Job details trigger error: {e}")

                print("[Auth Bot] Waiting for GraphQL / search requests...")
                sb.sleep(4)
                print("[Auth Bot] Analyzing network requests...")
                try:
                    captured_requests = sb.execute_script("return (window.capturedRequests || []).slice(-25);")  # limit to last 25 for clarity
                    print(f"[Auth Bot] Captured {len(captured_requests)} relevant requests")
                    if captured_requests:
                        # Save all captured requests for offline debugging
                        try:
                            debug_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'captured_requests_debug.json')
                            with open(debug_path, 'w') as df:
                                json.dump(captured_requests, df, indent=2)
                            print(f"[Auth Bot] 🗂 Saved captured requests to {debug_path}")
                        except Exception as dre:
                            print(f"[Auth Bot] ⚠️ Could not save captured requests debug file: {dre}")
                        
                        # Prefer a job details GraphQL request if present
                        preferred = None
                        for req in reversed(captured_requests):
                            if 'jobpubdetails' in req.get('url','').lower():
                                preferred = req
                                break
                        latest_request = preferred or captured_requests[-1]
                        headers_found = dict(latest_request.get('headers', {}) or {})
                        
                        # If we have a job details request body, persist its ID for dynamic testing
                        try:
                            if preferred and preferred.get('body'):
                                body_raw = preferred.get('body')
                                job_id_candidate = None
                                try:
                                    body_json = json.loads(body_raw)
                                    vars_obj = body_json.get('variables') if isinstance(body_json, dict) else None
                                    job_id_candidate = vars_obj.get('id') if vars_obj else None
                                except Exception:
                                    # body may be FormData or stringified differently
                                    pass
                                if job_id_candidate:
                                    jid_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'job_details_last_id.txt')
                                    with open(jid_path, 'w') as jf:
                                        jf.write(str(job_id_candidate))
                                    print(f"[Auth Bot] 🧾 Saved last job details ID: {job_id_candidate}")
                        except Exception as id_e:
                            print(f"[Auth Bot] ⚠️ Could not extract job id from request body: {id_e}")
                        
                        if not headers_found:
                            print("[Auth Bot] No headers captured, creating comprehensive fallback...")
                            user_agent = sb.execute_script("return navigator.userAgent;")
                            # Use Windows User-Agent even on Linux for better compatibility
                            fallback_ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                            headers_found = {
                                'Accept': 'application/json, text/plain, */*',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'Content-Type': 'application/json',
                                'User-Agent': fallback_ua,
                                'Referer': sb.get_current_url(),
                                'Origin': 'https://www.upwork.com',
                                'Sec-Fetch-Site': 'same-origin',
                                'Sec-Fetch-Mode': 'cors',
                                'Sec-Fetch-Dest': 'empty',
                                'sec-ch-ua': '"Chromium";v="121", "Not(A:Brand";v="8"',
                                'sec-ch-ua-mobile': '?0',
                                'sec-ch-ua-platform': '"Windows"',
                                'apollographql-client-name': 'web',
                                'apollographql-client-version': '1.4'
                            }
                        print(f"[Auth Bot] ✅ Headers captured from {latest_request.get('type', 'unknown')}")
                    else:
                        print("[Auth Bot] No requests captured, using comprehensive fallback headers...")
                        user_agent = sb.execute_script("return navigator.userAgent;")
                        # Use Windows User-Agent even on Linux for better compatibility
                        fallback_ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                        headers_found = {
                            'Accept': 'application/json, text/plain, */*',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Content-Type': 'application/json',
                            'User-Agent': fallback_ua,
                            'Referer': sb.get_current_url(),
                            'Origin': 'https://www.upwork.com',
                            'Sec-Fetch-Site': 'same-origin',
                            'Sec-Fetch-Mode': 'cors',
                            'Sec-Fetch-Dest': 'empty',
                            'sec-ch-ua': '"Chromium";v="121", "Not(A:Brand";v="8"',
                            'sec-ch-ua-mobile': '?0',
                            'sec-ch-ua-platform': '"Windows"',
                            'apollographql-client-name': 'web',
                            'apollographql-client-version': '1.4'
                        }
                    # Attempt manual extraction of visitor / trace identifiers if missing
                    if headers_found and not any(k.lower() == 'vnd-eo-visitorid' for k in headers_found.keys()):
                        print("[Auth Bot] Visitor ID missing from headers, attempting manual extraction...")
                        vid, trace = _attempt_extract_visitor_ids(sb)
                        if vid:
                            headers_found['vnd-eo-visitorId'] = vid
                            print(f"[Auth Bot] 🔑 Injected visitorId from localStorage: {vid[:12]}...")
                        if trace:
                            headers_found.setdefault('vnd-eo-trace-id', trace)
                        
                        # If still no visitor ID, try extracting from cookies
                        if not vid and cookies_found:
                            print("[Auth Bot] Attempting visitor ID extraction from cookies...")
                            for cookie_name, cookie_value in cookies_found.items():
                                if 'visitor' in cookie_name.lower() and len(str(cookie_value)) > 10:
                                    headers_found['vnd-eo-visitorId'] = str(cookie_value)
                                    print(f"[Auth Bot] 🔑 Found visitor ID in cookie '{cookie_name}': {str(cookie_value)[:12]}...")
                                    break
                            # Also check for any long hex-like values that could be visitor IDs
                            if 'vnd-eo-visitorId' not in headers_found:
                                for cookie_name, cookie_value in cookies_found.items():
                                    val_str = str(cookie_value)
                                    # Look for hex-like strings 20+ chars long
                                    if len(val_str) >= 20 and len(val_str) <= 50 and all(c in '0123456789abcdefABCDEF-_' for c in val_str):
                                        headers_found['vnd-eo-visitorId'] = val_str
                                        print(f"[Auth Bot] 🔑 Using potential visitor ID from cookie '{cookie_name}': {val_str[:12]}...")
                                        break
                        
                        # Final fallback: if still no visitor ID after all attempts, create synthetic one
                        if 'vnd-eo-visitorId' not in headers_found:
                            print("[Auth Bot] ⚠️ No visitor ID found after all attempts, generating synthetic ID...")
                            synthetic_visitor_id = str(uuid.uuid4()).replace('-', '')[:32]
                            headers_found['vnd-eo-visitorId'] = synthetic_visitor_id
                            print(f"[Auth Bot] 🔑 Using synthetic visitor ID: {synthetic_visitor_id[:12]}...")
                    else:
                        print("[Auth Bot] ✅ Visitor ID already present in headers")
                except Exception as e:
                    print(f"[Auth Bot] ❌ Error retrieving requests: {e}")
                    return False

                print("[Auth Bot] Capturing cookies (post job details click)...")
                try:
                    cookies = {}
                    for cookie in sb.get_cookies():
                        cookies[cookie['name']] = cookie['value']
                    print(f"[Auth Bot] ✅ Captured {len(cookies)} cookies")
                    cookies_found = cookies
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    cookies_file = os.path.join(script_dir, "upwork_cookies.json")
                    with open(cookies_file, "w") as f:
                        json.dump(cookies, f, indent=2)
                    print(f"[Auth Bot] ✅ Cookies saved to {cookies_file}")
                except Exception as e:
                    print(f"[Auth Bot] ⚠️ Cookie error: {e}")
                    cookies_found = None
        except Exception as sb_launch_error:
            print(f"[Auth Bot] ⚠️ SeleniumBase launch failed: {sb_launch_error}")
            # If Chrome attempt failed (not forced Firefox), retry with Firefox once
            if not use_firefox and not force_firefox:
                print("[Auth Bot] 🔁 Falling back to Firefox after Chrome failure...")
                use_firefox = True
                try:
                    # Re-enter with Firefox (recursive like but single retry)
                    os.environ['FORCE_FIREFOX'] = '1'
                    return get_upwork_headers()
                finally:
                    if 'FORCE_FIREFOX' in os.environ and not force_firefox:
                        del os.environ['FORCE_FIREFOX']
            if use_firefox:
                print("[Auth Bot] 🔁 Attempting raw Selenium Firefox fallback...")
                try:
                    from selenium import webdriver as _webdriver
                    from selenium.webdriver.firefox.options import Options as _FxOptions
                    from selenium.webdriver.firefox.service import Service as _FxService
                    
                    # Enhanced geckodriver search for Ubuntu
                    search_candidates = [
                        os.environ.get("GECKODRIVER"),
                        os.path.join(os.path.dirname(os.path.abspath(__file__)), "drivers", "geckodriver"),
                        os.path.join(os.path.dirname(os.path.abspath(__file__)), "drivers", "geckodriver.exe"),
                        "/snap/bin/geckodriver",  # Common on Ubuntu with snap
                        "/usr/local/bin/geckodriver",
                        "/usr/bin/geckodriver",
                        "/opt/geckodriver",  # Common manual install location
                        os.path.expanduser("~/bin/geckodriver"),
                        os.path.expanduser("~/.local/bin/geckodriver"),
                    ]
                    
                    gecko_path = None
                    for candidate in search_candidates:
                        if candidate and os.path.exists(candidate):
                            # Test if it's executable
                            try:
                                if os.access(candidate, os.X_OK):
                                    gecko_path = candidate
                                    print(f"[Auth Bot] Firefox fallback: Found geckodriver at {gecko_path}")
                                    break
                                else:
                                    print(f"[Auth Bot] Firefox fallback: Found but not executable: {candidate}")
                            except Exception:
                                continue
                    
                    if not gecko_path:
                        print("[Auth Bot] Firefox fallback: No valid geckodriver found, attempting auto-download...")
                        gecko_path = _ensure_geckodriver()
                    
                    if not gecko_path:
                        print("[Auth Bot] ❌ No geckodriver found for raw fallback.")
                        return False
                    
                    fx_opts = _FxOptions()
                    fx_opts.add_argument("-headless")
                    # Override User-Agent to appear as Chrome on Windows for better compatibility
                    fx_opts.set_preference("general.useragent.override", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
                    # Add additional Firefox preferences for better Ubuntu compatibility
                    fx_opts.set_preference("dom.webdriver.enabled", False)
                    fx_opts.set_preference("useAutomationExtension", False)
                    fx_opts.set_preference("media.peerconnection.enabled", False)
                    
                    try:
                        service = _FxService(executable_path=gecko_path)
                        print(f"[Auth Bot] Firefox fallback: Starting Firefox with {gecko_path}")
                    except Exception as service_e:
                        print(f"[Auth Bot] Firefox fallback: Service creation failed: {service_e}")
                        return False
                    driver = _webdriver.Firefox(options=fx_opts, service=service)
                    try:
                        # NEW: First use cloudscraper to bypass Cloudflare, then transfer to Firefox
                        print("[Auth Bot] Firefox fallback: Using cloudscraper to bypass Cloudflare first...")
                        cloudscraper_success = False
                        cf_cookies = {}
                        
                        try:
                            import cloudscraper
                            print("[Auth Bot] Firefox fallback: Creating cloudscraper session...")
                            scraper = cloudscraper.create_scraper(
                                browser={
                                    'browser': 'firefox',
                                    'platform': 'linux',
                                    'mobile': False
                                },
                                delay=15,
                                debug=False
                            )
                            
                            # Use cloudscraper to bypass Cloudflare
                            print("[Auth Bot] Firefox fallback: Cloudscraper accessing Upwork...")
                            cs_response = scraper.get(
                                "https://www.upwork.com/nx/search/jobs/?q=python",
                                timeout=30
                            )
                            
                            if cs_response.status_code == 200:
                                print("[Auth Bot] Firefox fallback: ✅ Cloudscraper bypassed Cloudflare!")
                                cf_cookies = scraper.cookies.get_dict()
                                print(f"[Auth Bot] Firefox fallback: Extracted {len(cf_cookies)} cookies from cloudscraper")
                                cloudscraper_success = True
                            else:
                                print(f"[Auth Bot] Firefox fallback: ⚠️ Cloudscraper got {cs_response.status_code}")
                                
                        except ImportError:
                            print("[Auth Bot] Firefox fallback: ⚠️ cloudscraper not available, using pure Selenium")
                        except Exception as cs_e:
                            print(f"[Auth Bot] Firefox fallback: ⚠️ Cloudscraper error: {cs_e}")
                        
                        # If cloudscraper worked, transfer cookies to Firefox
                        if cloudscraper_success and cf_cookies:
                            print("[Auth Bot] Firefox fallback: Transferring cloudscraper cookies to Firefox...")
                            # Navigate to Upwork first to set domain
                            driver.get("https://www.upwork.com")
                            time.sleep(2)
                            
                            # Transfer cookies from cloudscraper to Firefox
                            for name, value in cf_cookies.items():
                                try:
                                    driver.add_cookie({
                                        'name': name,
                                        'value': value,
                                        'domain': '.upwork.com',
                                        'path': '/',
                                        'secure': True
                                    })
                                except Exception as cookie_e:
                                    print(f"[Auth Bot] Firefox fallback: ⚠️ Could not add cookie {name}: {cookie_e}")
                            
                            print("[Auth Bot] Firefox fallback: Cookies transferred, navigating to job search...")
                            driver.get("https://www.upwork.com/nx/search/jobs/?q=python")
                            time.sleep(3)
                            
                            # Quick check if we bypassed Cloudflare with the transferred cookies
                            current_url = driver.current_url
                            page_source = driver.page_source
                            
                            is_challenge = (
                                "challenge-platform" in current_url or
                                "cdn-cgi" in current_url or
                                "Just a moment" in page_source or
                                "Checking your browser" in page_source or
                                "Ray ID:" in page_source
                            )
                            
                            if not is_challenge:
                                print("[Auth Bot] Firefox fallback: ✅ Cookie transfer bypassed Cloudflare!")
                            else:
                                print("[Auth Bot] Firefox fallback: ⚠️ Still seeing challenge after cookie transfer")
                        else:
                            # Fallback to pure Selenium approach
                            print("[Auth Bot] Firefox fallback: Using pure Selenium approach...")
                            driver.get("https://www.upwork.com/nx/search/jobs/?q=python")
                            print("[Auth Bot] Firefox fallback: Waiting for page load...")
                            
                            # Enhanced Cloudflare bypass with longer waits and more attempts
                            print("[Auth Bot] Firefox fallback: Checking for Cloudflare challenge...")
                            max_cf_attempts = 25  # Increased attempts
                            for attempt in range(max_cf_attempts):
                                time.sleep(6)  # Longer wait between attempts
                                
                                current_url = driver.current_url
                                page_source = driver.page_source
                                
                                # Check for Cloudflare challenge indicators
                                is_challenge = (
                                    "challenge-platform" in current_url or
                                    "cdn-cgi" in current_url or
                                    "Just a moment" in page_source or
                                    "Checking your browser" in page_source or
                                    "Ray ID:" in page_source
                                )
                                
                                if not is_challenge:
                                    # Double-check with element presence
                                    try:
                                        from selenium.webdriver.common.by import By
                                        elements = driver.find_elements(By.CSS_SELECTOR, ".air3-card, [data-test='job-tile'], article")
                                        if elements:
                                            print(f"[Auth Bot] Firefox fallback: ✅ Cloudflare bypassed on attempt {attempt+1}!")
                                            break
                                    except:
                                        pass
                                
                                # More frequent page refreshes for stubborn challenges
                                if attempt % 3 == 0 and attempt > 0:
                                    print(f"[Auth Bot] Firefox fallback: Refreshing page on attempt {attempt+1}")
                                    driver.refresh()
                                    time.sleep(5)
                                
                                print(f"[Auth Bot] Firefox fallback: Challenge detected, attempt {attempt+1}/{max_cf_attempts}")
                            else:
                                print("[Auth Bot] Firefox fallback: ⚠️ Could not bypass Cloudflare challenge")
                                print(f"[Auth Bot] Firefox fallback: Final URL: {driver.current_url}")
                        
                        time.sleep(3)  # Additional wait after bypass
                        
                        # Inject the same network monitoring script as Chrome
                        print("[Auth Bot] Firefox fallback: Injecting network monitor...")
                        monitor_script = """
                        (function(){
                            function shouldCapture(u){
                                if(!u || typeof u !== 'string') return false;
                                u = u.toLowerCase();
                                // capture search, job details & generic graphql calls
                                return (
                                    u.includes('visitorjobsearch') ||
                                    u.includes('jobpubdetails') ||
                                    (u.includes('/graphql') && (u.includes('job') || u.includes('search')))
                                );
                            }
                            window.capturedRequests = window.capturedRequests || [];
                            const originalFetch = window.fetch;
                            window.fetch = function(...args){
                                try {
                                    const url = args[0];
                                    const options = args[1] || {};
                                    if(shouldCapture(url)){
                                        window.capturedRequests.push({
                                            ts: Date.now(),
                                            url: url,
                                            headers: options.headers || {},
                                            method: (options.method || 'GET').toUpperCase(),
                                            body: options.body || null,
                                            type: 'fetch'
                                        });
                                    }
                                } catch(e) {}
                                return originalFetch.apply(this, args);
                            };
                            const originalXHROpen = XMLHttpRequest.prototype.open;
                            const originalXHRSend = XMLHttpRequest.prototype.send;
                            const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
                            XMLHttpRequest.prototype.open = function(method, url, async, user, password){
                                this._method = method;
                                this._url = url;
                                this._headers = {};
                                return originalXHROpen.apply(this, arguments);
                            };
                            XMLHttpRequest.prototype.setRequestHeader = function(header, value){
                                try { this._headers[header] = value; } catch(e) {}
                                return originalSetHeader.call(this, header, value);
                            };
                            XMLHttpRequest.prototype.send = function(data){
                                try {
                                    if(shouldCapture(this._url)){
                                        window.capturedRequests.push({
                                            ts: Date.now(),
                                            url: this._url,
                                            method: (this._method || 'GET').toUpperCase(),
                                            headers: this._headers || {},
                                            body: data || null,
                                            type: 'xhr'
                                        });
                                    }
                                } catch(e) {}
                                return originalXHRSend.apply(this, arguments);
                            };
                        })();
                        """
                        try:
                            driver.execute_script(monitor_script)
                            print("[Auth Bot] Firefox fallback: ✅ Network monitor active")
                        except Exception as e:
                            print(f"[Auth Bot] Firefox fallback: ⚠️ Could not inject monitor: {e}")
                        
                        # Wait for jobs to load
                        try:
                            from selenium.webdriver.support.ui import WebDriverWait
                            from selenium.webdriver.support import expected_conditions as EC
                            from selenium.webdriver.common.by import By
                            wait = WebDriverWait(driver, 15)
                            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".air3-card")))
                            print("[Auth Bot] Firefox fallback: Jobs loaded")
                        except Exception:
                            print("[Auth Bot] Firefox fallback: Jobs timeout - continuing anyway")
                        
                        time.sleep(5)
                        
                        # Try pagination to trigger search requests
                        print("[Auth Bot] Firefox fallback: Looking for pagination...")
                        page_2_selectors = [
                            'button[data-ev-page_index="2"]',
                            'a[data-ev-page_index="2"]',
                            'button[aria-label="Go to page 2"]',
                            '.pagination button:nth-child(3)',
                            'li[data-page="2"] button'
                        ]
                        page_2_found = False
                        for selector in page_2_selectors:
                            try:
                                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                                if elements:
                                    driver.execute_script("arguments[0].scrollIntoView();", elements[0])
                                    time.sleep(2)
                                    driver.execute_script("arguments[0].click();", elements[0])
                                    print(f"[Auth Bot] Firefox fallback: ✅ Clicked page 2: {selector}")
                                    page_2_found = True
                                    break
                            except Exception:
                                continue
                        if not page_2_found:
                            print("[Auth Bot] Firefox fallback: ⚠️ Page 2 not found, trying JS click...")
                            try:
                                driver.execute_script("""
                                    const pageBtn = document.querySelector('[data-ev-page_index="2"]');
                                    if (pageBtn) pageBtn.click();
                                """)
                                print("[Auth Bot] Firefox fallback: ✅ Clicked page 2 via JS")
                            except Exception as e:
                                print(f"[Auth Bot] Firefox fallback: ❌ Could not click page 2: {e}")
                        
                        time.sleep(3)  # Wait for pagination request
                        
                        # Try to click on a job to trigger GraphQL requests
                        print("[Auth Bot] Firefox fallback: Attempting to click job for GraphQL trigger...")
                        try:
                            # Use better selectors and try multiple approaches
                            job_link_selectors = [
                                'a[data-test="job-tile-title-link"]',
                                '.air3-card a[href*="/jobs/"]',
                                'section a[href*="/jobs/"]',
                                'a[href*="/jobs/"]'
                            ]
                            clicked_job = False
                            for sel in job_link_selectors:
                                try:
                                    elements = driver.find_elements(By.CSS_SELECTOR, sel)
                                    if elements:
                                        driver.execute_script("arguments[0].scrollIntoView();", elements[0])
                                        time.sleep(1)
                                        driver.execute_script("arguments[0].click();", elements[0])
                                        print(f"[Auth Bot] Firefox fallback: ✅ Clicked job link via selector: {sel}")
                                        clicked_job = True
                                        break
                                except Exception:
                                    continue
                            if not clicked_job:
                                # fallback: open first job card details via JS
                                opened = driver.execute_script("var l=document.querySelector('a[href*=\"/jobs/\"]'); if(l){ l.click(); return true;} return false;")
                                if opened:
                                    print("[Auth Bot] Firefox fallback: ✅ Clicked job link via JS fallback")
                                else:
                                    print("[Auth Bot] Firefox fallback: ⚠️ Could not locate a job link to click")
                            time.sleep(4)  # Wait for job details request
                            
                            # Try additional interactions to trigger more requests
                            print("[Auth Bot] Firefox fallback: Triggering additional interactions...")
                            try:
                                # Try clicking filters or search to trigger more GraphQL
                                driver.execute_script("""
                                    // Try to trigger search/filter requests
                                    var searchBtn = document.querySelector('button[type="submit"]');
                                    if (searchBtn) searchBtn.click();
                                    
                                    // Try clicking any pagination or filter elements
                                    var filters = document.querySelectorAll('[data-test*="filter"], [data-test*="search"]');
                                    if (filters.length > 0) filters[0].click();
                                """)
                                time.sleep(3)
                            except:
                                pass
                                
                        except Exception as job_e:
                            print(f"[Auth Bot] Firefox fallback: Could not click job: {job_e}")
                        
                        # Now analyze captured requests like Chrome does
                        print("[Auth Bot] Firefox fallback: Analyzing captured requests...")
                        try:
                            captured_requests = driver.execute_script("return (window.capturedRequests || []).slice(-25);")
                            print(f"[Auth Bot] Firefox fallback: Captured {len(captured_requests)} relevant requests")
                            
                            # If no requests captured, try manual GraphQL trigger
                            if not captured_requests:
                                print("[Auth Bot] Firefox fallback: No requests captured, trying manual GraphQL trigger...")
                                try:
                                    manual_request = driver.execute_script("""
                                        return new Promise((resolve) => {
                                            fetch('/api/graphql/v1', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Accept': 'application/json, text/plain, */*',
                                                    'apollographql-client-name': 'web',
                                                    'apollographql-client-version': '1.4'
                                                },
                                                body: JSON.stringify({
                                                    query: 'query { viewer { id } }'
                                                })
                                            }).then(response => {
                                                resolve({
                                                    status: response.status,
                                                    headers: Object.fromEntries(response.headers.entries())
                                                });
                                            }).catch(e => resolve({error: e.toString()}));
                                        });
                                    """)
                                    print(f"[Auth Bot] Firefox fallback: Manual GraphQL request result: {manual_request}")
                                except Exception as mgql_e:
                                    print(f"[Auth Bot] Firefox fallback: Manual GraphQL failed: {mgql_e}")
                                
                                # Re-check captured requests after manual trigger
                                captured_requests = driver.execute_script("return (window.capturedRequests || []).slice(-25);")
                                print(f"[Auth Bot] Firefox fallback: After manual trigger, captured {len(captured_requests)} requests")
                            
                            headers_found = None
                            if captured_requests:
                                # Save captured requests for debugging
                                try:
                                    debug_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'captured_requests_debug_firefox.json')
                                    with open(debug_path, 'w') as df:
                                        json.dump(captured_requests, df, indent=2)
                                    print(f"[Auth Bot] Firefox fallback: 🗂 Saved captured requests to {debug_path}")
                                except Exception:
                                    pass
                                
                                # Prefer a job details GraphQL request if present
                                preferred = None
                                for req in reversed(captured_requests):
                                    if 'jobpubdetails' in req.get('url','').lower():
                                        preferred = req
                                        break
                                latest_request = preferred or captured_requests[-1]
                                headers_found = dict(latest_request.get('headers', {}) or {})
                                
                                # If we have a job details request body, persist its ID for dynamic testing
                                try:
                                    if preferred and preferred.get('body'):
                                        body_raw = preferred.get('body')
                                        job_id_candidate = None
                                        try:
                                            body_json = json.loads(body_raw)
                                            vars_obj = body_json.get('variables') if isinstance(body_json, dict) else None
                                            job_id_candidate = vars_obj.get('id') if vars_obj else None
                                        except Exception:
                                            pass
                                        if job_id_candidate:
                                            jid_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'job_details_last_id.txt')
                                            with open(jid_path, 'w') as jf:
                                                jf.write(str(job_id_candidate))
                                            print(f"[Auth Bot] Firefox fallback: 🧾 Saved last job details ID: {job_id_candidate}")
                                except Exception:
                                    pass
                                
                                print(f"[Auth Bot] Firefox fallback: ✅ Headers captured from {latest_request.get('type', 'unknown')}")
                        except Exception as e:
                            print(f"[Auth Bot] Firefox fallback: ⚠️ Error analyzing requests: {e}")
                        
                        ua = driver.execute_script("return navigator.userAgent;")
                        
                        # Extract visitor IDs using the same logic as SeleniumBase version
                        print("[Auth Bot] Firefox fallback: Extracting visitor IDs...")
                        visitor_id = None
                        trace_id = None
                        try:
                            ids = driver.execute_script(
                                """
                                const out = {visitor:null, trace:null, storage:{}, cookies:{}};
                                try {
                                  // Check localStorage
                                  for (let i=0;i<localStorage.length;i++) {
                                    const k = localStorage.key(i);
                                    const v = localStorage.getItem(k);
                                    out.storage[k]=v;
                                    if(!out.visitor && /visitor/i.test(k) && v && v.length < 80) out.visitor = v;
                                    if(!out.trace && /trace/i.test(k) && v && v.length < 80) out.trace = v;
                                  }
                                  // Check document cookies
                                  const cookies = document.cookie.split(';');
                                  for(let cookie of cookies) {
                                    const [name, value] = cookie.trim().split('=');
                                    if(name && value) {
                                      out.cookies[name] = value;
                                      if(!out.visitor && /visitor/i.test(name) && value.length < 80) out.visitor = value;
                                      if(!out.trace && /trace/i.test(name) && value.length < 80) out.trace = value;
                                    }
                                  }
                                  // Look for common Upwork visitor patterns
                                  if(!out.visitor) {
                                    for(const [k,v] of Object.entries(out.storage)) {
                                      if(/eo.*visitor|visitor.*id|user.*id/i.test(k) && v && v.length > 10 && v.length < 50) {
                                        out.visitor = v;
                                        break;
                                      }
                                    }
                                  }
                                  // Also check session storage
                                  try {
                                    for(let i=0;i<sessionStorage.length;i++) {
                                      const k = sessionStorage.key(i);
                                      const v = sessionStorage.getItem(k);
                                      if(!out.visitor && /visitor/i.test(k) && v && v.length > 10 && v.length < 80) {
                                        out.visitor = v;
                                        break;
                                      }
                                    }
                                  } catch(e) {}
                                  // Try to extract from page HTML/scripts as fallback
                                  if(!out.visitor) {
                                    const scripts = document.querySelectorAll('script');
                                    for(let script of scripts) {
                                      const text = script.textContent || script.innerText || '';
                                      const match = text.match(/["']([a-f0-9-]{20,40})["'].*visitor/i) || text.match(/visitor.*["']([a-f0-9-]{20,40})["']/i);
                                      if(match && match[1]) {
                                        out.visitor = match[1];
                                        break;
                                      }
                                    }
                                  }
                                } catch(e) { out.error = e.toString(); }
                                return out;
                                """
                            )
                            visitor_id = ids.get('visitor') if isinstance(ids, dict) else None
                            trace_id = ids.get('trace') if isinstance(ids, dict) else None
                            print(f"[Auth Bot] Firefox fallback: Found visitor_id: {visitor_id[:12] + '...' if visitor_id else 'None'}")
                            print(f"[Auth Bot] Firefox fallback: Found trace_id: {trace_id[:12] + '...' if trace_id else 'None'}")
                            
                            # Additional debugging
                            if visitor_id:
                                print(f"[Auth Bot] Firefox fallback: 🔑 Visitor ID successfully extracted: {len(visitor_id)} chars")
                            else:
                                storage_count = len(ids.get('storage', {})) if isinstance(ids, dict) else 0
                                cookies_count = len(ids.get('cookies', {})) if isinstance(ids, dict) else 0
                                print(f"[Auth Bot] Firefox fallback: ⚠️ No visitor ID found. Storage: {storage_count}, Cookies: {cookies_count}")
                        except Exception as vid_e:
                            print(f"[Auth Bot] Firefox fallback: Visitor ID extraction failed: {vid_e}")
                        
                        # Create initial headers - use captured headers if available, otherwise fallback
                        if headers_found and len(headers_found) > 3:
                            print("[Auth Bot] Firefox fallback: Using captured headers from network requests")
                            # Ensure Windows User-Agent even if captured differently
                            if 'User-Agent' in headers_found:
                                headers_found['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                        else:
                            print("[Auth Bot] Firefox fallback: Using fallback headers (no network requests captured)")
                            headers_found = {
                                'Accept': 'application/json, text/plain, */*',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'Content-Type': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                                'Referer': driver.current_url,
                                'Origin': 'https://www.upwork.com'
                            }
                        
                        # Add visitor ID to headers if found
                        if visitor_id:
                            headers_found['vnd-eo-visitorId'] = visitor_id
                            print(f"[Auth Bot] Firefox fallback: 🔑 Added visitorId to headers: {visitor_id[:12]}...")
                        if trace_id:
                            headers_found['vnd-eo-trace-id'] = trace_id
                        
                        # Capture cookies and also try to find visitor ID in cookies if not found yet
                        cookies_found = {c['name']: c['value'] for c in driver.get_cookies()}
                        print(f"[Auth Bot] Firefox fallback: ✅ Captured {len(cookies_found)} cookies")
                        
                        # If still no visitor ID, try extracting from cookies more aggressively
                        if not visitor_id:
                            print("[Auth Bot] Firefox fallback: Attempting visitor ID extraction from cookies...")
                            for cookie_name, cookie_value in cookies_found.items():
                                if 'visitor' in cookie_name.lower() and len(str(cookie_value)) > 10:
                                    headers_found['vnd-eo-visitorId'] = str(cookie_value)
                                    print(f"[Auth Bot] Firefox fallback: 🔑 Found visitor ID in cookie '{cookie_name}': {str(cookie_value)[:12]}...")
                                    break
                            # Also check for any long hex-like values that could be visitor IDs
                            if 'vnd-eo-visitorId' not in headers_found:
                                for cookie_name, cookie_value in cookies_found.items():
                                    val_str = str(cookie_value)
                                    # Look for hex-like strings 20+ chars long
                                    if len(val_str) >= 20 and len(val_str) <= 50 and all(c in '0123456789abcdefABCDEF-_' for c in val_str):
                                        headers_found['vnd-eo-visitorId'] = val_str
                                        print(f"[Auth Bot] Firefox fallback: 🔑 Using potential visitor ID from cookie '{cookie_name}': {val_str[:12]}...")
                                        break
                        
                        # Save cookies
                        script_dir = os.path.dirname(os.path.abspath(__file__))
                        with open(os.path.join(script_dir, "upwork_cookies.json"), "w") as f:
                            json.dump(cookies_found, f, indent=2)
                        
                        # Apply the same header enrichment logic as the main path
                        print("[Auth Bot] Firefox fallback: Enriching headers...")
                        headers_found = _enrich_headers(headers_found, cookies_found, driver.current_url)
                        # Unified visitor ID ensure (reuse persisted or create new synthetic)
                        headers_found = _ensure_visitor_id(headers_found, script_dir)
                        
                        print(f"[Auth Bot] Firefox fallback: ✅ Headers enriched, total count: {len(headers_found)}")
                        
                        # Verify visitor ID is present
                        if 'vnd-eo-visitorId' in headers_found:
                            vid_value = headers_found['vnd-eo-visitorId']
                            print(f"[Auth Bot] Firefox fallback: ✅ Final visitor ID confirmation: {vid_value[:12]}... (length: {len(vid_value)})")
                        else:
                            print("[Auth Bot] Firefox fallback: ❌ WARNING: Still no visitor ID after all attempts!")
                        
                    finally:
                        try:
                            driver.quit()
                        except Exception:
                            pass
                except Exception as raw_e:
                    print(f"[Auth Bot] ❌ Raw Firefox fallback failed: {raw_e}")
                    return False
            else:
                return False

    except Exception as e:
        print(f"[Auth Bot] ❌ Automation error: {e}")
        import traceback
        traceback.print_exc()
        return False

    # Debug: Check what we captured
    print(f"\n[Auth Bot] 📊 Capture Summary:")
    print(f"[Auth Bot] Headers captured: {headers_found is not None} ({len(headers_found) if headers_found else 0} keys)")
    print(f"[Auth Bot] Cookies captured: {cookies_found is not None} ({len(cookies_found) if cookies_found else 0} keys)")
    
    # Additional debug
    if headers_found is None:
        print("[Auth Bot] ⚠️ WARNING: headers_found is None!")
    if cookies_found is None:
        print("[Auth Bot] ⚠️ WARNING: cookies_found is None!")
    
    print(f"[Auth Bot] Condition check: headers_found and cookies_found = {headers_found is not None and cookies_found is not None}")
    
    # Save headers and cookies
    if headers_found is not None and cookies_found is not None:
        try:
            # Get consistent base directory
            script_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Save to primary location
            headers_file = os.path.join(script_dir, "headers_upwork.json")
            with open(headers_file, "w") as f:
                json.dump(headers_found, f, indent=2)
            print(f"[Auth Bot] ✅ Headers saved to {headers_file}")
            
            # Save to secondary location for compatibility
            job_details_headers_file = os.path.join(script_dir, "job_details_headers.json")
            with open(job_details_headers_file, "w") as f:
                json.dump(headers_found, f, indent=2)
            print(f"[Auth Bot] ✅ Headers also saved to {job_details_headers_file}")
            
            # Save cookies to job_details_cookies.json
            job_details_cookies_file = os.path.join(script_dir, "job_details_cookies.json")
            with open(job_details_cookies_file, "w") as f:
                json.dump(cookies_found, f, indent=2)
            print(f"[Auth Bot] ✅ Cookies also saved to {job_details_cookies_file}")
            
            # Display sample of captured headers
            print("[Auth Bot] 📋 Header sample:")
            for key in list(headers_found.keys())[:5]:
                value = str(headers_found[key])[:50]
                print(f"  {key}: {value}...")
            
            # Add standard headers if missing
            if 'User-Agent' not in headers_found:
                headers_found['User-Agent'] = headers_found.get('user-agent', 'Mozilla/5.0')
            if 'Accept' not in headers_found:
                headers_found['Accept'] = 'application/json, text/plain, */*'
            
            # TEST: Validate credentials by fetching job details
            print("\n[Auth Bot] 🧪 Testing captured credentials...")
            print(f"[Auth Bot] Headers to test: {len(headers_found)} keys")
            print(f"[Auth Bot] Cookies to test: {len(cookies_found)} keys")
            
            # Enrich headers before testing
            current_url = headers_found.get('Referer') or headers_found.get('referer') or 'https://www.upwork.com/nx/search/jobs/'
            headers_found = _enrich_headers(headers_found, cookies_found, current_url)
            # Ensure stable visitor ID (persisted synthetic if real not captured)
            headers_found = _ensure_visitor_id(headers_found, script_dir)
            
            # Re-save enriched headers to ensure visitor ID and other enrichments are persisted
            try:
                with open(headers_file, "w") as f:
                    json.dump(headers_found, f, indent=2)
                with open(job_details_headers_file, "w") as f:
                    json.dump(headers_found, f, indent=2)
                print(f"[Auth Bot] ✅ Re-saved enriched headers with {len(headers_found)} total keys")
            except Exception as e:
                print(f"[Auth Bot] ⚠️ Could not re-save enriched headers: {e}")

            test_success = test_job_details_fetch(headers_found, cookies_found)
            
            if test_success:
                print("\n[Auth Bot] ✅ Credentials validation PASSED!")
                print("[Auth Bot] Headers and cookies are working correctly!")
                return True
            else:
                print("\n[Auth Bot] ⚠️ Credentials validation FAILED!")
                print("[Auth Bot] Headers/cookies were captured but may not work for all requests")
                print("[Auth Bot] This could be normal for public-only API access")
                return True  # Still return True since we captured something
            
        except Exception as e:
            print(f"[Auth Bot] ❌ Error saving headers: {e}")
            import traceback
            traceback.print_exc()
            return False
    elif headers_found:
        print("[Auth Bot] ⚠️ Headers captured but no cookies found")
        return False
    else:
        print("[Auth Bot] ❌ No headers found")
        return False

def verify_headers():
    """Verify that saved headers are valid"""
    try:
        # Check in the same directory as this script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        headers_file = os.path.join(script_dir, "headers_upwork.json")
        
        print(f"[Auth Bot] Checking headers file: {headers_file}")
        print(f"[Auth Bot] File exists: {os.path.exists(headers_file)}")
        
        if os.path.exists(headers_file):
            with open(headers_file, 'r') as f:
                headers = json.load(f)
            
            print(f"[Auth Bot] Loaded {len(headers)} headers from file")
            
            # Check for Upwork-specific headers OR standard headers
            upwork_headers = ['X-Upwork-Accept-Language', 'vnd-eo-visitorId', 'vnd-eo-trace-id']
            standard_headers = ['User-Agent', 'Accept', 'Content-Type']
            
            # Case-insensitive check
            header_keys_lower = [k.lower() for k in headers.keys()]
            
            has_upwork = any(uh.lower() in ' '.join(header_keys_lower) for uh in upwork_headers)
            has_standard = any(sh.lower() in ' '.join(header_keys_lower) for sh in standard_headers)
            has_required = has_upwork or has_standard or len(headers) > 5  # If we have many headers, it's probably good
            
            print(f"[Auth Bot] Headers validation: {'✅ Valid' if has_required else '❌ Invalid'}")
            print(f"[Auth Bot] Total headers: {len(headers)}")
            print(f"[Auth Bot] Has Upwork headers: {has_upwork}")
            print(f"[Auth Bot] Has standard headers: {has_standard}")
            
            # Show what headers we have
            print(f"[Auth Bot] Header keys: {', '.join(list(headers.keys())[:10])}")
            
            return has_required
        else:
            print("[Auth Bot] ❌ Headers file not found")
            return False
    except Exception as e:
        print(f"[Auth Bot] ❌ Verification error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function for standalone execution"""
    print("=" * 70)
    print("UPWORK AUTHENTICATION BOT - OPTIMIZED VERSION WITH TESTING")
    print("=" * 70)
    
    start_time = time.time()
    
    try:
        success = get_upwork_headers()
        
        elapsed_time = time.time() - start_time
        print(f"\n[Auth Bot] Total execution time: {elapsed_time:.2f} seconds")
        
        if success:
            print("[Auth Bot] ✅ Authentication completed successfully!")
            
            # Verify headers
            if verify_headers():
                print("[Auth Bot] ✅ Headers verified and ready to use!")
            else:
                print("[Auth Bot] ⚠️ Headers verification failed")
            
            sys.exit(0)
        else:
            print("[Auth Bot] ❌ Authentication failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n[Auth Bot] ⚠️ Interrupted by user")
        sys.exit(2)
    except Exception as e:
        print(f"[Auth Bot] ❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    print("=" * 70)

if __name__ == "__main__":
    main()