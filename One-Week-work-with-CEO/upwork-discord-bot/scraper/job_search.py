import asyncio
import random
import os

async def fetch_jobs(scraper, query, limit=100, delay=True, filters=None):
   
    from .graphql_payloads import VISITOR_JOB_SEARCH_QUERY, MINIMAL_VISITOR_JOB_SEARCH_QUERY
    
    print(f"Trying visitorJobSearch with query: '{query}'")
    
    # Apply default filters if none provided
    if not filters:
        filters = {}
    
    # Ensure payment verification is always required
    filters["payment_verified"] = True
    
    # Ensure experience level is intermediate or expert
    if "contractor_tier" not in filters:
        filters["contractor_tier"] = ["2", "3"]  # Intermediate and Expert
    
    if filters:
        print(f"  Filters applied: {filters}")
    
    scraper.base_headers['Referer'] = f"https://www.upwork.com/nx/search/jobs/?q={query}"
    
    # Build request variables
    request_vars = {
        "sort": "recency",
        "paging": {
            "offset": 0,
            "count": limit
        },
        "userQuery": query
    }
    
    # ADD FILTERS IF PROVIDED
    if filters:
        # Note: contractor_tier filtering is done in post-processing only
        # The visitor API doesn't support reliable contractor tier filtering
        if "contractor_tier" in filters and filters["contractor_tier"]:
            print(f"  - Contractor Tier: Will be filtered in post-processing")
        
        # Note: clientPaymentVerificationStatus is not supported by visitor API
        # Payment verification will be filtered in post-processing
        if "payment_verified" in filters and filters["payment_verified"]:
            print(f"  - Payment Verified: Will be filtered in post-processing")
        
        if "job_type" in filters and filters["job_type"]:
            # Map job types to Upwork's correct enum format
            job_type_map = {
                "hourly": "hourly",
                "fixed": "fixed"
            }
            request_vars["jobType"] = [
                job_type_map.get(jt.lower(), jt.lower()) 
                for jt in filters["job_type"]
            ]
            print(f"  - Job Types: {request_vars['jobType']}")
    
    graphql_payload = {
        "query": VISITOR_JOB_SEARCH_QUERY,
        "variables": {
            "requestVariables": request_vars
        }
    }
    
    if delay:
        await asyncio.sleep(2)
    
    jobs_data = await make_graphql_request(scraper, graphql_payload, "VisitorJobSearch")
    
    if jobs_data:
        debug_job_ids(jobs_data)
        # Apply filtering criteria
        filtered_jobs = filter_jobs_by_criteria(jobs_data, filters)
        return filtered_jobs
    
    print("First attempt failed, trying minimal search...")
    return await try_minimal_search(scraper, query, limit, delay, filters)

def debug_job_ids(jobs_data):
    # This function is already imported and used as a helper, so just return as is
    return jobs_data

def filter_jobs_by_criteria(jobs_data, filters=None):
    """
    Filter jobs based on specific criteria:
    - Payment verification required (checked if available in job data)
    - Experience level: intermediate (2) or expert (3) only
    - Exclude jobs with certain keywords in title, description, or skills
    """
    if not jobs_data:
        return jobs_data
    
    # Keywords to exclude (case-insensitive)
    excluded_keywords = ['n8n', 'hubspot']
    
    filtered_jobs = []
    excluded_count = 0
    
    for job in jobs_data:
        # Check payment verification if available in job data
        # Note: Visitor API may not provide this information
        if filters and filters.get("payment_verified"):
            payment_verified = job.get('client', {}).get('paymentVerified') if isinstance(job.get('client'), dict) else None
            if payment_verified is False:
                excluded_count += 1
                print(f"Excluded job '{job.get('title', 'Unknown')}' - Client payment not verified")
                continue
            # If payment_verified is None, we can't determine status, so we allow it through
        
        # Check experience level filter (must be intermediate or expert)
        experience_level = job.get('experience_level', '').lower()
        if experience_level not in ['2', '3', 'intermediate', 'expert', 'intermediatelevel', 'expertlevel']:
            excluded_count += 1
            print(f"Excluded job '{job.get('title', 'Unknown')}' - Experience level: {experience_level}")
            continue
        
        # Check for excluded keywords in title, description, and skills
        title = job.get('title', '').lower()
        description = job.get('description', '').lower()
        skills = [skill.lower() for skill in job.get('skills', [])]
        
        # Check if any excluded keyword appears in title, description, or skills
        should_exclude = False
        for keyword in excluded_keywords:
            if (keyword in title or 
                keyword in description or 
                any(keyword in skill for skill in skills)):
                excluded_count += 1
                print(f"Excluded job '{job.get('title', 'Unknown')}' - Contains keyword: {keyword}")
                should_exclude = True
                break
        
        if not should_exclude:
            filtered_jobs.append(job)
    
    print(f"Filtered jobs: {len(filtered_jobs)} kept, {excluded_count} excluded")
    return filtered_jobs

import json
async def make_graphql_request(scraper, payload, method_name):
    max_retries = 3
    retry_count = 0
    while retry_count < max_retries:
        try:
            scraper._generate_session_ids()
            response = scraper.scraper.post(
                scraper.GRAPHQL_URL,
                headers=scraper._get_current_headers(),
                cookies=scraper._get_current_cookies(),
                data=json.dumps(payload),
                timeout=30
            )
            print(f"{method_name} Response Status: {response.status_code}")
            if response.status_code in [401, 403]:
                print(f"Authentication error detected, refreshing tokens...")
                if retry_count < max_retries - 1:
                    success = scraper._refresh_tokens()
                    if success:
                        retry_count += 1
                        print(f"Retrying request with fresh tokens (attempt {retry_count + 1})")
                        await asyncio.sleep(random.uniform(3, 6))
                        continue
                    else:
                        print("Token refresh failed, using current tokens")
                        break
                else:
                    print("Max retries reached, request failed")
                    break
            if response.status_code != 200:
                print(f"API request failed: {response.status_code}")
                print(f"Response text: {response.text[:500]}")
                return []
            try:
                data = response.json()
                print(f"JSON parsed successfully")
                if "errors" in data:
                    print(f"GraphQL errors found:")
                    auth_error_found = False
                    for error in data["errors"]:
                        error_msg = error.get('message', 'Unknown error')
                        print(f"   - {error_msg}")
                        if any(keyword in error_msg.lower() for keyword in ["permission", "oauth", "unauthorized", "forbidden"]):
                            auth_error_found = True
                            print(f"GraphQL permission issue detected")
                    if auth_error_found and retry_count < max_retries - 1:
                        print("Attempting token refresh due to GraphQL auth error...")
                        success = scraper._refresh_tokens()
                        if success:
                            retry_count += 1
                            print(f"Retrying request with fresh tokens (attempt {retry_count + 1})")
                            await asyncio.sleep(random.uniform(3, 6))
                            continue
                    if "data" in data and data["data"]:
                        print(f"Has errors but also has data, attempting to parse...")
                    else:
                        return []
                jobs_data = extract_jobs_from_response(data, method_name)
                if jobs_data:
                    scraper._save_jobs_to_db(jobs_data)
                    print(f"Successfully fetched {len(jobs_data)} jobs from Upwork GraphQL.")
                    return jobs_data
                else:
                    print(f"No jobs found in response")
                return jobs_data
            except json.JSONDecodeError as e:
                print(f"Failed to parse JSON: {e}")
                print(f"Response text: {response.text[:500]}")
                return []
        except Exception as e:
            print(f"Request failed: {e}")
            await asyncio.sleep(random.uniform(2, 5))
            return []
    return []

async def try_minimal_search(scraper, query, limit, delay, filters=None):
    """
    Minimal search fallback - UPDATED to support filters
    """
    from .graphql_payloads import MINIMAL_VISITOR_JOB_SEARCH_QUERY
    
    # Apply default filters if none provided
    if not filters:
        filters = {}
    
    # Ensure payment verification is always required
    filters["payment_verified"] = True
    
    # Ensure experience level is intermediate or expert
    if "contractor_tier" not in filters:
        filters["contractor_tier"] = ["2", "3"]  # Intermediate and Expert
    
    # Build request variables with filters
    request_vars = {
        "sort": "recency",
        "paging": {
            "offset": 0,
            "count": limit
        },
        "userQuery": query
    }
    
    # Add filters if provided
    if filters:
        # Note: contractor_tier filtering is done in post-processing only
        # The visitor API doesn't support reliable contractor tier filtering
        if "contractor_tier" in filters and filters["contractor_tier"]:
            print(f"  - Contractor Tier: Will be filtered in post-processing")
        
        # Note: clientPaymentVerificationStatus is not supported by visitor API
        # Payment verification will be filtered in post-processing
        if "payment_verified" in filters and filters["payment_verified"]:
            print(f"  - Payment Verified: Will be filtered in post-processing")
        
        if "job_type" in filters and filters["job_type"]:
            job_type_map = {"hourly": "hourly", "fixed": "fixed"}
            request_vars["jobType"] = [
                job_type_map.get(jt.lower(), jt.lower()) 
                for jt in filters["job_type"]
            ]
    
    graphql_payload_minimal = {
        "query": MINIMAL_VISITOR_JOB_SEARCH_QUERY,
        "variables": {
            "requestVariables": request_vars
        }
    }
    
    if delay:
        await asyncio.sleep(random.uniform(2, 4))
    
    print(f"Testing minimal visitor search...")
    jobs_data = await make_graphql_request(scraper, graphql_payload_minimal, "MinimalSearch")
    
    if jobs_data:
        # Apply filtering criteria
        filtered_jobs = filter_jobs_by_criteria(jobs_data, filters)
        return filtered_jobs
    
    return jobs_data

def extract_jobs_from_response(data, method_name):
    import json
    jobs_data = []
    try:
        possible_paths = [
            ["data", "search", "universalSearchNuxt", "visitorJobSearchV1", "results"],
            ["search", "universalSearchNuxt", "visitorJobSearchV1", "results"],
            ["universalSearchNuxt", "visitorJobSearchV1", "results"],
            ["visitorJobSearchV1", "results"],
            ["results"]
        ]
        results = None
        for path in possible_paths:
            current = data
            try:
                for key in path:
                    current = current[key]
                if current:
                    results = current
                    print(f"Found jobs at path: {' -> '.join(path)}")
                    break
            except (KeyError, TypeError):
                continue
        if not results:
            print(f"No results found in response")
            print(f"Response structure: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
            return []
        print(f"Found {len(results)} job results")
        for i, job_result in enumerate(results):
            try:
                if not job_result:
                    print(f"Empty job result at index {i}")
                    continue
                if i == 0:
                    print(f"First job result structure:")
                    print(json.dumps(job_result, indent=2)[:1000])
                    print("Available fields:", list(job_result.keys()))
                job_tile = job_result.get("jobTile", {})
                job_details = job_tile.get("job", {}) if job_tile else {}
                job_ciphertext = job_details.get("ciphertext") or job_details.get("cipherText")
                fallback_id = job_result.get("id", f"job_{i}")
                job_id = job_ciphertext or job_details.get("id") or fallback_id
                if not job_id:
                    print(f"No valid job ID found for job at index {i}")
                    continue
                print(f"Job {i}: Using ID '{job_id}' (ciphertext: {bool(job_ciphertext)})")
                title = job_result.get("title", "No title")
                description = job_result.get("description", "No description")[:1000]
                job_type = job_details.get("jobType", "")
                hourly_min = job_details.get("hourlyBudgetMin")
                hourly_max = job_details.get("hourlyBudgetMax")
                fixed_price_info = job_details.get("fixedPriceAmount", {})
                fixed_price = fixed_price_info.get("amount") if fixed_price_info else None
                weekly_budget = job_details.get("weeklyRetainerBudget")
                budget_display = "Not specified"
                budget_numeric = 0.0
                try:
                    if fixed_price and float(fixed_price) > 0:
                        budget_display = f"${fixed_price}"
                        budget_numeric = float(fixed_price)
                    elif hourly_min and float(hourly_min) > 0:
                        if hourly_max and float(hourly_max) > 0:
                            budget_display = f"${hourly_min}-${hourly_max}/hr"
                        else:
                            budget_display = f"${hourly_min}+/hr"
                        budget_numeric = float(hourly_min)
                    elif weekly_budget and float(weekly_budget) > 0:
                        budget_display = f"${weekly_budget}/week"
                        budget_numeric = float(weekly_budget)
                except (ValueError, TypeError) as e:
                    print(f"Budget parsing error: {e}")
                    budget_display = "Not specified"
                    budget_numeric = 0.0
                create_time = job_details.get("createTime", "")
                contractor_tier = job_details.get("contractorTier", "")
                skills = job_result.get("ontologySkills", [])
                skill_names = [skill.get("prettyName", "") for skill in skills if skill.get("prettyName")]
                job_data = {
                    "id": job_id,
                    "title": title,
                    "description": description,
                    "createdDateTime": create_time,
                    "client": "Unknown",
                    "budget": budget_display,
                    "budget_numeric": budget_numeric,
                    "total_applicants": 0,
                    "amount": fixed_price,
                    "hourly_min": hourly_min,
                    "hourly_max": hourly_max,
                    "weekly_budget": weekly_budget,
                    "duration": None,
                    "duration_label": None,
                    "engagement": job_type,
                    "experience_level": contractor_tier,
                    "applied": False,
                    "category": ", ".join(skill_names[:3]),
                    "job_type": job_type,
                    "skills": skill_names
                }
                jobs_data.append(job_data)
            except Exception as e:
                print(f"Error parsing job at index {i}: {e}")
                continue
    except Exception as e:
        print(f"Error extracting jobs: {e}")
    return jobs_data
