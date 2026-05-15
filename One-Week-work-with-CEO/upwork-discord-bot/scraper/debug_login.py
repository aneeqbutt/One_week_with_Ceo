#!/usr/bin/env python3
"""Debug script to examine Upwork login page structure"""

import cloudscraper
import re
from bs4 import BeautifulSoup

def debug_login_page():
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True}
    )
    
    print("Fetching login page...")
    resp = scraper.get("https://www.upwork.com/ab/account-security/login", timeout=20)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        content = resp.text
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        
        # Find all forms
        forms = soup.find_all('form')
        print(f"\nFound {len(forms)} forms:")
        
        for i, form in enumerate(forms, 1):
            print(f"\n=== Form {i} ===")
            print(f"Action: {form.get('action', 'No action')}")
            print(f"Method: {form.get('method', 'GET')}")
            
            # Find all input fields
            inputs = form.find_all('input')
            print(f"Inputs ({len(inputs)}):")
            for inp in inputs:
                name = inp.get('name', 'no-name')
                input_type = inp.get('type', 'text')
                value = inp.get('value', '')
                placeholder = inp.get('placeholder', '')
                print(f"  - {name} ({input_type}): value='{value}' placeholder='{placeholder}'")
        
        # Look for CSRF tokens in various formats
        print("\n=== CSRF Token Search ===")
        csrf_patterns = [
            r'name="_token"\s+value="([^"]+)"',
            r'"_token":"([^"]+)"',
            r'csrf_token["\']:\s*["\']([^"\']+)["\']',
            r'_token["\']:\s*["\']([^"\']+)["\']',
            r'<meta\s+name="csrf-token"\s+content="([^"]+)"',
            r'window\.csrfToken\s*=\s*["\']([^"\']+)["\']',
            r'data-csrf-token="([^"]+)"',
        ]
        
        for pattern in csrf_patterns:
            match = re.search(pattern, content)
            if match:
                print(f"Found CSRF token: {match.group(1)[:20]}...")
                break
        else:
            print("No CSRF token found")
        
        # Look for any JavaScript that might handle login
        scripts = soup.find_all('script')
        print(f"\n=== Script Analysis ({len(scripts)} scripts) ===")
        for script in scripts:
            if script.string and ('login' in script.string.lower() or 'csrf' in script.string.lower()):
                print(f"Login-related script found: {script.string[:200]}...")
        
        # Save the page for manual inspection
        with open('login_page_debug.html', 'w', encoding='utf-8') as f:
            f.write(content)
        print("\nSaved login page to 'login_page_debug.html' for manual inspection")

if __name__ == "__main__":
    debug_login_page()