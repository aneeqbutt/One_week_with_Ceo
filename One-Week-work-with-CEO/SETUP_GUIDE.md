# 🚀 Setup Guide - AI Automation Dashboard

Complete step-by-step guide to get your AI Automation Dashboard up and running.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **GitHub Account** with Personal Access Token
- **ChatGPT Plus Account** (for web scraping)
- **Google Account** (for Sheets integration)
- **Git** installed

---

## 🔧 Installation

### 1. Clone or Download the Project

```bash
cd ai-automation-dashboard
```

### 2. Install Dependencies

Using npm:
```bash
npm install
```

Using pnpm (recommended):
```bash
pnpm install
```

Using yarn:
```bash
yarn install
```

---

## 🔑 Getting Required Credentials

### GitHub Personal Access Token

1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: `AI Automation Dashboard`
4. Select scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Click "Generate token"
6. **Copy and save the token** (you won't see it again!)

**Format:** `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

### ChatGPT Session Cookie

#### Method 1: Using Browser DevTools (Chrome/Edge)

1. Log in to [ChatGPT](https://chatgpt.com)
2. Open DevTools (F12 or Right-click → Inspect)
3. Go to **Application** tab → **Cookies** → `https://chatgpt.com`
4. Find cookie named: `__Secure-next-auth.session-token`
5. Copy the **Value** field

#### Method 2: Using Browser Extension

1. Install "EditThisCookie" or "Cookie-Editor" extension
2. Visit [ChatGPT](https://chatgpt.com)
3. Click the extension icon
4. Find `__Secure-next-auth.session-token`
5. Copy the value

**Note:** This cookie expires periodically. You'll need to refresh it when it does.

---

### Google Sheets Setup

#### Option A: Using Service Account (Recommended for Production)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Sheets API**
4. Create a Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Name it `automation-dashboard`
   - Grant role: `Editor`
5. Create a JSON key:
   - Click the service account → Keys → Add Key → JSON
   - Download the JSON file
6. Share your Google Sheet with the service account email (found in JSON)

#### Option B: Using OAuth (For Personal Use)

1. Enable Google Sheets API in Cloud Console
2. Create OAuth 2.0 credentials
3. Download credentials.json
4. Use Google's OAuth flow in your code

---

## 🎨 Development Mode

Run the app in development mode with hot-reload:

### Terminal 1: Start Vite Dev Server
```bash
npm run dev:renderer
# or
pnpm run dev:renderer
```

### Terminal 2: Start Electron
```bash
npm run dev
# or
pnpm run dev
```

The Electron window will open and automatically connect to the Vite dev server at `http://localhost:5173`.

---

## 🏗️ Building for Production

### Build the App

```bash
npm run build
# or
pnpm run build
```

This will:
1. Build the renderer process (React app)
2. Build the preload script
3. Create platform-specific installers in `dist/` folder

### Platform-Specific Builds

**macOS:**
```bash
npm run build
# Output: dist/AI Automation Dashboard-0.1.0.dmg
```

**Windows:**
```bash
npm run build
# Output: dist/AI Automation Dashboard Setup 0.1.0.exe
```

**Linux:**
```bash
npm run build
# Output: dist/AI Automation Dashboard-0.1.0.AppImage
```

---

## 🎯 Usage

### Creating Your First Campaign

1. **Launch the app**
   ```bash
   npm start
   ```

2. **Navigate to "GitHub Repo Generator"** in the sidebar

3. **Click "+ Create Campaign"**

4. **Fill in the form:**
   - **Campaign Name:** My First Campaign
   - **Google Sheet ID:** Get from your sheet URL (see GOOGLE_SHEETS_TEMPLATE.md)
   - **GitHub Token:** Paste your `ghp_...` token
   - **ChatGPT Session Cookie:** Paste your `__Secure-next-auth.session-token` value

5. **Click "Create"**

6. **Click "Start"** to begin automation

7. **Watch the logs** in real-time as repos are created!

---

## 📊 Monitoring Progress

### Real-Time Logs
- The log viewer shows all actions being performed
- Timestamps and log levels (INFO, ERROR)
- Automatically scrolls to latest log

### Campaign Status
- **Idle:** Not running
- **Running:** Currently processing
- **Completed:** All repos created successfully
- **Failed:** Encountered an error

---

## 🐛 Troubleshooting

### Issue: "ChatGPT session expired"
**Solution:** Get a fresh session cookie from ChatGPT

### Issue: "GitHub API rate limit exceeded"
**Solution:** 
- Wait for rate limit reset (shown in error)
- Use a different GitHub account
- Create repos slower (modify code to add delays)

### Issue: "Google Sheets permission denied"
**Solution:** 
- Check service account email is added to sheet with Editor access
- Verify Sheet ID is correct
- Check API is enabled in Google Cloud

### Issue: "Puppeteer browser launch failed"
**Solution:**
- Install Chromium dependencies:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install -y chromium-browser
  
  # macOS (via Homebrew)
  brew install chromium
  ```

---

## 🔒 Security Best Practices

1. **Never commit credentials** to version control
2. **Use .env files** for local development (already gitignored)
3. **Rotate tokens regularly**
4. **Use service accounts** with minimal permissions
5. **Store production credentials** in secure vaults (not in code)

---

## 🚀 Advanced Configuration

### Customizing ChatGPT Prompts

Edit `src/services/chatgptScraper.js`:

```javascript
const SYSTEM_PROMPT = `Your custom prompt here...`;
```

### Adjusting Puppeteer Settings

```javascript
const browser = await puppeteer.launch({
  headless: false, // Set to false to see browser
  slowMo: 100,     // Slow down actions
  devtools: true,  // Open DevTools
});
```

### Custom GitHub Repo Settings

Edit `src/services/githubService.js`:

```javascript
{
  name,
  description,
  private: true,  // Make repos private
  auto_init: true // Initialize with README
}
```

---

## 📚 Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs/latest)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Puppeteer Documentation](https://pptr.dev/)
- [Google Sheets API Guide](https://developers.google.com/sheets/api/guides/concepts)

---

## 💬 Need Help?

Create an issue in the repository with:
- Detailed description of the problem
- Error messages and logs
- Steps to reproduce
- Your environment (OS, Node version, etc.)

---

Happy Automating! 🎉
