#!/usr/bin/env python3
"""
Test script to verify Ubuntu authentication fixes
"""

import sys
import os
import json
import importlib.util

def test_ubuntu_auth():
    """Test authentication on Ubuntu"""
    print("=" * 60)
    print("TESTING UBUNTU AUTHENTICATION FIXES")
    print("=" * 60)
    
    try:
        # Get the authbot module path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        scraper_dir = os.path.join(script_dir, 'scraper')
        authbot_path = os.path.join(scraper_dir, 'authbot.py')
        
        if not os.path.exists(authbot_path):
            print(f"❌ Authbot module not found: {authbot_path}")
            return False
        
        # Import authbot module dynamically
        spec = importlib.util.spec_from_file_location("authbot", authbot_path)
        if spec is None or spec.loader is None:
            print("❌ Failed to create module spec for authbot")
            return False
            
        authbot = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(authbot)
        print("✅ Successfully imported authbot module")
        
        print("\n1. Testing header capture...")
        success = authbot.get_upwork_headers()
        
        if success:
            print("\n2. Testing header verification...")
            if authbot.verify_headers():
                print("\n3. Checking for visitor ID in headers...")
                headers_file = os.path.join(scraper_dir, "headers_upwork.json")
                
                if os.path.exists(headers_file):
                    with open(headers_file, 'r') as f:
                        headers = json.load(f)
                    
                    visitor_id = headers.get('vnd-eo-visitorId')
                    if visitor_id:
                        print(f"✅ Visitor ID found: {visitor_id[:12]}... (length: {len(visitor_id)})")
                        print("✅ Ubuntu authentication should now work!")
                        return True
                    else:
                        print("❌ No visitor ID found in headers")
                        print("Available headers:", list(headers.keys()))
                        return False
                else:
                    print("❌ Headers file not found")
                    return False
            else:
                print("❌ Header verification failed")
                return False
        else:
            print("❌ Header capture failed")
            return False
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_ubuntu_auth()
    sys.exit(0 if success else 1)