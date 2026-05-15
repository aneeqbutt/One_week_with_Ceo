#!/usr/bin/env python3
"""
Test script to verify job details fetching with auth token
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from job_details import fetch_job_details

# Test with a sample job ID
test_job_id = "~0140c36fa1e87afd2a"  # Example format

print("=" * 60)
print("TESTING JOB DETAILS FETCH WITH AUTH TOKEN")
print("=" * 60)

# Mock scraper object (not actually used in fetch_job_details)
class MockScraper:
    pass

scraper = MockScraper()

try:
    result = fetch_job_details(scraper, test_job_id, max_retries=1)
    
    print("\n" + "=" * 60)
    print("RESULT:")
    print("=" * 60)
    
    if result:
        print(f"Title: {result.get('title', 'N/A')}")
        print(f"ID: {result.get('id', 'N/A')}")
        print(f"Description: {str(result.get('description', 'N/A'))[:100]}...")
        print(f"Budget: {result.get('budget', 'N/A')}")
        print(f"Status: {result.get('status', 'N/A')}")
        print(f"Posted: {result.get('posted_on', 'N/A')}")
        
        if result.get('title') == "Authentication Required":
            print("\n⚠️ Still getting auth errors - token may be expired")
        else:
            print("\n✅ Job details fetch successful!")
    else:
        print("❌ No result returned")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()