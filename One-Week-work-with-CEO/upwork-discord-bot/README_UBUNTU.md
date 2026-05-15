# Upwork Bot - Ubuntu Server Deployment Guide

This guide will help you deploy the Upwork Discord Bot on an Ubuntu server with headless browser support.

## 🖥️ System Requirements

- **Ubuntu Server 18.04+** (20.04 or 22.04 recommended)
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: At least 2GB free space
- **Network**: Stable internet connection
- **User**: Non-root user with sudo privileges

## 🚀 Quick Setup

### 1. Download and Run Setup Script

```bash
# Clone your repository (if not already done)
git clone <your-repo-url>
cd upwork-discord-bot

# Make setup script executable and run it
chmod +x scraper/setup_ubuntu.sh
./scraper/setup_ubuntu.sh
```

The setup script will automatically:

- Install Firefox and Chrome browsers
- Install WebDrivers (GeckoDriver, ChromeDriver)
- Set up Python virtual environment
- Install all required dependencies
- Create startup scripts
- Configure virtual display (Xvfb)

### 2. Test the Setup

```bash
# Test if everything is working
python3 test_ubuntu.py
```

### 3. Run the Bot

```bash
# Method 1: Use the startup script (recommended)
./start_bot.sh

# Method 2: Manual activation
source venv/bin/activate
python scraper/authbot_ubuntu.py  # Get credentials first
python main.py                    # Run main bot
```

## 🔧 Manual Installation (if automatic setup fails)

### Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Essential Packages

```bash
sudo apt install -y python3 python3-pip python3-venv wget curl gnupg software-properties-common apt-transport-https ca-certificates xvfb unzip
```

### Step 3: Install Firefox

```bash
sudo apt install -y firefox
```

### Step 4: Install Chrome (Optional)

```bash
# Add Google Chrome repository
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable
```

### Step 5: Install WebDrivers

```bash
# Install ChromeDriver
CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE")
wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip"
sudo unzip -o /tmp/chromedriver.zip -d /usr/local/bin/
sudo chmod +x /usr/local/bin/chromedriver
rm /tmp/chromedriver.zip

# Install GeckoDriver
GECKODRIVER_VERSION=$(curl -s "https://api.github.com/repos/mozilla/geckodriver/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
wget -O /tmp/geckodriver.tar.gz "https://github.com/mozilla/geckodriver/releases/download/${GECKODRIVER_VERSION}/geckodriver-${GECKODRIVER_VERSION}-linux64.tar.gz"
sudo tar -xzf /tmp/geckodriver.tar.gz -C /usr/local/bin/
sudo chmod +x /usr/local/bin/geckodriver
rm /tmp/geckodriver.tar.gz
```

### Step 6: Setup Python Environment

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install seleniumbase requests cloudscraper nest-asyncio discord.py aiohttp pyvirtualdisplay selenium webdriver-manager
```

## 🎯 Ubuntu-Specific Features

### 1. Optimized Browser Order

- **Firefox First**: More stable on Linux servers
- **Chrome Fallback**: Secondary option with UC mode disabled

### 2. Virtual Display Support

- Automatic Xvfb setup for headless operation
- No GUI required - perfect for servers

### 3. Enhanced Error Handling

- Linux-specific browser options
- Better timeout handling
- Graceful fallbacks

### 4. System Service Integration

- Systemd service template included
- Auto-restart on failure
- Proper logging

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Discord Bot Token
DISCORD_TOKEN=your_discord_bot_token

# Virtual Display (optional)
DISPLAY=:99

# Browser Preferences (optional)
PREFERRED_BROWSER=firefox
HEADLESS_MODE=true
```

### Browser Preferences

Edit `authbot_ubuntu.py` to modify browser settings:

```python
# Preferred browser order
browsers_to_try = ["firefox", "chrome"]  # Change order if needed

# Browser options
browser_options = {
    "headless": True,          # Always True for servers
    "disable_gpu": True,       # Better for headless
    "no_sandbox": True,        # Required for some VPS
    "disable_dev_shm_usage": True  # Memory optimization
}
```

## 🚀 Running as a Service

### 1. Install the Service

```bash
# Copy service file
sudo cp /tmp/upwork-bot.service /etc/systemd/system/

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable upwork-bot

# Start the service
sudo systemctl start upwork-bot
```

### 2. Service Management

```bash
# Check status
sudo systemctl status upwork-bot

# View logs
sudo journalctl -u upwork-bot -f

# Stop service
sudo systemctl stop upwork-bot

# Restart service
sudo systemctl restart upwork-bot
```

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. Browser Not Found

```bash
# Install missing browser
sudo apt install firefox-esr  # Alternative Firefox
# OR
sudo apt install chromium-browser  # Chromium instead of Chrome
```

#### 2. WebDriver Issues

```bash
# Check if drivers are accessible
which chromedriver
which geckodriver

# Reinstall drivers if needed
sudo rm /usr/local/bin/chromedriver /usr/local/bin/geckodriver
# Then rerun setup script
```

#### 3. Virtual Display Problems

```bash
# Check if Xvfb is running
pgrep Xvfb

# Start Xvfb manually
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
```

#### 4. Permission Issues

```bash
# Fix permissions
sudo chown -R $USER:$USER ~/upwork-discord-bot
chmod +x start_bot.sh
chmod +x scraper/authbot_ubuntu.py
```

#### 5. Memory Issues

```bash
# Check memory usage
free -h

# If low memory, add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 6. Network/Cloudflare Issues

```bash
# Test network connectivity
curl -I https://www.upwork.com

# If blocked, try:
# - Different VPS provider
# - Proxy/VPN configuration
# - Different user agents
```

### Debug Mode

Enable debug logging by modifying the scripts:

```python
# In authbot_ubuntu.py, add:
import logging
logging.basicConfig(level=logging.DEBUG)

# Add more print statements for debugging
print(f"[DEBUG] Current step: {step_description}")
```

### Log Files

Check these locations for logs:

- System logs: `/var/log/syslog`
- Service logs: `sudo journalctl -u upwork-bot`
- Bot logs: `./logs/` (if configured)

## 📊 Performance Optimization

### 1. Resource Usage

```bash
# Monitor resource usage
htop
# or
top

# Monitor bot specifically
ps aux | grep python
```

### 2. Memory Optimization

- Use Firefox instead of Chrome (lower memory usage)
- Enable swap if RAM < 4GB
- Close unnecessary services

### 3. Network Optimization

- Use a VPS with good connectivity to Upwork servers
- Consider premium VPS providers for better reliability

## 🔒 Security Considerations

### 1. Firewall Setup

```bash
# Basic firewall rules
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 22
# Only allow necessary ports
```

### 2. User Security

```bash
# Don't run as root
# Use dedicated user for the bot
sudo adduser upworkbot
sudo usermod -aG sudo upworkbot
```

### 3. File Permissions

```bash
# Secure sensitive files
chmod 600 .env
chmod 600 config.py
```

## 📈 Monitoring and Maintenance

### 1. Health Checks

```bash
# Create health check script
cat > health_check.sh << 'EOF'
#!/bin/bash
if systemctl is-active --quiet upwork-bot; then
    echo "Bot is running"
    exit 0
else
    echo "Bot is down"
    exit 1
fi
EOF
chmod +x health_check.sh
```

### 2. Log Rotation

```bash
# Setup log rotation
sudo tee /etc/logrotate.d/upwork-bot << 'EOF'
/home/*/upwork-discord-bot/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

### 3. Automated Updates

```bash
# Create update script
cat > update_bot.sh << 'EOF'
#!/bin/bash
cd ~/upwork-discord-bot
git pull
source venv/bin/activate
pip install --upgrade -r requirements.txt
sudo systemctl restart upwork-bot
EOF
chmod +x update_bot.sh
```

## 🎉 Success Indicators

When everything is working correctly, you should see:

```
✅ Virtual display started
✅ Firefox browser launched
✅ Navigated to Upwork
✅ Jobs found with selector: .air3-card
✅ Captured 45 cookies from firefox
✅ Headers saved to headers_upwork.json
✅ Cookies saved to upwork_cookies.json
✅ Authentication completed successfully!
```

## 📞 Support

If you encounter issues:

1. **Check the test script output**: `python3 test_ubuntu.py`
2. **Review the setup logs**: Look for error messages during setup
3. **Test individual components**: Try browsers manually
4. **Check system resources**: Ensure adequate RAM/storage
5. **Verify network connectivity**: Test Upwork access

---

**Happy botting on Ubuntu! 🐧🤖**
