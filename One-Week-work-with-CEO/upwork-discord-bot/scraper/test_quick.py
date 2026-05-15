#!/usr/bin/env python3
"""
Quick test script for Ubuntu server to verify the authbot fixes
"""

import sys
import os

# Add the current directory to the path so we can import authbot
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_import():
    """Test that we can import the modules"""
    try:
        from seleniumbase import SB
        print("✅ SeleniumBase import successful")
        return True
    except ImportError as e:
        print(f"❌ SeleniumBase import failed: {e}")
        return False

def test_minimal_firefox():
    """Test a minimal Firefox instance"""
    try:
        from seleniumbase import SB
        print("Testing minimal Firefox instance...")
        
        with SB(uc=False, test=True, headless=True, browser="firefox") as sb:
            print("✅ Firefox browser started successfully")
            sb.open("https://httpbin.org/ip")
            print("✅ Navigation successful")
            page_source = sb.get_page_source()
            if len(page_source) > 100:
                print("✅ Page content loaded")
                return True
            else:
                print("⚠️ Page content seems empty")
                return False
                
    except Exception as e:
        print(f"❌ Firefox test failed: {e}")
        return False

def test_minimal_chrome():
    """Test a minimal Chrome instance"""
    try:
        from seleniumbase import SB
        print("Testing minimal Chrome instance...")
        
        with SB(uc=False, test=True, headless=True, browser="chrome") as sb:
            print("✅ Chrome browser started successfully")
            sb.open("https://httpbin.org/ip")
            print("✅ Navigation successful")
            page_source = sb.get_page_source()
            if len(page_source) > 100:
                print("✅ Page content loaded")
                return True
            else:
                print("⚠️ Page content seems empty")
                return False
                
    except Exception as e:
        print(f"❌ Chrome test failed: {e}")
        return False

def main():
    print("=" * 50)
    print("UPWORK BOT - QUICK UBUNTU TEST")
    print("=" * 50)
    
    # Test imports
    if not test_import():
        print("❌ Basic imports failed - check your installation")
        return 1
    
    print("\n🔍 Testing browsers...")
    
    # Test Firefox
    firefox_works = test_minimal_firefox()
    
    # Test Chrome  
    chrome_works = test_minimal_chrome()
    
    print("\n📊 Test Results:")
    print(f"Firefox: {'✅ Working' if firefox_works else '❌ Failed'}")
    print(f"Chrome: {'✅ Working' if chrome_works else '❌ Failed'}")
    
    if firefox_works or chrome_works:
        print("\n✅ At least one browser is working!")
        print("You can now run the authbot:")
        print("  python3 authbot.py")
        print("  # OR")
        print("  python3 authbot_ubuntu.py")
        return 0
    else:
        print("\n❌ No browsers working. Check your setup:")
        print("1. Install Firefox: sudo apt install firefox")
        print("2. Install Chrome: see setup instructions")
        print("3. Check display: export DISPLAY=:99")
        return 1

if __name__ == "__main__":
    sys.exit(main())