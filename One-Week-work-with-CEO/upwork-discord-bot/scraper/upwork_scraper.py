import cloudscraper
import json
import time
import random
import re
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from db.database import SessionLocal
import os


from db.models import Job

# Import browser cookies and GraphQL queries
from .cookies import browser_cookies
from .graphql_payloads import JOB_DETAILS_QUERY, VISITOR_JOB_SEARCH_QUERY, MINIMAL_VISITOR_JOB_SEARCH_QUERY

# Import helper modules
from .job_search import debug_job_ids

class UpworkScraper:
    # Primary GraphQL endpoint for visitor job search
    GRAPHQL_URL = "https://www.upwork.com/api/graphql/v1?alias=visitorJobSearch"
    
    # Job details GraphQL endpoint
    JOB_DETAILS_URL = "https://www.upwork.com/api/graphql/v1?alias=gql-query-get-visitor-job-details"
    
    # Token extraction endpoints - these should work without authentication
    TOKEN_EXTRACTION_URLS = [
        "https://www.upwork.com/",
        "https://www.upwork.com/nx/find-work/",
        "https://www.upwork.com/nx/search/jobs/",
        "https://www.upwork.com/nx/",
        "https://www.upwork.com/nx/job-search/"
    ]
    
    # Unauthenticated GraphQL endpoints for token bootstrap
    BOOTSTRAP_GRAPHQL_URLS = [
        "https://www.upwork.com/api/v4/visitor/stats",
        "https://www.upwork.com/api/v4/visitor/config", 
        "https://www.upwork.com/api/v4/visitor/health"
    ]

    def __init__(self):
        # cloudscraper handles Cloudflare
        self.scraper = cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows", "mobile": False}
        )

        # Token management - using your browser tokens
        self.current_auth_token = "oauth2v2_cd4aa30e2054e8357ea7f1960d6cc718"
        self.current_visitor_id = "39.45.32.89.1758018771960000"
        self.visitor_topnav_gql_token = "oauth2v2_cd4aa30e2054e8357ea7f1960d6cc718"

        # Track which URLs have been used for rotation
        self.used_extraction_urls = []
        self.current_extraction_url_index = 0

        # Updated cookies to match your browser exactly
        self.browser_cookies = browser_cookies.copy()

        # Generate session identifiers to match browser
        self.session_trace_id = "981cb51d2167a07f-KHI"
        self.session_span_id = "6af8b8c6-17d7-4e99-9724-532e1b318861"
        self.session_parent_span_id = "bd022f85-d2ba-4a0d-a463-31cfc0586e18"

        # Headers template matching your browser exactly
        self.base_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json",
            "Origin": "https://www.upwork.com",
            "Referer": "https://www.upwork.com/nx/search/jobs/?q=developer",
            "Sec-Ch-Ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
            "Sec-Ch-Ua-Arch": '"x86"',
            "Sec-Ch-Ua-Bitness": '"64"',
            "Sec-Ch-Ua-Full-Version": '"140.0.7339.128"',
            "Sec-Ch-Ua-Full-Version-List": '"Chromium";v="140.0.7339.128", "Not=A?Brand";v="24.0.0.0", "Google Chrome";v="140.0.7339.128"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Model": '""',
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Ch-Ua-Platform-Version": '"19.0.0"',
            "Sec-Ch-Viewport-Width": "490",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Priority": "u=1, i",
            "Vnd-Eo-Parent-Span-Id": self.session_parent_span_id,
            "Vnd-Eo-Span-Id": self.session_span_id,
            "Vnd-Eo-Trace-Id": self.session_trace_id,
            "Vnd-Eo-Visitorid": self.current_visitor_id,
            "X-Upwork-Accept-Language": "en-US"
        }

        print("Initialized with browser-matching tokens and headers")

    async def fetch_job_details(self, job_id):
        from .job_details import fetch_job_details
        return fetch_job_details(self, job_id)

    def _get_simplified_job_details_query(self, job_id):
        from .job_details import get_simplified_job_details_query
        return get_simplified_job_details_query(job_id)

    def _fallback_job_details(self, job_id):
        from .job_details import fallback_job_details
        return fallback_job_details(self, job_id)

    def _parse_fallback_response(self, data):
        from .job_details import parse_fallback_response
        return parse_fallback_response(data)
    
    def _make_job_details_request(self, payload, job_id):
        from .job_details import make_job_details_request
        return make_job_details_request(self, payload, job_id)

    def _extract_job_details_from_response(self, data):
        from .job_details import extract_job_details_from_response
        return extract_job_details_from_response(data)

    def _update_dynamic_cookies(self):
        """Update time-sensitive cookies"""
        current_time = int(time.time() * 1000)
        
        # Update timestamp-based cookies
        self.browser_cookies.update({
            "__cf_bm": f"gqBVQ8Ks4ZKFuztbZHW287bFjmS3nz9H0gVG0Tbr8Xs-{current_time}-1.0.1.1-4SuJMW.wzD6yuAHf.kAfxPG6CTBfhWZxtfAiAwuumEwA6FOREaafpnY0l936x7Iuon7.NhOc99tXuOaKjhlw5Dh9MT1Llpo4VxDuEdRGHhg",
            "_ga_KSM221PNDX": f"GS2.1.s{current_time}$o16$g1$t{current_time + 30}$j30$l0$h0",
            "IR_13634": f"{current_time}%7C0%7C{current_time}%7C%7C"
        })

    def _generate_session_ids(self):
        """Generate new session identifiers to avoid tracking"""
        # Generate new session IDs
        self.session_trace_id = f"{random.randint(100000000000000, 999999999999999):x}-KHI"
        self.session_span_id = str(uuid.uuid4())
        self.session_parent_span_id = str(uuid.uuid4())
        
        # Update headers with new session IDs
        self.base_headers.update({
            "Vnd-Eo-Parent-Span-Id": self.session_parent_span_id,
            "Vnd-Eo-Span-Id": self.session_span_id,
            "Vnd-Eo-Trace-Id": self.session_trace_id
        })

    def _bootstrap_fresh_session(self):
        """Bootstrap a completely fresh session without any authentication"""
        print("Bootstrapping fresh session...")
        
        try:
            # Clear old auth tokens temporarily
            old_auth_token = self.current_auth_token
            old_visitor_token = self.visitor_topnav_gql_token
            
            # Remove authentication temporarily
            self.current_auth_token = None
            self.visitor_topnav_gql_token = None
            
            # Generate completely new session
            self._generate_session_ids()
            
            # Create clean headers for bootstrap (no auth)
            bootstrap_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Ch-Ua": self.base_headers["Sec-Ch-Ua"],
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": self.base_headers["Sec-Ch-Ua-Platform"],
                "Cache-Control": "no-cache"
            }
            
            # Clear critical cookies for fresh start
            fresh_cookies = {}
            
            # Try to get fresh session from main page
            print("Loading fresh Upwork homepage...")
            response = self.scraper.get(
                "https://www.upwork.com/",
                headers=bootstrap_headers,
                cookies=fresh_cookies,
                timeout=30
            )
            
            print(f"Bootstrap homepage response: {response.status_code}")
            
            if response.status_code == 200:
                # Extract fresh tokens from page and cookies
                fresh_tokens = self._extract_tokens_from_response(response)
                if fresh_tokens:
                    print("Successfully bootstrapped fresh session!")
                    return True
                    
            # Try backup bootstrap URLs
            backup_urls = [
                "https://www.upwork.com/nx/",
                "https://www.upwork.com/nx/find-work/",
                "https://www.upwork.com/signup/"
            ]
            
            for url in backup_urls:
                try:
                    print(f"Trying bootstrap URL: {url}")
                    response = self.scraper.get(
                        url,
                        headers=bootstrap_headers,
                        cookies=fresh_cookies,
                        timeout=30
                    )
                    
                    print(f"Bootstrap {url} response: {response.status_code}")
                    
                    if response.status_code == 200:
                        fresh_tokens = self._extract_tokens_from_response(response)
                        if fresh_tokens:
                            print(f"Successfully bootstrapped from {url}")
                            return True
                            
                    time.sleep(random.uniform(2, 4))
                    
                except Exception as e:
                    print(f"Bootstrap failed for {url}: {e}")
                    continue
            
            # Restore old tokens if bootstrap failed
            self.current_auth_token = old_auth_token
            self.visitor_topnav_gql_token = old_visitor_token
            
            return False
            
        except Exception as e:
            print(f"Bootstrap session failed: {e}")
            # Restore old tokens
            self.current_auth_token = old_auth_token
            self.visitor_topnav_gql_token = old_visitor_token
            return False

    def _extract_tokens_from_response(self, response):
        """Extract tokens from HTTP response (cookies, headers, and HTML)"""
        try:
            found_tokens = False
            
            # Method 1: Extract from response cookies
            print("Extracting tokens from response cookies...")
            for cookie in response.cookies:
                if any(keyword in cookie.name.lower() for keyword in ['token', 'visitor', 'oauth']):
                    print(f"Found cookie token: {cookie.name} = {cookie.value[:20]}...")
                    
                    if 'visitor_id' in cookie.name.lower():
                        self.current_visitor_id = cookie.value
                        self.base_headers['Vnd-Eo-Visitorid'] = cookie.value
                        self.browser_cookies['visitor_id'] = cookie.value
                        found_tokens = True
                        
                    elif any(token_key in cookie.name.lower() for token_key in ['oauth', 'token', 'universalsearch']):
                        self.current_auth_token = cookie.value
                        self.visitor_topnav_gql_token = cookie.value
                        self.browser_cookies['UniversalSearchNuxt_vt'] = cookie.value
                        found_tokens = True
                        
                # Update all received cookies
                self.browser_cookies[cookie.name] = cookie.value
                
            # Method 2: Extract from Set-Cookie headers
            print("Extracting tokens from Set-Cookie headers...")
            set_cookie_headers = response.headers.get_list('Set-Cookie') if hasattr(response.headers, 'get_list') else [response.headers.get('Set-Cookie', '')]
            
            for set_cookie in set_cookie_headers:
                if set_cookie and 'oauth2v2_' in set_cookie:
                    token_match = re.search(r'oauth2v2_[a-f0-9]{32}', set_cookie)
                    if token_match:
                        new_token = token_match.group()
                        print(f"Found token in Set-Cookie: {new_token[:20]}...")
                        self.current_auth_token = new_token
                        self.visitor_topnav_gql_token = new_token
                        self.browser_cookies['UniversalSearchNuxt_vt'] = new_token
                        found_tokens = True
                        
                # Extract visitor ID from Set-Cookie
                visitor_match = re.search(r'visitor_id=([^;]+)', set_cookie) if set_cookie else None
                if visitor_match:
                    visitor_id = visitor_match.group(1)
                    print(f"Found visitor_id in Set-Cookie: {visitor_id}")
                    self.current_visitor_id = visitor_id
                    self.base_headers['Vnd-Eo-Visitorid'] = visitor_id
                    self.browser_cookies['visitor_id'] = visitor_id
                    found_tokens = True
                    
            # Method 3: Extract from HTML content (script tags, meta tags)
            if hasattr(response, 'text'):
                print("Extracting tokens from HTML content...")
                html_content = response.text
                
                # Look for tokens in script tags
                script_patterns = [
                    r'"oauth2v2_[a-f0-9]{32}"',
                    r"'oauth2v2_[a-f0-9]{32}'",
                    r'oauth2v2_[a-f0-9]{32}',
                    r'"visitor_id":\s*"([^"]+)"',
                    r"'visitor_id':\s*'([^']+)'",
                    r'visitor_id.*?([0-9.]+)',
                    r'UniversalSearchNuxt_vt.*?(oauth2v2_[a-f0-9]{32})',
                    r'visitorId.*?([0-9.]+)'
                ]
                
                for pattern in script_patterns:
                    matches = re.findall(pattern, html_content)
                    for match in matches:
                        if isinstance(match, tuple):
                            match = match[0] if match[0] else match[1] if len(match) > 1 else None
                        
                        if not match:
                            continue
                            
                        if 'oauth2v2_' in match:
                            clean_token = match.strip('"\'')
                            print(f"Found token in HTML: {clean_token[:20]}...")
                            self.current_auth_token = clean_token
                            self.visitor_topnav_gql_token = clean_token
                            self.browser_cookies['UniversalSearchNuxt_vt'] = clean_token
                            found_tokens = True
                            
                        elif match.replace('.', '').isdigit() and len(match) > 10:
                            print(f"Found visitor_id in HTML: {match}")
                            self.current_visitor_id = match
                            self.base_headers['Vnd-Eo-Visitorid'] = match
                            self.browser_cookies['visitor_id'] = match
                            found_tokens = True
                            
                # Look for window.__INITIAL_STATE__ or similar
                initial_state_pattern = r'window\.__INITIAL_STATE__\s*=\s*({.+?});'
                initial_state_match = re.search(initial_state_pattern, html_content, re.DOTALL)
                if initial_state_match:
                    try:
                        initial_state = json.loads(initial_state_match.group(1))
                        # Look for tokens in the initial state
                        def find_tokens_in_obj(obj, path=""):
                            if isinstance(obj, dict):
                                for key, value in obj.items():
                                    current_path = f"{path}.{key}" if path else key
                                    if isinstance(value, str) and 'oauth2v2_' in value:
                                        print(f"Found token in initial state at {current_path}: {value[:20]}...")
                                        self.current_auth_token = value
                                        self.visitor_topnav_gql_token = value
                                        self.browser_cookies['UniversalSearchNuxt_vt'] = value
                                        return True
                                    elif isinstance(value, (dict, list)):
                                        if find_tokens_in_obj(value, current_path):
                                            return True
                            elif isinstance(obj, list):
                                for i, item in enumerate(obj):
                                    if find_tokens_in_obj(item, f"{path}[{i}]"):
                                        return True
                            return False
                        
                        if find_tokens_in_obj(initial_state):
                            found_tokens = True
                            
                    except json.JSONDecodeError:
                        pass
                        
            return found_tokens
            
        except Exception as e:
            print(f"Error extracting tokens from response: {e}")
            return False

    def _refresh_tokens(self):
        """Enhanced token refresh with complete session bootstrap"""
        print("Refreshing tokens due to authorization failure...")
        
        # Method 1: Bootstrap completely fresh session
        print("Method 1: Bootstrapping fresh session...")
        if self._bootstrap_fresh_session():
            print("Fresh session bootstrap successful!")
            return True
        
        # Method 2: Extract from accessible pages
        print("Method 2: Extracting from accessible pages...")
        if self._extract_from_accessible_pages():
            print("Page extraction successful!")
            return True
        
        # Method 3: Try unauthenticated API endpoints
        print("Method 3: Trying unauthenticated API endpoints...")
        if self._try_unauthenticated_endpoints():
            print("Unauthenticated endpoint extraction successful!")
            return True
        
        # Method 4: Generate intelligent variations as last resort
        print("Method 4: Generating intelligent token variations...")
        return self._generate_intelligent_token_variations()

    def _extract_from_accessible_pages(self):
        """Extract tokens from pages that returned 200 status"""
        print("Trying accessible page extraction...")
        
        accessible_urls = [
            "https://www.upwork.com/nx/find-work/",
            "https://www.upwork.com/",
            "https://www.upwork.com/signup/",
            "https://www.upwork.com/ab/",
            "https://www.upwork.com/landing/"
        ]
        
        for url in accessible_urls:
            try:
                print(f"Accessing: {url}")
                
                # Create clean headers for page access
                page_headers = {
                    "User-Agent": self.base_headers["User-Agent"],
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br, zstd",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-Ch-Ua": self.base_headers["Sec-Ch-Ua"],
                    "Sec-Ch-Ua-Mobile": "?0",
                    "Sec-Ch-Ua-Platform": self.base_headers["Sec-Ch-Ua-Platform"],
                    "Cache-Control": "no-cache"
                }
                
                # Use minimal cookies for the request
                minimal_cookies = {
                    "country_code": "PK",
                    "cookie_domain": ".upwork.com"
                }
                
                response = self.scraper.get(
                    url,
                    headers=page_headers,
                    cookies=minimal_cookies,
                    timeout=30
                )
                
                print(f"Page response: {response.status_code}")
                
                if response.status_code == 200:
                    if self._extract_tokens_from_response(response):
                        print(f"Successfully extracted tokens from {url}")
                        return True
                        
                time.sleep(random.uniform(2, 4))
                
            except Exception as e:
                print(f"Failed to extract from {url}: {e}")
                continue
                
        return False

    def _try_unauthenticated_endpoints(self):
        """Try unauthenticated API endpoints for token extraction"""
        print("Trying unauthenticated endpoints...")
        
        endpoints = [
            "https://www.upwork.com/api/v4/visitor/stats",
            "https://www.upwork.com/api/v4/visitor/config",
            "https://www.upwork.com/api/visitor/bootstrap",
            "https://www.upwork.com/api/health",
            "https://www.upwork.com/nx/api/visitor/session"
        ]
        
        for endpoint in endpoints:
            try:
                print(f"Trying endpoint: {endpoint}")
                
                api_headers = {
                    "User-Agent": self.base_headers["User-Agent"],
                    "Accept": "application/json, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept-Encoding": "gzip, deflate, br, zstd",
                    "Connection": "keep-alive",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin"
                }
                
                response = self.scraper.get(
                    endpoint,
                    headers=api_headers,
                    timeout=15
                )
                
                print(f"Endpoint {endpoint} response: {response.status_code}")
                
                if response.status_code == 200:
                    if self._extract_tokens_from_response(response):
                        print(f"Successfully extracted tokens from {endpoint}")
                        return True
                        
                time.sleep(random.uniform(1, 3))
                
            except Exception as e:
                print(f"Failed endpoint {endpoint}: {e}")
                continue
                
        return False

    def _generate_intelligent_token_variations(self):
        """Generate intelligent variations of existing tokens using multiple algorithms"""
        try:
            print("Generating intelligent token variations...")
            
            if not self.current_auth_token or 'oauth2v2_' not in self.current_auth_token:
                print("No base token available for variation")
                return False
            
            base_token = self.current_auth_token.replace('oauth2v2_', '')
            current_time = int(time.time())
            
            # Method 1: Time-based variation (simulates token refresh)
            time_seed = f"{base_token}{current_time}"
            time_hash = hashlib.md5(time_seed.encode()).hexdigest()
            time_token = f"oauth2v2_{time_hash}"
            
            # Method 2: Visitor ID based variation
            visitor_seed = f"{self.current_visitor_id}{base_token[-16:]}"
            visitor_hash = hashlib.md5(visitor_seed.encode()).hexdigest()
            visitor_token = f"oauth2v2_{visitor_hash}"
            
            # Method 3: Session-based variation
            session_seed = f"{self.session_trace_id}{base_token[8:24]}"
            session_hash = hashlib.md5(session_seed.encode()).hexdigest()
            session_token = f"oauth2v2_{session_hash}"
            
            # Method 4: Incremental variation (slight modification)
            base_int = int(base_token[:8], 16)
            incremented = hex(base_int + random.randint(1, 1000))[2:].zfill(8)
            incremental_token = f"oauth2v2_{incremented}{base_token[8:]}"
            
            # Try each variation
            token_variations = [time_token, visitor_token, session_token, incremental_token]
            
            for i, new_token in enumerate(token_variations):
                print(f"Testing token variation {i + 1}: {new_token[:20]}...")
                
                # Update tokens
                self.current_auth_token = new_token
                self.visitor_topnav_gql_token = new_token
                self.browser_cookies['UniversalSearchNuxt_vt'] = new_token
                
                # Test the token with a simple request
                if self._test_token_validity(new_token):
                    print(f"Token variation {i + 1} is valid!")
                    return True
                
                time.sleep(random.uniform(1, 2))
            
            print("No valid token variations found")
            return False
                
        except Exception as e:
            print(f"Token variation generation failed: {e}")
            return False

    def _test_token_validity(self, token):
        """Test if a token is valid by making a simple request"""
        try:
            test_headers = self.base_headers.copy()
            test_headers['Authorization'] = f'Bearer {token}'
            
            # Simple test payload
            test_payload = {
                "query": "query { __typename }",
                "variables": {}
            }
            
            response = self.scraper.post(
                self.GRAPHQL_URL,
                headers=test_headers,
                cookies=self.browser_cookies,
                data=json.dumps(test_payload),
                timeout=10
            )
            
            # Consider it valid if we don't get auth errors
            return response.status_code not in [401, 403]
            
        except Exception:
            return False

    def _get_current_cookies(self):
        """Get current cookies with latest tokens"""
        # Update dynamic cookies before returning
        self._update_dynamic_cookies()
        return self.browser_cookies

    def _get_current_headers(self):
        """Get current headers with latest tokens and authorization"""
        headers = self.base_headers.copy()
        
        # Add authorization header
        if self.current_auth_token:
            headers['Authorization'] = f'Bearer {self.current_auth_token}'
            
        return headers

    def fetch_jobs(self, query="", limit=10, delay=True, filters=None):
        from .job_search import fetch_jobs
        import asyncio
        import sys
        
        # Since fetch_jobs is async, we need to run it
        # Check if we're on Windows and set the appropriate event loop policy
        if sys.platform == 'win32':
            try:
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            except:
                pass
        
        # Check if there's already a running event loop
        try:
            loop = asyncio.get_running_loop()
            # If we're here, there's already a loop running
            # We can't use asyncio.run() in this case
            # Instead, we need to create a task
            import nest_asyncio
            nest_asyncio.apply()
            return asyncio.run(fetch_jobs(self, query, limit, delay, filters))
        except RuntimeError:
            # No running loop, we can use asyncio.run()
            return asyncio.run(fetch_jobs(self, query, limit, delay, filters))

    def debug_job_ids(self, jobs_data):
        from .job_search import debug_job_ids
        return debug_job_ids(jobs_data)

    def _make_graphql_request(self, payload, method_name):
        from .job_search import make_graphql_request
        return make_graphql_request(self, payload, method_name)

    def _try_minimal_search(self, limit, delay):
        from .job_search import try_minimal_search
        return try_minimal_search(self, limit, delay)

    def _extract_jobs_from_response(self, data, method_name):
        from .job_search import extract_jobs_from_response
        return extract_jobs_from_response(data, method_name)

    def _save_jobs_to_db(self, jobs_data):
        from .db_saver import save_jobs_to_db
        return save_jobs_to_db(jobs_data)

    def get_token_status(self):
        """Get current token status for debugging"""
        return {
            "current_visitor_id": self.current_visitor_id[:20] + "..." if self.current_visitor_id else None,
            "current_auth_token": self.current_auth_token[:20] + "..." if self.current_auth_token else None,
            "visitor_topnav_gql_token": self.visitor_topnav_gql_token[:20] + "..." if self.visitor_topnav_gql_token else None,
            "session_trace_id": self.session_trace_id,
            "session_span_id": self.session_span_id[:20] + "..." if self.session_span_id else None,
            "extraction_url_index": self.current_extraction_url_index,
            "cookies_count": len(self.browser_cookies)
        }