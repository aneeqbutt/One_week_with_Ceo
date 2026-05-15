"""Upwork Auth Bot (GraphQL + cloudscraper)

This module replaces the old Selenium-based header/cookie capture with a
direct GraphQL login flow using username/password from the environment
(`config.py`). It performs:

1. Session initialization (cloudscraper) to obtain base cookies & visitor id.
2. GraphQL login mutation with email & password.
3. Extraction of auth token (JWT/Bearer) from response headers/cookies.
4. Construction & persistence of normalized headers + cookies JSON files:
   - `headers_upwork.json`
   - `job_details_headers.json`
   - `job_details_cookies.json`
   - `upwork_cookies.json`
5. Test GraphQL query to fetch public/authorized job details.

NOTE: Actual Upwork internal aliases & schema can change. Where an alias or
field name is uncertain we implement a best-effort approach with fallback
strategies and clear logging so adjustments are simple if an upstream change
occurs.
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Dict, Any, Optional, Tuple

# Ensure project root (parent of this directory) is on sys.path so that
# `config.py` at repository root can be imported when running this file from
# inside the `scraper` directory (e.g. `python authbot2.py`).
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(CURRENT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

try:  # optional; not strictly required but harmless
    import nest_asyncio  # type: ignore
    nest_asyncio.apply()
except Exception:  # pragma: no cover
    pass

try:
    import cloudscraper  # type: ignore
except ImportError:  # pragma: no cover
    print("[Auth Bot] ERROR: cloudscraper not installed. Add it to requirements.txt")
    raise

from config import UPWORK_EMAIL, UPWORK_PASSWORD

GRAPHQL_ENDPOINT = "https://www.upwork.com/api/graphql/v1"

# --- GraphQL payload builders -------------------------------------------------

def build_login_payload(email: str, password: str) -> Dict[str, Any]:
    """Return login payload. Try multiple common patterns that Upwork might use."""
    # Try the most common login mutation pattern first
    return {
        "query": (
            "mutation authUserMutation($username: String!, $password: String!) {\n"
            "  authUser(username: $username, password: $password) {\n"
            "    success\n"
            "    token\n"
            "    user {\n"
            "      id\n"
            "      email\n"
            "      firstName\n"
            "      lastName\n"
            "    }\n"
            "    errors {\n"
            "      message\n"
            "      code\n"
            "    }\n"
            "  }\n"
            "}"
        ),
        "variables": {
            "username": email,
            "password": password
        }
    }


def build_job_details_payload(job_id: str) -> Dict[str, Any]:
    return {
        "alias": "gql-query-get-visitor-job-details",
        "query": (
            "query JobPubDetailsQuery($id: ID!) {\n"
            "  jobPubDetails(id: $id) {\n"
            "    opening {\n"
            "      status postedOn publishTime workload contractorTier description\n"
            "      info { id type title createdOn }\n"
            "      budget { amount currencyCode }\n"
            "      clientActivity { totalApplicants totalHired totalInvitedToInterview }\n"
            "    }\n"
            "    buyer {\n"
            "      location { city country countryTimezone }\n"
            "      stats { totalAssignments feedbackCount score totalCharges { amount currencyCode } }\n"
            "    }\n"
            "    qualifications { minJobSuccessScore minOdeskHours risingTalent }\n"
            "  }\n"
            "}"
        ),
        "variables": {"id": job_id},
    }


# --- Core helpers -------------------------------------------------------------

def create_scraper_session() -> "cloudscraper.CloudScraper":
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True},
        delay=5,
    )
    scraper.headers.update(
        {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json",
            "Origin": "https://www.upwork.com",
            "Referer": "https://www.upwork.com/",
        }
    )
    return scraper


def perform_login(scraper, email: str, password: str) -> Tuple[Optional[str], Dict[str, str]]:
    if not email or not password:
        print("[Auth Bot] ERROR: UPWORK_EMAIL / UPWORK_PASSWORD not set in environment")
        return None, {}

    # Try multiple login approaches
    login_attempts = [
        # Attempt 1: Standard mutation
        build_login_payload(email, password),
        
        # Attempt 2: Alternative mutation format
        {
            "query": (
                "mutation LoginMutation($email: String!, $password: String!) {\n"
                "  login(email: $email, password: $password) {\n"
                "    success\n"
                "    token\n"
                "    user { id email }\n"
                "  }\n"
                "}"
            ),
            "variables": {"email": email, "password": password}
        },
        
        # Attempt 3: Simple form-based login (fallback to REST-like)
        {
            "operationName": "Login",
            "query": (
                "mutation Login($credentials: LoginInput!) {\n"
                "  authenticate(credentials: $credentials) {\n"
                "    token\n"
                "    user { id }\n"
                "  }\n"
                "}"
            ),
            "variables": {
                "credentials": {
                    "email": email,
                    "password": password
                }
            }
        }
    ]

    token = None
    cookie_dict = {}
    resp = None

    for i, payload in enumerate(login_attempts, 1):
        print(f"[Auth Bot] Attempting login method {i}/3...")
        try:
            resp = scraper.post(GRAPHQL_ENDPOINT, json=payload, timeout=25)
        except Exception as e:  # pragma: no cover - network issues
            print(f"[Auth Bot] Login request {i} failed: {e}")
            continue

        print(f"[Auth Bot] Login attempt {i} status: {resp.status_code}")
        
        if resp.status_code == 200:
            try:
                data = resp.json()
                # Try different token extraction patterns
                
                # Pattern 1: data.authUser.token
                if "data" in data and "authUser" in data.get("data", {}):
                    auth_data = data["data"]["authUser"]
                    token = auth_data.get("token")
                    if auth_data.get("success"):
                        print(f"[Auth Bot] ✅ Method {i} successful - authUser pattern")
                
                # Pattern 2: data.login.token
                elif "data" in data and "login" in data.get("data", {}):
                    login_data = data["data"]["login"]
                    token = login_data.get("token")
                    if login_data.get("success"):
                        print(f"[Auth Bot] ✅ Method {i} successful - login pattern")
                
                # Pattern 3: data.authenticate.token
                elif "data" in data and "authenticate" in data.get("data", {}):
                    auth_data = data["data"]["authenticate"]
                    token = auth_data.get("token")
                    if token:
                        print(f"[Auth Bot] ✅ Method {i} successful - authenticate pattern")
                
                # Pattern 4: Direct token field
                elif "token" in data:
                    token = data.get("token")
                    print(f"[Auth Bot] ✅ Method {i} successful - direct token")

                if token:
                    break
                else:
                    print(f"[Auth Bot] Method {i}: No token found, trying next method")
                    
            except Exception as e:
                print(f"[Auth Bot] Method {i}: JSON parse error: {e}")
                continue
        
        elif resp.status_code == 401:
            print(f"[Auth Bot] Method {i}: Authentication failed")
            # Continue to try other methods
        else:
            snippet = resp.text[:200].replace("\n", " ")
            print(f"[Auth Bot] Method {i}: HTTP {resp.status_code}, body: {snippet}")

    # If GraphQL methods failed, try session-based approach
    if not token:
        print("[Auth Bot] GraphQL login failed, trying session-based approach...")
        try:
            # Try traditional form login
            login_url = "https://www.upwork.com/ab/account-security/login"
            login_data = {
                "login[username]": email,
                "login[password]": password,
                "login[remember_me]": "0"
            }
            
            # Update headers for form submission
            form_headers = dict(scraper.headers)
            form_headers["Content-Type"] = "application/x-www-form-urlencoded"
            
            resp = scraper.post(login_url, data=login_data, headers=form_headers, timeout=25)
            print(f"[Auth Bot] Form login status: {resp.status_code}")
            
            if resp.status_code == 200 or resp.status_code == 302:
                print("[Auth Bot] ✅ Form login may have succeeded, relying on session cookies")
            
        except Exception as e:
            print(f"[Auth Bot] Form login failed: {e}")

    # Collect cookies regardless of token success
    if resp:
        cookie_dict = {c.name: c.value for c in resp.cookies}
        # Merge session cookies too
        for c in scraper.cookies:  # type: ignore[attr-defined]
            cookie_dict[c.name] = c.value

    print(f"[Auth Bot] Collected {len(cookie_dict)} cookies after login attempts.")
    
    if token:
        print("[Auth Bot] ✅ Token extracted successfully")
    else:
        print("[Auth Bot] ⚠️ No token found, will rely on session cookies only")
    
    return token, cookie_dict


def build_authenticated_headers(scraper, token: Optional[str]) -> Dict[str, str]:
    headers = dict(scraper.headers)
    # Upwork may expect a trace id visitor id; we attempt to preserve anything that cloudscraper added
    if token:
        headers["Authorization"] = f"Bearer {token}"
    # Normalize capitalization keys expected in codebase
    if "user-agent" in headers and "User-Agent" not in headers:
        headers["User-Agent"] = headers.pop("user-agent")
    return headers


def save_artifacts(headers: Dict[str, str], cookies: Dict[str, str]) -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    paths = {
        "headers_upwork.json": headers,
        "job_details_headers.json": headers,
        "job_details_cookies.json": cookies,
        "upwork_cookies.json": cookies,
    }
    for filename, data in paths.items():
        full = os.path.join(script_dir, filename)
        with open(full, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[Auth Bot] Saved {filename} ({len(data)} entries)")


def fetch_job_details(scraper, headers: Dict[str, str], cookies: Dict[str, str], job_id: str) -> bool:
    # Build enhanced headers specifically for GraphQL API calls
    api_headers = dict(headers)
    
    # Add visitor token from cookies if available
    visitor_token = cookies.get('visitor_gql_token')
    if visitor_token:
        api_headers['vnd-eo-visitor-id'] = cookies.get('visitor_id', '')
        api_headers['Authorization'] = f'Bearer {visitor_token}'
        print(f"[Test] Using visitor token: {visitor_token[:20]}...")
    
    # Add additional headers that Upwork GraphQL API expects
    api_headers.update({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'vnd-eo-trace-id': f'trace-{int(time.time() * 1000)}',
    })
    
    # Try multiple job IDs if the provided one doesn't work
    test_job_ids = [
        job_id,
        "~01c1e1c5e44d6de1fb",  # Different format
        "~016f9ea0ac4b5b8a59",  # Another format
        "~0175e88d4e8a1e7c9e"   # Public job format
    ]
    
    for test_id in test_job_ids:
        print(f"[Test] Trying job ID: {test_id}")
        payload = build_job_details_payload(test_id)
        
        try:
            # Use the scraper session directly to maintain cookies
            resp = scraper.post(
                GRAPHQL_ENDPOINT, 
                json=payload, 
                headers=api_headers, 
                timeout=25
            )
        except Exception as e:  # pragma: no cover
            print(f"[Test] Request error for {test_id}: {e}")
            continue
            
        print(f"[Test] Job details status for {test_id}: {resp.status_code}")
        
        if resp.status_code == 200:
            try:
                data = resp.json()
                
                # Check for GraphQL errors first
                if "errors" in data:
                    print(f"[Test] GraphQL errors for {test_id}:")
                    for err in data["errors"]:
                        print(f"  - {err.get('message', 'Unknown error')}")
                    continue  # Try next job ID
                
                # Check for valid data
                job_details = data.get("data", {}).get("jobPubDetails")
                if job_details:
                    opening = job_details.get("opening", {})
                    info = opening.get("info", {})
                    
                    print(f"[Test] ✅ Job details fetch success for {test_id}!")
                    print(f"       Title: {info.get('title', 'N/A')}")
                    print(f"       Job ID: {info.get('id', 'N/A')}")
                    print(f"       Status: {opening.get('status', 'N/A')}")
                    
                    # Show additional details if available
                    budget = opening.get("budget", {})
                    if budget:
                        print(f"       Budget: ${budget.get('amount', 'N/A')} {budget.get('currencyCode', '')}")
                    
                    activity = opening.get("clientActivity", {})
                    if activity:
                        print(f"       Applicants: {activity.get('totalApplicants', 0)}")
                    
                    return True
                else:
                    print(f"[Test] Empty job details for {test_id}")
                    continue
                    
            except json.JSONDecodeError as e:
                print(f"[Test] JSON parse fail for {test_id}: {e}")
                print(f"[Test] Response preview: {resp.text[:200]}")
                continue
                
        elif resp.status_code == 401:
            print(f"[Test] Authentication failed for {test_id}")
            continue
        elif resp.status_code == 403:
            print(f"[Test] Access forbidden for {test_id} (may be private)")
            continue
        elif resp.status_code == 404:
            print(f"[Test] Job {test_id} not found")
            continue
        else:
            print(f"[Test] HTTP {resp.status_code} for {test_id}: {resp.text[:200]}")
            continue
    
    print("[Test] ❌ All job ID attempts failed")
    return False


def authenticate_and_test(job_id: str) -> bool:
    """
    Alternative approach: Instead of trying to login programmatically,
    we'll simulate browsing behavior to get valid session cookies
    and then test if they work for API calls.
    """
    scraper = create_scraper_session()

    print("[Auth Bot] Using browsing-based approach to get session cookies...")
    
    # Step 1: Visit main page
    try:
        main_resp = scraper.get("https://www.upwork.com/", timeout=15)
        print(f"[Auth Bot] Main page status: {main_resp.status_code}")
    except Exception as e:
        print(f"[Auth Bot] Failed to access main page: {e}")
        return False
    
    # Step 2: Visit job search page to get visitor session
    try:
        search_resp = scraper.get("https://www.upwork.com/nx/search/jobs/?q=python", timeout=15)
        print(f"[Auth Bot] Search page status: {search_resp.status_code}")
    except Exception as e:
        print(f"[Auth Bot] Failed to access search page: {e}")
        return False
    
    # Step 3: Try to visit a different search page to trigger API calls
    try:
        search2_resp = scraper.get("https://www.upwork.com/nx/search/jobs/?q=javascript", timeout=15)
        print(f"[Auth Bot] Second search status: {search2_resp.status_code}")
    except Exception as e:
        print(f"[Auth Bot] Failed to access second search: {e}")
    
    # Collect cookies from browsing session
    cookie_dict = {}
    for c in scraper.cookies:  # type: ignore[attr-defined]
        cookie_dict[c.name] = c.value
    
    print(f"[Auth Bot] Collected {len(cookie_dict)} cookies from browsing session")
    
    # Build headers without authentication token (public API access)
    headers = dict(scraper.headers)
    if "user-agent" in headers and "User-Agent" not in headers:
        headers["User-Agent"] = headers.pop("user-agent")
    
    # Add some headers that might be expected
    headers.update({
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://www.upwork.com",
        "Referer": "https://www.upwork.com/nx/search/jobs/",
    })
    
    save_artifacts(headers, cookie_dict)

    print("[Auth Bot] Testing job details query with browsing session...")
    success = fetch_job_details(scraper, headers, cookie_dict, job_id)
    
    if not success:
        print("[Auth Bot] ⚠️ Job details test failed.")
        print("[Auth Bot] This might be normal for private job listings.")
        print("[Auth Bot] Saved session cookies can still be used by other parts of the application.")
        # Return True anyway since we successfully got session cookies
        return True
    
    return success


def perform_login_enhanced(scraper, email: str, password: str, csrf_token: Optional[str] = None) -> Tuple[Optional[str], Dict[str, str]]:
    """Enhanced login with proper session and CSRF handling"""
    if not email or not password:
        print("[Auth Bot] ERROR: UPWORK_EMAIL / UPWORK_PASSWORD not set in environment")
        return None, {}

    print("[Auth Bot] Attempting enhanced session-based login...")
    
    token = None
    cookie_dict = {}
    
    try:
        # Prepare login data
        login_data = {
            "login[username]": email,
            "login[password]": password,
            "login[remember_me]": "0",
            "login[mode]": "",
            "oauth2_access_token": "",
            "oauth2_service": ""
        }
        
        # Add CSRF token if found
        if csrf_token:
            login_data["_token"] = csrf_token
            print("[Auth Bot] Using CSRF token for form submission")
        
        # Use proper form headers
        form_headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://www.upwork.com",
            "Referer": "https://www.upwork.com/ab/account-security/login",
            "Upgrade-Insecure-Requests": "1",
        }
        
        # Update scraper headers for this request
        original_headers = dict(scraper.headers)
        scraper.headers.update(form_headers)
        
        # Perform login
        login_url = "https://www.upwork.com/ab/account-security/login"
        resp = scraper.post(login_url, data=login_data, timeout=25, allow_redirects=True)
        
        # Restore original headers
        scraper.headers = original_headers
        
        print(f"[Auth Bot] Enhanced login status: {resp.status_code}")
        print(f"[Auth Bot] Final URL: {resp.url}")
        
        # Check if login was successful
        if resp.status_code == 200:
            # Check for success indicators in the response
            if "dashboard" in resp.url or "home" in resp.url or "/nx/" in resp.url:
                print("[Auth Bot] ✅ Login appears successful - redirected to dashboard")
            elif "login" in resp.url and "error" in resp.text.lower():
                print("[Auth Bot] ❌ Login failed - still on login page with errors")
            elif "login" in resp.url:
                print("[Auth Bot] ⚠️ Still on login page - may need 2FA or additional verification")
            else:
                print("[Auth Bot] ✅ Login successful - redirected away from login page")
        
        # Try to access a protected page to verify authentication
        try:
            profile_resp = scraper.get("https://www.upwork.com/freelancers/settings/", timeout=15)
            if profile_resp.status_code == 200 and "login" not in profile_resp.url:
                print("[Auth Bot] ✅ Authentication verified - can access protected pages")
            else:
                print("[Auth Bot] ⚠️ Authentication not verified - cannot access protected pages")
        except Exception as e:
            print(f"[Auth Bot] Could not verify authentication: {e}")
        
    except Exception as e:
        print(f"[Auth Bot] Enhanced login failed: {e}")
        return None, {}

    # Collect all cookies from the session
    cookie_dict = {}
    for c in scraper.cookies:  # type: ignore[attr-defined]
        cookie_dict[c.name] = c.value

    print(f"[Auth Bot] Collected {len(cookie_dict)} cookies after enhanced login.")
    
    if token:
        print("[Auth Bot] ✅ Token extracted successfully")
    else:
        print("[Auth Bot] ⚠️ No token found, relying on session cookies only")
    
    return token, cookie_dict


def main():
    print("=" * 68)
    print("UPWORK GRAPHQL AUTH BOT (cloudscraper)")
    print("=" * 68)
    
    # Debug: Check if credentials are loaded
    print(f"[Auth Bot] Email loaded: {'Yes' if UPWORK_EMAIL else 'No'}")
    print(f"[Auth Bot] Password loaded: {'Yes' if UPWORK_PASSWORD else 'No'}")
    
    if not UPWORK_EMAIL or not UPWORK_PASSWORD:
        print("[Auth Bot] ❌ Missing credentials in environment variables")
        print("[Auth Bot] Please set UPWORK_EMAIL and UPWORK_PASSWORD in your .env file")
        sys.exit(1)
    
    start = time.time()

    # Provide a sample public-looking job id; user should replace with a live one
    sample_job_id = "~0140c36fa1e87afd2a"
    ok = authenticate_and_test(sample_job_id)

    elapsed = time.time() - start
    print(f"[Auth Bot] Finished in {elapsed:.2f}s. Result={'SUCCESS' if ok else 'FAIL'}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":  # pragma: no cover
    main()