#!/bin/bash

echo "=========================================="
echo "UPWORK BOT UBUNTU SERVER SETUP"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   print_status "Please run as a regular user with sudo privileges"
   exit 1
fi

print_status "Starting Ubuntu server setup for Upwork bot..."

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    curl \
    gnupg \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    xvfb \
    unzip

# Install Firefox (preferred for Linux)
print_status "Installing Firefox..."
sudo apt install -y firefox

# Install Chrome (alternative option)
print_status "Installing Google Chrome..."
if ! command -v google-chrome &> /dev/null; then
    # Add Google Chrome repository
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    sudo apt update
    sudo apt install -y google-chrome-stable
    print_status "✅ Chrome installed successfully"
else
    print_status "✅ Chrome already installed"
fi

# Install ChromeDriver
print_status "Installing ChromeDriver..."
# Get latest stable version
CHROME_VERSION=$(google-chrome --version | awk '{print $3}' | cut -d'.' -f1-3)
CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION}")

if [ -z "$CHROMEDRIVER_VERSION" ]; then
    # Fallback to latest
    CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE")
fi

print_status "Installing ChromeDriver version: $CHROMEDRIVER_VERSION"
wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip"
sudo unzip -o /tmp/chromedriver.zip -d /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver
rm /tmp/chromedriver.zip

# Install GeckoDriver for Firefox
print_status "Installing GeckoDriver for Firefox..."
GECKODRIVER_VERSION=$(curl -s "https://api.github.com/repos/mozilla/geckodriver/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
print_status "Installing GeckoDriver version: $GECKODRIVER_VERSION"
wget -O /tmp/geckodriver.tar.gz "https://github.com/mozilla/geckodriver/releases/download/${GECKODRIVER_VERSION}/geckodriver-${GECKODRIVER_VERSION}-linux64.tar.gz"
sudo tar -xzf /tmp/geckodriver.tar.gz -C /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
rm /tmp/geckodriver.tar.gz

# Create virtual environment
print_status "Setting up Python virtual environment..."
cd "$(dirname "$0")" # Go to script directory
cd .. # Go to project root

if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_status "✅ Virtual environment created"
else
    print_status "✅ Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
print_status "Installing Python dependencies..."
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install required packages
pip install \
    seleniumbase \
    requests \
    cloudscraper \
    nest-asyncio \
    discord.py \
    aiohttp

# Install additional packages for better Linux compatibility
pip install \
    pyvirtualdisplay \
    selenium \
    webdriver-manager

print_status "✅ Python dependencies installed"

# Create systemd service file (optional)
print_status "Creating systemd service template..."
SERVICE_FILE="/tmp/upwork-bot.service"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Upwork Discord Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/python $(pwd)/main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

print_status "Systemd service template created at: $SERVICE_FILE"
print_status "To install the service, run:"
print_status "  sudo cp $SERVICE_FILE /etc/systemd/system/"
print_status "  sudo systemctl enable upwork-bot"
print_status "  sudo systemctl start upwork-bot"

# Create startup script
print_status "Creating startup script..."
cat > "start_bot.sh" << 'EOF'
#!/bin/bash

# Upwork Bot Startup Script for Ubuntu Server

echo "Starting Upwork Bot on Ubuntu Server..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
source venv/bin/activate

# Set display for headless operation
export DISPLAY=:99

# Start virtual display (if not already running)
if ! pgrep Xvfb > /dev/null; then
    echo "Starting virtual display..."
    Xvfb :99 -screen 0 1920x1080x24 &
    XVFB_PID=$!
    echo "Virtual display started with PID: $XVFB_PID"
    sleep 2
fi

# Function to cleanup on exit
cleanup() {
    echo "Cleaning up..."
    if [ ! -z "$XVFB_PID" ] && kill -0 $XVFB_PID 2>/dev/null; then
        kill $XVFB_PID
        echo "Virtual display stopped"
    fi
}
trap cleanup EXIT

# Run the authbot first to get credentials
echo "Running authentication bot..."
python scraper/authbot.py

# Check if auth was successful
if [ $? -eq 0 ]; then
    echo "✅ Authentication successful!"
    echo "Starting main bot..."
    python main.py
else
    echo "❌ Authentication failed!"
    exit 1
fi
EOF

chmod +x start_bot.sh
print_status "✅ Startup script created: start_bot.sh"

# Create test script
print_status "Creating test script..."
cat > "test_ubuntu.py" << 'EOF'
#!/usr/bin/env python3
"""
Test script to verify Ubuntu setup for Upwork bot
"""
import sys
import subprocess
import importlib

def test_package(package_name):
    """Test if a package can be imported"""
    try:
        importlib.import_module(package_name)
        print(f"✅ {package_name} - OK")
        return True
    except ImportError:
        print(f"❌ {package_name} - FAILED")
        return False

def test_browser(browser_name):
    """Test if a browser is available"""
    try:
        result = subprocess.run([browser_name, '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            version = result.stdout.strip().split('\n')[0]
            print(f"✅ {browser_name} - {version}")
            return True
        else:
            print(f"❌ {browser_name} - Command failed")
            return False
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print(f"❌ {browser_name} - Not found")
        return False

def test_driver(driver_name):
    """Test if a driver is available"""
    try:
        result = subprocess.run([driver_name, '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            version = result.stdout.strip().split('\n')[0]
            print(f"✅ {driver_name} - {version}")
            return True
        else:
            print(f"❌ {driver_name} - Command failed")
            return False
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print(f"❌ {driver_name} - Not found")
        return False

def main():
    print("=" * 50)
    print("UPWORK BOT UBUNTU SETUP TEST")
    print("=" * 50)
    
    all_tests_passed = True
    
    # Test Python packages
    print("\n📦 Testing Python packages:")
    packages = [
        'seleniumbase',
        'requests', 
        'selenium',
        'discord'
    ]
    
    for package in packages:
        if not test_package(package):
            all_tests_passed = False
    
    # Test browsers
    print("\n🌐 Testing browsers:")
    browsers = [
        'firefox',
        'google-chrome'
    ]
    
    browser_available = False
    for browser in browsers:
        if test_browser(browser):
            browser_available = True
    
    if not browser_available:
        print("❌ No browsers available!")
        all_tests_passed = False
    
    # Test drivers
    print("\n🚗 Testing WebDrivers:")
    drivers = [
        'geckodriver',
        'chromedriver'
    ]
    
    driver_available = False
    for driver in drivers:
        if test_driver(driver):
            driver_available = True
    
    if not driver_available:
        print("❌ No WebDrivers available!")
        all_tests_passed = False
    
    # Test virtual display
    print("\n🖥️  Testing virtual display:")
    try:
        result = subprocess.run(['which', 'Xvfb'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Xvfb - Available")
        else:
            print("❌ Xvfb - Not found")
            all_tests_passed = False
    except Exception:
        print("❌ Xvfb - Test failed")
        all_tests_passed = False
    
    # Final result
    print("\n" + "=" * 50)
    if all_tests_passed:
        print("✅ ALL TESTS PASSED! Ubuntu setup is ready.")
        print("You can now run: ./start_bot.sh")
    else:
        print("❌ Some tests failed. Please review the setup.")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
EOF

chmod +x test_ubuntu.py
print_status "✅ Test script created: test_ubuntu.py"

# Final instructions
print_status ""
print_status "=========================================="
print_status "✅ UBUNTU SETUP COMPLETE!"
print_status "=========================================="
print_status ""
print_status "Next steps:"
print_status "1. Test the setup: python3 test_ubuntu.py"
print_status "2. Run the bot: ./start_bot.sh"
print_status "3. Or activate venv manually: source venv/bin/activate"
print_status ""
print_status "Troubleshooting:"
print_status "- If browsers fail, try: sudo apt install firefox-esr"
print_status "- For headless issues, ensure Xvfb is running"
print_status "- Check logs in /var/log/syslog for systemd service"
print_status ""
print_warning "Note: The bot will run in headless mode on the server"
print_warning "Make sure your server has enough RAM (recommended: 2GB+)"

print_status ""
print_status "Setup completed successfully! 🎉"