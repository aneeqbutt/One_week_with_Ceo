# ⚡ Quick Start Guide

Get up and running in 5 minutes!

---

## 🎯 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] GitHub account
- [ ] ChatGPT Plus account (logged in)

---

## 🚀 Installation (2 minutes)

```bash
cd ai-automation-dashboard
npm install
```

---

## 🔑 Get Your Credentials (2 minutes)

### 1. GitHub Token
1. Visit: https://github.com/settings/tokens/new
2. Name: `AI Dashboard`
3. Check: `repo` (full control)
4. Click "Generate token"
5. **Copy the token** (starts with `ghp_`)

### 2. ChatGPT Cookie
1. Open ChatGPT: https://chatgpt.com
2. Press F12 (DevTools)
3. Go to: **Application** → **Cookies** → `https://chatgpt.com`
4. Find: `__Secure-next-auth.session-token`
5. **Copy the Value**

### 3. Google Sheet (Optional for testing)
You can skip this for now - the app has mock data built-in for testing.

---

## 🎬 Launch the App (1 minute)

### Development Mode
```bash
# Terminal 1
npm run dev:renderer

# Terminal 2 (wait for Terminal 1 to finish)
npm run dev
```

The app will open automatically!

---

## 🎨 Create Your First Campaign

1. Click **"GitHub Repo Generator"** in sidebar
2. Click **"+ Create Campaign"**
3. Fill in:
   - **Campaign Name**: "Test Campaign"
   - **Google Sheet ID**: "test-sheet-123" (mock data)
   - **GitHub Token**: Paste your `ghp_...` token
   - **ChatGPT Cookie**: Paste your cookie value
4. Click **"Create"**
5. Click **"Start"** to begin automation!

---

## 👀 Watch It Work

- The **Log Viewer** shows real-time progress
- **Status** changes from Idle → Running → Completed
- Repos appear in your GitHub account!

---

## 🎉 That's It!

You've successfully:
- ✅ Installed the app
- ✅ Got your credentials
- ✅ Created a campaign
- ✅ Automated repo creation

---

## 📚 Next Steps

- Read [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed configuration
- See [GOOGLE_SHEETS_TEMPLATE.md](GOOGLE_SHEETS_TEMPLATE.md) to connect real sheets
- Check [CONTRIBUTING.md](CONTRIBUTING.md) to add features

---

## 🐛 Troubleshooting

### App Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Session Expired" Error
- Get a fresh ChatGPT cookie (they expire regularly)

### "GitHub Rate Limit"
- Wait 1 hour or use a different GitHub account

### Still Having Issues?
- Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed troubleshooting
- Open an issue on GitHub

---

## 💡 Pro Tips

1. **Keep cookies fresh**: ChatGPT cookies expire - refresh weekly
2. **Test with one repo first**: Use a single keyword to test
3. **Watch the logs**: They show exactly what's happening
4. **Save your tokens**: Store them securely (not in code!)

---

<div align="center">

**Happy Automating! 🚀**

Need help? Check the [SETUP_GUIDE.md](SETUP_GUIDE.md)

</div>
