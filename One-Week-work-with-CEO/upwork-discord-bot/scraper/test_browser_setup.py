#!/usr/bin/env python3
"""
Test script to check browser installation and virtual display setup
"""

import os
import sys
import subprocess
import shutil

def check_browser_installation():
    """Check which browsers are installed on the system"""
    browsers = {}
    
    # Check Firefox
    firefox_paths = [
        '/usr/bin/firefox',
        '/usr/bin/firefox-esr',
        '/snap/bin/firefox',
        shutil.which('firefox')
    ]
    
    for path in firefox_paths:
        if path and os.path.exists(path):
            try:
                result = subprocess.run([path, '--version'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    browsers['firefox'] = path
                    print(f"✅ Firefox found at: {path}")
                    print(f"   Version: {result.stdout.strip()}")
                    break
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
    
    # Check Chrome/Chromium
    chrome_paths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        shutil.which('google-chrome'),
        shutil.which('chromium'),
        shutil.which('chromium-browser')
    ]
    
    for path in chrome_paths:
        if path and os.path.exists(path):
            try:
                result = subprocess.run([path, '--version'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    browsers['chrome'] = path
                    print(f"✅ Chrome/Chromium found at: {path}")
                    print(f"   Version: {result.stdout.strip()}")
                    break
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
    
    if not browsers:
        print("❌ No browsers found!")
        print("\n💡 To install browsers on Ubuntu:")
        print("  Firefox: sudo apt update && sudo apt install -y firefox")
        print("  Chrome: wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add - && echo 'deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main' | sudo tee /etc/apt/sources.list.d/google-chrome.list && sudo apt update && sudo apt install -y google-chrome-stable")
        print("  Chromium: sudo apt update && sudo apt install -y chromium-browser")
    
    return browsers

def check_virtual_display():
    """Check virtual display capabilities"""
    import platform
    
    if platform.system().lower() != 'linux':
        print("ℹ️ Not on Linux - virtual display not needed")
        return True
    
    # Check if we're in a headless environment
    display = os.environ.get('DISPLAY')
    if display:
        print(f"✅ Display already available: {display}")
        return True
    
    # Check if Xvfb is available
    if shutil.which('Xvfb'):
        print("✅ Xvfb is available for virtual display")
        return True
    else:
        print("❌ Xvfb not found")
        print("💡 Install with: sudo apt install -y xvfb")
        return False

def check_python_packages():
    """Check required Python packages"""
    required_packages = [
        'seleniumbase',
        'requests',
        'cloudscraper'
    ]
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} is installed")
        except ImportError:
            print(f"❌ {package} is missing")
            print(f"💡 Install with: pip install {package}")

def main():
    print("=" * 60)
    print("BROWSER SETUP TEST")
    print("=" * 60)
    
    print("\n1. Checking Python packages...")
    check_python_packages()
    
    print("\n2. Checking browser installations...")
    browsers = check_browser_installation()
    
    print("\n3. Checking virtual display support...")
    vdisplay_ok = check_virtual_display()
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    if browsers:
        print(f"✅ Found {len(browsers)} browser(s): {', '.join(browsers.keys())}")
    else:
        print("❌ No browsers found - install Firefox or Chrome first!")
        
    if vdisplay_ok:
        print("✅ Virtual display support is available")
    else:
        print("❌ Virtual display support missing")
    
    if browsers and vdisplay_ok:
        print("\n🎉 System is ready for authbot.py!")
        return True
    else:
        print("\n⚠️ System needs setup before running authbot.py")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)