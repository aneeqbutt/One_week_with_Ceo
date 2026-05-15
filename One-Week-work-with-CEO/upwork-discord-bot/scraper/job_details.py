# scraper/job_details.py
"""
Handles job details fetching and parsing for UpworkScraper with auto auth refresh.
"""

import json
import os
import time
import random
import re

# Global lock to prevent multiple simultaneous auth refreshes
_auth_refresh_lock = None
_last_auth_refresh_time = 0
AUTH_REFRESH_COOLDOWN = 300  # 5 minutes between refreshes

def _get_auth_lock():
    """Get or create the auth refresh lock"""
    global _auth_refresh_lock
    if _auth_refresh_lock is None:
        import threading
        _auth_refresh_lock = threading.Lock()
    return _auth_refresh_lock

def refresh_auth_credentials(force=False):
    """Refresh authentication by running the auth bot in a separate thread"""
    global _last_auth_refresh_time
    
    lock = _get_auth_lock()
    
    with lock:
        current_time = time.time()
        
        # Check cooldown to prevent spam refreshing
        if not force and current_time - _last_auth_refresh_time < AUTH_REFRESH_COOLDOWN:
            print(f"[Job Details] Skipping auth refresh - last refresh was {int(current_time - _last_auth_refresh_time)}s ago (use force=True to override)")
            return False
        
        print("[Job Details] ⚠️ 401 Error detected - refreshing authentication...")
        
        try:
            # Import the auth bot module
            import sys
            auth_bot_path = os.path.join(os.path.dirname(__file__),'authbot.py')
            
            if not os.path.exists(auth_bot_path):
                print(f"[Job Details] ❌ Auth bot not found at: {auth_bot_path}")
                return False
            
            import importlib.util
            spec = importlib.util.spec_from_file_location("authbot", auth_bot_path)
            authbot = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(authbot)
            
            # Run the auth refresh in a separate thread to avoid event loop conflicts
            print("[Job Details] Running auth bot in separate thread...")
            import concurrent.futures
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(authbot.get_upwork_headers)
                success = future.result(timeout=120)  # 2 minute timeout
            
            if success:
                _last_auth_refresh_time = current_time
                print("[Job Details] ✅ Authentication refreshed successfully!")
                time.sleep(2)  # Wait for files to be written
                return True
            else:
                print("[Job Details] ❌ Authentication refresh failed!")
                return False
                
        except concurrent.futures.TimeoutError:
            print("[Job Details] ❌ Auth refresh timed out!")
            return False
        except Exception as e:
            print(f"[Job Details] ❌ Error during auth refresh: {e}")
            import traceback
            traceback.print_exc()
            return False
def fetch_job_details(scraper, job_id, max_retries=2):
    """
    Fetch job details with automatic auth refresh on 401 errors
    """
    print(f"Fetching detailed information for job ID: {job_id}")
    clean_job_id = str(job_id).lstrip("~")
    # Allow dynamic override from last captured ID file if placeholder given
    if clean_job_id in ("TEST", "DYNAMIC", "0", ""):
        last_id_path = os.path.join(os.path.dirname(__file__), 'job_details_last_id.txt')
        if os.path.exists(last_id_path):
            try:
                with open(last_id_path, 'r') as lf:
                    dynamic_id = lf.read().strip()
                if dynamic_id:
                    print(f"[Job Details] Using dynamically captured job ID: {dynamic_id}")
                    clean_job_id = dynamic_id.lstrip('~')
            except Exception as e:
                print(f"[Job Details] ⚠️ Could not read dynamic job id: {e}")
    formatted_job_id = f"~{clean_job_id}"
    print(f"Using formatted job ID for API: {formatted_job_id}")

    for attempt in range(max_retries):
        try:
            # Load fresh headers and cookies for each attempt
            headers_file = os.path.join(os.path.dirname(__file__), 'job_details_headers.json')
            cookies_file = os.path.join(os.path.dirname(__file__), 'job_details_cookies.json')
            
            if not os.path.exists(headers_file):
                headers_file = os.path.join(os.path.dirname(__file__), 'headers_upwork.json')
            if not os.path.exists(cookies_file):
                cookies_file = os.path.join(os.path.dirname(__file__), 'upwork_cookies.json')

            # Load headers
            if not os.path.exists(headers_file):
                raise FileNotFoundError(f"Headers file not found: {headers_file}")
            
            with open(headers_file, "r") as f:
                headers = json.load(f)
                print(f"[Job Details] Loaded headers from {headers_file}")
                # Load cookies first so we can pass them to header enrichment
                if not os.path.exists(cookies_file):
                    print(f"[Job Details] Cookies file not found: {cookies_file}. Using no cookies.")
                    cookies = {}
                else:
                    try:
                        with open(cookies_file, "r") as f:
                            cookies = json.load(f)
                            print(f"[Job Details] Loaded cookies from {cookies_file}")
                            cookies = {k: str(v) for k, v in cookies.items()}
                    except (json.JSONDecodeError, Exception) as e:
                        print(f"[Job Details] Error loading cookies: {e}. Using no cookies.")
                        cookies = {}
                        
                # Enrich headers with cookie information for better compatibility
                from .authbot import _enrich_headers as _auth_enrich
                headers = _auth_enrich(headers, cookies, headers.get('Referer') or headers.get('referer') or 'https://www.upwork.com/')

            # Load cookies (already loaded above, but keep structure for clarity)
            if not cookies:  # Only reload if not already loaded
                if not os.path.exists(cookies_file):
                    print(f"[Job Details] Cookies file not found: {cookies_file}. Using no cookies.")
                    cookies = {}
                else:
                    try:
                        with open(cookies_file, "r") as f:
                            cookies = json.load(f)
                            print(f"[Job Details] Loaded cookies from {cookies_file}")
                            cookies = {k: str(v) for k, v in cookies.items()}
                    except (json.JSONDecodeError, Exception) as e:
                        print(f"[Job Details] Error loading cookies: {e}. Using no cookies.")
                        cookies = {}

            # Build the payload
            payload = get_simplified_job_details_query(formatted_job_id)

            # Make the request
            try:
                import cloudscraper
                # Always use Windows platform for better compatibility with Upwork
                session = cloudscraper.create_scraper(
                    browser={"browser": "chrome", "platform": "windows", "mobile": False}
                )
                print("[Job Details] Using cloudscraper with Windows platform")
            except ImportError:
                import requests
                session = requests.Session()
                print("[Job Details] Using standard requests session")

            url = "https://www.upwork.com/api/graphql/v1?alias=gql-query-get-visitor-job-details"
            print(f"[Job Details] Making API request (attempt {attempt + 1}/{max_retries})")
            
            resp = session.post(
                url,
                headers=headers,
                cookies=cookies,
                json=payload,
                timeout=30
            )
            
            print(f"[Job Details] Response Status: {resp.status_code}")
            if resp.status_code == 401:
                # Enhanced diagnostics for Ubuntu debugging
                print("[Job Details] 🔍 401 Error - Enhanced Diagnostics:")
                interesting = ['User-Agent','Accept','Origin','Referer','Content-Type','vnd-eo-visitorId','apollographql-client-name','sec-ch-ua-platform']
                print("[Job Details] 🔍 Sent headers (subset):")
                for k in interesting:
                    if k in headers:
                        value = headers[k]
                        if k == 'vnd-eo-visitorId' and len(str(value)) > 12:
                            value = str(value)[:12] + "..."
                        print(f"   {k}: {value}")
                missing = [k for k in interesting if k not in headers]
                if missing:
                    print(f"[Job Details] Missing candidate headers: {missing}")
                if cookies:
                    cookie_keys = list(cookies.keys())[:10]
                    visitor_cookies = [k for k in cookies.keys() if 'visitor' in k.lower()]
                    print(f"[Job Details] Cookie keys sample: {cookie_keys}")
                    if visitor_cookies:
                        print(f"[Job Details] Visitor cookies found: {visitor_cookies}")
                    else:
                        print("[Job Details] No visitor cookies found")
                else:
                    print("[Job Details] No cookies present in request")
                # Check for platform consistency
                ua = headers.get('User-Agent', '')
                platform = headers.get('sec-ch-ua-platform', '')
                print(f"[Job Details] Platform consistency check: UA='{ua[:50]}...', Platform='{platform}'")
            
            # Handle 401 - Authentication Error
            if resp.status_code == 401:
                print(f"[Job Details] ⚠️ 401 Authentication Error (attempt {attempt + 1}/{max_retries})")
                
                if attempt < max_retries - 1:  # Don't refresh on last attempt
                    print("[Job Details] Attempting to refresh authentication...")
                    
                    # Force refresh if visitorId missing in previous headers
                    need_force = 'vnd-eo-visitorId' not in headers
                    refresh_success = refresh_auth_credentials(force=need_force)
                    
                    if refresh_success:
                        print("[Job Details] ✅ Auth refreshed, retrying job details fetch...")
                        time.sleep(3)  # Wait before retry
                        continue  # Retry with new credentials
                    else:
                        print("[Job Details] ❌ Auth refresh failed")
                        # Continue to fallback response
                else:
                    print("[Job Details] ❌ Max retries reached, cannot refresh auth again")
                
                # Return fallback response
                return {
                    "id": job_id,
                    "title": "Authentication Required",
                    "description": "Unable to fetch job details due to authentication error. Please refresh credentials.",
                    "budget": "Not available",
                    "status": "Unknown",
                    "posted_on": "Unknown"
                }
            
            # Handle other non-200 responses
            if resp.status_code != 200:
                print(f"[Job Details] API request failed: {resp.status_code}")
                print(f"[Job Details] Response text: {resp.text[:500]}")
                
                if attempt < max_retries - 1:
                    print(f"[Job Details] Retrying...")
                    time.sleep(2)
                    continue
                
                return {
                    "id": job_id,
                    "title": "Job details temporarily unavailable",
                    "description": f"API request failed with status {resp.status_code}",
                    "budget": "Not available",
                    "status": "Unknown",
                    "posted_on": "Unknown"
                }
            
            # Parse successful response
            try:
                data = resp.json()
                print(f"[Job Details] JSON parsed successfully")
                
                if "errors" in data:
                    print(f"[Job Details] GraphQL errors found:")
                    for error in data["errors"]:
                        error_msg = error.get('message', 'Unknown error')
                        print(f"   - {error_msg}")
                    
                    if "data" not in data or not data["data"]:
                        return {
                            "id": job_id,
                            "title": "No title",
                            "description": "No description available",
                            "budget": "Not specified",
                            "currency_code": "USD",
                            "total_applicants": 0,
                            "total_hired": 0,
                            "skills": [],
                            "posted_on": "Unknown",
                            "category": ""
                        }
                
                job_details = extract_job_details_from_response(data)
                
                if job_details:
                    print(f"[Job Details] ✅ Successfully fetched detailed job information")
                    return job_details
                else:
                    print(f"[Job Details] ⚠️ No job details found in response")
                    return job_details
                    
            except json.JSONDecodeError as e:
                print(f"[Job Details] ❌ Failed to parse JSON: {e}")
                print(f"[Job Details] Response text: {resp.text[:500]}")
                
                if attempt < max_retries - 1:
                    continue
                
                return {
                    "id": job_id,
                    "title": "No title",
                    "description": f"Parse error: {e}",
                    "budget": "Not specified",
                    "currency_code": "USD",
                    "total_applicants": 0,
                    "total_hired": 0,
                    "skills": [],
                    "posted_on": "Unknown",
                    "category": ""
                }
                
        except Exception as e:
            print(f"[Job Details] ❌ Request exception: {e}")
            
            if attempt < max_retries - 1:
                print(f"[Job Details] Retrying after exception...")
                time.sleep(2)
                continue
            
            return {
                "id": job_id,
                "title": "No title",
                "description": f"Error: {e}",
                "budget": "Not specified",
                "currency_code": "USD",
                "total_applicants": 0,
                "total_hired": 0,
                "skills": [],
                "posted_on": "Unknown",
                "category": ""
            }
    
    # Should never reach here, but just in case
    return {
        "id": job_id,
        "title": "Error",
        "description": "Max retries exceeded",
        "budget": "Not available",
        "status": "Unknown",
        "posted_on": "Unknown"
    }

def get_simplified_job_details_query(job_id):
    return {
        "alias": "gql-query-get-visitor-job-details",
        "query": """query JobPubDetailsQuery($id: ID!) {\n                jobPubDetails(id: $id) {\n                    opening {\n                        status\n                        postedOn\n                        publishTime\n                        workload\n                        contractorTier\n                        description\n                        info {\n                            ciphertext\n                            id\n                            type\n                            title\n                            createdOn\n                            premium\n                        }\n                        sandsData {\n                            ontologySkills {\n                                id\n                                prefLabel\n                            }\n                            additionalSkills {\n                                id\n                                prefLabel\n                            }\n                        }\n                        category {\n                            name\n                        }\n                        categoryGroup {\n                            name\n                        }\n                        budget {\n                            amount\n                            currencyCode\n                        }\n                        engagementDuration {\n                            label\n                            weeks\n                        }\n                        extendedBudgetInfo {\n                            hourlyBudgetMin\n                            hourlyBudgetMax\n                            hourlyBudgetType\n                        }\n                        clientActivity {\n                            totalApplicants\n                            totalHired\n                            totalInvitedToInterview\n                            numberOfPositionsToHire\n                        }\n                        tools {\n                            name\n                        }\n                    }\n                    buyer {\n                        location {\n                            city\n                            country\n                            countryTimezone\n                        }\n                        stats {\n                            totalAssignments\n                            feedbackCount\n                            score\n                            totalJobsWithHires\n                            totalCharges {\n                                amount\n                                currencyCode\n                            }\n                            hoursCount\n                        }\n                        jobs {\n                            openCount\n                        }\n                    }\n                    qualifications {\n                        minJobSuccessScore\n                        minOdeskHours\n                        prefEnglishSkill\n                        risingTalent\n                        shouldHavePortfolio\n                    }\n                    buyerExtra {\n                        isPaymentMethodVerified\n                    }\n                }\n            }""",
        "variables": {
            "id": job_id
        }
    }

def extract_job_details_from_response(data):
    from datetime import datetime
    try:
        job_pub_details = data.get("data", {}).get("jobPubDetails", {})
        if not job_pub_details:
            print("[Job Details] No jobPubDetails found in response")
            return {
                "id": data.get("data", {}).get("id") or data.get("id", ""),
                "title": data.get("data", {}).get("title") or data.get("title", "No title"),
                "description": "No details available."
            }
        
        opening = job_pub_details.get("opening", {})
        buyer = job_pub_details.get("buyer", {})
        qualifications = job_pub_details.get("qualifications", {})
        buyer_extra = job_pub_details.get("buyerExtra", {})
        similar_jobs = job_pub_details.get("similarJobs", [])
        info = opening.get("info", {})
        extended_budget = opening.get("extendedBudgetInfo", {})
        client_activity = opening.get("clientActivity", {})
        category = opening.get("category", {})
        category_group = opening.get("categoryGroup", {})
        budget_info = opening.get("budget", {})
        engagement_duration = opening.get("engagementDuration", {})
        sands_data = opening.get("sandsData", {})
        buyer_location = buyer.get("location", {})
        buyer_stats = buyer.get("stats", {})
        buyer_company = buyer.get("company", {})
        buyer_jobs = buyer.get("jobs", {})
        
        # Handle total_charges
        total_charges = buyer_stats.get("totalCharges", {})
        client_total_spent_value = None
        if total_charges and isinstance(total_charges, dict):
            client_total_spent_value = total_charges.get("amount")
        
        # Extract skills
        skills = []
        additional_skills = sands_data.get("additionalSkills") or []
        for skill in additional_skills:
            if skill and skill.get("prefLabel"):
                skills.append(skill["prefLabel"])
        ontology_skills = sands_data.get("ontologySkills") or []
        for skill in ontology_skills:
            if skill and skill.get("prefLabel"):
                skills.append(skill["prefLabel"])
        
        # Format budget
        budget_display = "Not specified"
        hourly_min = extended_budget.get("hourlyBudgetMin")
        hourly_max = extended_budget.get("hourlyBudgetMax")
        budget_amount = budget_info.get("amount")
        try:
            if budget_amount and float(budget_amount) > 0:
                budget_display = f"${budget_amount:,.0f}"
            elif hourly_min and float(hourly_min) > 0:
                if hourly_max and float(hourly_max) > 0:
                    budget_display = f"${hourly_min}-${hourly_max}/hr"
                else:
                    budget_display = f"${hourly_min}+/hr"
        except Exception:
            pass
        
        # Format location
        client_location_str = "Not specified"
        if buyer_location.get("city") and buyer_location.get("country"):
            client_location_str = f"{buyer_location['city']}, {buyer_location['country']}"
        elif buyer_location.get("country"):
            client_location_str = buyer_location['country']
        
        # Format posted time
        posted_on = opening.get("postedOn", "")
        if posted_on:
            try:
                posted_date = datetime.fromisoformat(posted_on.replace('Z', '+00:00'))
                posted_time = posted_date.strftime("%Y-%m-%d %H:%M UTC")
            except:
                posted_time = posted_on
        else:
            posted_time = "Unknown"
        
        job_details = {
            "id": info.get("id"),
            "ciphertext": info.get("ciphertext"),
            "title": info.get("title"),
            "description": opening.get("description"),
            "status": opening.get("status"),
            "posted_on": posted_time,
            "publish_time": opening.get("publishTime"),
            "workload": opening.get("workload"),
            "contractor_tier": opening.get("contractorTier"),
            "job_type": info.get("type"),
            "budget": budget_display,
            "budget_amount": budget_amount,
            "hourly_budget_min": hourly_min,
            "hourly_budget_max": hourly_max,
            "budget_type": extended_budget.get("hourlyBudgetType"),
            "currency_code": budget_info.get("currencyCode"),
            "engagement_duration": engagement_duration.get("label"),
            "engagement_weeks": engagement_duration.get("weeks"),
            "deliverables": opening.get("deliverables"),
            "deadline": opening.get("deadline"),
            "category": category.get("name"),
            "category_group": category_group.get("name"),
            "skills": skills,
            "total_applicants": client_activity.get("totalApplicants"),
            "total_hired": client_activity.get("totalHired"),
            "total_interviewed": client_activity.get("totalInvitedToInterview"),
            "positions_to_hire": client_activity.get("numberOfPositionsToHire"),
            "client_location": client_location_str,
            "client_country": buyer_location.get("country"),
            "client_timezone": buyer_location.get("countryTimezone"),
            "client_total_assignments": buyer_stats.get("totalAssignments"),
            "client_active_assignments": buyer_stats.get("activeAssignmentsCount"),
            "client_hours": buyer_stats.get("hoursCount"),
            "client_feedback_count": buyer_stats.get("feedbackCount"),
            "client_rating": buyer_stats.get("score"),
            "client_total_jobs": buyer_stats.get("totalJobsWithHires"),
            "client_total_spent": client_total_spent_value,
            "client_open_jobs": buyer_jobs.get("openCount"),
            "client_industry": buyer_company.get("profile", {}).get("industry") if buyer_company.get("profile") else None,
            "client_company_size": buyer_company.get("profile", {}).get("size") if buyer_company.get("profile") else None,
            "payment_verified": buyer_extra.get("isPaymentMethodVerified"),
            "min_job_success_score": qualifications.get("minJobSuccessScore"),
            "min_hours": qualifications.get("minOdeskHours"),
            "min_hours_week": qualifications.get("minHoursWeek"),
            "english_requirement": qualifications.get("prefEnglishSkill"),
            "rising_talent": qualifications.get("risingTalent"),
            "portfolio_required": qualifications.get("shouldHavePortfolio"),
            "tools": [tool.get("name", "") for tool in opening.get("tools", [])],
            "similar_jobs_count": len(similar_jobs) if similar_jobs else None,
            "annotations": opening.get("annotations"),
            "segmentation_data": opening.get("segmentationData"),
            "qualifications": qualifications,
            "similar_jobs": similar_jobs[:5] if similar_jobs else []
        }
        
        return job_details
        
    except Exception as e:
        print(f"[Job Details] ❌ Error extracting job details: {e}")
        import traceback
        traceback.print_exc()
        return {
            "id": data.get("data", {}).get("id") or data.get("id", ""),
            "title": data.get("data", {}).get("title") or data.get("title", "No title"),
            "description": f"Error: {e}"
        }