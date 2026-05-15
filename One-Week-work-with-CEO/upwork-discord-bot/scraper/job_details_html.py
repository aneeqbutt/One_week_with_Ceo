# scraper/job_details_html.py
"""
Alternative job details fetching using HTML parsing instead of GraphQL API.
This should work better for public job information.
"""

import json
import os
import random
import re
import time
import cloudscraper
from bs4 import BeautifulSoup


def get_job_details_from_html(job_id, max_retries=3):
    """
    Fetch job details by scraping the job page HTML instead of using GraphQL API.
    This should work for public job information without OAuth permission issues.
    """
    print(f"[Job Details HTML] Fetching job details via HTML for: {job_id}")
    
    # Clean job ID
    if job_id.startswith("~"):
        clean_job_id = job_id[1:]
    else:
        clean_job_id = job_id
    
    # Construct job URL
    job_url = f"https://www.upwork.com/jobs/{clean_job_id}"
    print(f"[Job Details HTML] Job URL: {job_url}")
    
    # Load existing headers and cookies if available
    script_dir = os.path.dirname(os.path.abspath(__file__))
    headers_file = os.path.join(script_dir, "job_details_headers.json")
    cookies_file = os.path.join(script_dir, "job_details_cookies.json")
    
    headers = {}
    cookies = {}
    
    if os.path.exists(headers_file):
        try:
            with open(headers_file, 'r') as f:
                headers = json.load(f)
            print(f"[Job Details HTML] Loaded headers from {headers_file}")
        except Exception as e:
            print(f"[Job Details HTML] Failed to load headers: {e}")
    
    if os.path.exists(cookies_file):
        try:
            with open(cookies_file, 'r') as f:
                cookies = json.load(f)
            print(f"[Job Details HTML] Loaded cookies from {cookies_file}")
        except Exception as e:
            print(f"[Job Details HTML] Failed to load cookies: {e}")
    
    # Create cloudscraper session
    scraper = cloudscraper.create_scraper(
        browser={
            'browser': 'chrome',
            'platform': 'windows',
            'mobile': False
        }
    )
    
    # Set headers
    scraper.headers.update({
        'User-Agent': headers.get('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    })
    
    # Set cookies
    for name, value in cookies.items():
        scraper.cookies.set(name, value)
    
    for attempt in range(max_retries):
        try:
            print(f"[Job Details HTML] Making request (attempt {attempt + 1}/{max_retries})")
            
            response = scraper.get(job_url, timeout=30)
            
            print(f"[Job Details HTML] Response Status: {response.status_code}")
            
            if response.status_code == 200:
                return parse_job_html(response.text, job_id)
            elif response.status_code == 404:
                print(f"[Job Details HTML] Job not found (404)")
                return None
            elif response.status_code == 403:
                print(f"[Job Details HTML] Access forbidden (403)")
                return None
            else:
                print(f"[Job Details HTML] Unexpected status code: {response.status_code}")
                if attempt < max_retries - 1:
                    delay = 2 ** attempt + random.uniform(0.5, 1.5)
                    print(f"[Job Details HTML] Retrying in {delay:.1f} seconds...")
                    time.sleep(delay)
                    continue
                else:
                    return None
                    
        except Exception as e:
            print(f"[Job Details HTML] Request failed: {e}")
            if attempt < max_retries - 1:
                delay = 2 ** attempt + random.uniform(0.5, 1.5)
                print(f"[Job Details HTML] Retrying in {delay:.1f} seconds...")
                time.sleep(delay)
            else:
                return None
    
    return None


def parse_job_html(html_content, job_id):
    """Parse job details from HTML content"""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Initialize job details
        job_details = {
            "id": job_id,
            "title": "Unknown Title",
            "description": "No description available",
            "budget": "Not specified",
            "status": "Unknown",
            "posted_on": "Unknown",
            "skills": [],
            "total_applicants": 0,
            "category": "Unknown"
        }
        
        # Try to extract job title
        title_selectors = [
            'h1[data-test="job-title"]',
            'h1.job-title',
            'h1',
            '.job-header h1',
            '[data-test="job-title"]'
        ]
        
        for selector in title_selectors:
            title_element = soup.select_one(selector)
            if title_element:
                job_details["title"] = title_element.get_text().strip()
                print(f"[Job Details HTML] Found title: {job_details['title']}")
                break
        
        # Try to extract job description
        desc_selectors = [
            '[data-test="job-description"]',
            '.job-description',
            '.description',
            '[data-test="description"]'
        ]
        
        for selector in desc_selectors:
            desc_element = soup.select_one(selector)
            if desc_element:
                job_details["description"] = desc_element.get_text().strip()[:500]  # Limit length
                print(f"[Job Details HTML] Found description (length: {len(job_details['description'])})")
                break
        
        # Try to extract budget
        budget_selectors = [
            '[data-test="budget"]',
            '.budget',
            '[data-test="job-budget"]'
        ]
        
        for selector in budget_selectors:
            budget_element = soup.select_one(selector)
            if budget_element:
                job_details["budget"] = budget_element.get_text().strip()
                print(f"[Job Details HTML] Found budget: {job_details['budget']}")
                break
        
        # Try to extract skills
        skill_selectors = [
            '[data-test="skills"] a',
            '.skills a',
            '.job-skills a',
            '[data-test="skill-item"]'
        ]
        
        for selector in skill_selectors:
            skill_elements = soup.select(selector)
            if skill_elements:
                job_details["skills"] = [elem.get_text().strip() for elem in skill_elements]
                print(f"[Job Details HTML] Found skills: {job_details['skills']}")
                break
        
        # Try to extract category
        category_selectors = [
            '[data-test="job-category"]',
            '.job-category',
            '.category'
        ]
        
        for selector in category_selectors:
            category_element = soup.select_one(selector)
            if category_element:
                job_details["category"] = category_element.get_text().strip()
                print(f"[Job Details HTML] Found category: {job_details['category']}")
                break
        
        # Try to extract applicant count
        applicant_selectors = [
            '[data-test="proposals-count"]',
            '.proposals-count',
            '[data-test="applicants"]'
        ]
        
        for selector in applicant_selectors:
            applicant_element = soup.select_one(selector)
            if applicant_element:
                applicant_text = applicant_element.get_text().strip()
                # Extract number from text like "5 to 10 proposals"
                match = re.search(r'(\d+)', applicant_text)
                if match:
                    job_details["total_applicants"] = int(match.group(1))
                    print(f"[Job Details HTML] Found applicants: {job_details['total_applicants']}")
                break
        
        # Look for any JSON data in script tags (sometimes job data is embedded)
        script_tags = soup.find_all('script', type='application/json')
        for script in script_tags:
            try:
                script_data = json.loads(script.string)
                if isinstance(script_data, dict) and 'props' in script_data:
                    # This might contain job data
                    print(f"[Job Details HTML] Found JSON script data with keys: {list(script_data.keys())}")
                    # You could add more specific parsing here if needed
            except:
                continue
        
        print(f"[Job Details HTML] ✅ Successfully parsed job details from HTML")
        return job_details
        
    except Exception as e:
        print(f"[Job Details HTML] ❌ Error parsing HTML: {e}")
        import traceback
        traceback.print_exc()
        return {
            "id": job_id,
            "title": "Parse Error",
            "description": f"Error parsing HTML: {e}",
            "budget": "Unknown",
            "status": "Error",
            "posted_on": "Unknown",
            "skills": [],
            "total_applicants": 0,
            "category": "Unknown"
        }


if __name__ == "__main__":
    # Test the HTML parsing approach
    test_job_id = "~0140c36fa1e87afd2a"
    result = get_job_details_from_html(test_job_id)
    print("\n" + "="*60)
    print("HTML PARSING TEST RESULT:")
    print("="*60)
    if result:
        for key, value in result.items():
            print(f"{key}: {value}")
    else:
        print("No result returned")