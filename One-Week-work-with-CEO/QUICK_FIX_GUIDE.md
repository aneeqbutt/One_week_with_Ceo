# Quick Fix Guide - Campaign Creation Issue

## ✅ What Was Fixed

1. **Missing UUID package** - Installed `uuid@13.0.0`
2. **Incomplete preload.js** - Added missing API methods
3. **No error handling** - Added comprehensive error handling and logging
4. **Insufficient logging** - Added detailed console output for debugging

## 🚀 How to Run the Fixed App

### Option 1: Quick Start (Recommended)

```bash
# 1. Build the app (already done, but if you need to rebuild)
npm run build

# 2. Start the renderer dev server (Terminal 1)
npm run dev:renderer

# 3. Start Electron (Terminal 2)
npm run dev
```

### Option 2: If You Need to Rebuild

If you make any changes to the code:

```bash
# Rebuild everything
npm run build

# Then run as usual
npm run dev:renderer  # Terminal 1
npm run dev          # Terminal 2
```

## 🧪 Testing Campaign Creation

1. **Open the app** - Wait for it to fully load
2. **Click "+ Create Campaign"** button
3. **Fill in the form**:
   - Campaign Name: "Test Campaign"
   - Keyword 1: "test"
   - (Optional) Add more keywords
   - (Optional) Add questions
4. **Click "Create Campaign"**

## 📋 What You Should See

### In the Console (Terminal):

```
🔧 onCreate called with form: { name: "Test Campaign", keywords: [...], questions: [...] }
📤 Calling window.api.createCampaign...

==================================================
➕ IPC Handler: campaigns:create called
📦 Payload received: {
  "name": "Test Campaign",
  "keywords": ["test"],
  "questions": []
}
==================================================

💾 Creating campaign in MongoDB: abc123-uuid-here
  Name: Test Campaign
  Keywords: 1

==================================================
✅ Campaign created successfully!
📝 Campaign ID: abc123-uuid-here
📝 Campaign Name: Test Campaign
==================================================

✅ Campaign created successfully
```

### In the App:

- The campaign should appear in your campaigns list
- The modal should close automatically
- The campaign stats should update

### In MongoDB:

```bash
# Connect to MongoDB
mongosh

# Select database
use github_automation

# View campaigns
db.campaigns.find().pretty()
```

You should see your campaign stored with:
- `id`: A UUID
- `name`: "Test Campaign"
- `keywords`: ["test"]
- `status`: "Idle"
- `createdAt`: ISO timestamp
- etc.

## ❌ Troubleshooting

### Error: "window.api is not defined!"

**Cause**: Preload script not loaded correctly

**Fix**:
```bash
# Rebuild the app
npm run build

# Make sure dist/main/preload.js exists
ls -la dist/main/preload.js
```

### Error: "Failed to insert campaign into database"

**Cause**: MongoDB not running or not accessible

**Fix**:
```bash
# Make sure MongoDB is running
# On Windows: Check Services for "MongoDB Server"
# On Linux/Mac: 
sudo systemctl status mongod
```

### No logs appear when clicking "Create Campaign"

**Cause**: Renderer dev server not running

**Fix**:
```bash
# Make sure this is running in a separate terminal:
npm run dev:renderer
```

### Campaign created but not showing in list

**Cause**: Auto-refresh not working

**Fix**:
- Wait 2 seconds (auto-refresh interval)
- Or close and reopen the app

## 📝 Files Changed

1. `preload.js` - Fixed API exposure
2. `src/main/ipcHandlers.js` - Added detailed logging
3. `src/renderer/pages/GitHubRepoGenerator.jsx` - Added error handling
4. `package.json` - Added uuid dependency and improved build script
5. `build-dev.js` - New cross-platform build script

## 🔍 Detailed Documentation

See `CAMPAIGN_CREATION_FIX.md` for complete technical details about:
- Root cause analysis
- All changes made
- Prevention strategies
- Testing procedures

## 💡 Tips

1. **Always rebuild** after pulling changes: `npm run build`
2. **Check console logs** - They now provide detailed debugging info
3. **MongoDB must be running** on `localhost:27017`
4. **Use two terminals** - One for renderer, one for electron
5. **Wait for "MongoDB connected"** message before creating campaigns

## ✨ Success Indicators

You'll know it's working when:
- ✅ Console shows detailed logs during campaign creation
- ✅ Campaign appears in the list immediately
- ✅ MongoDB contains the new campaign
- ✅ No errors in console
- ✅ Create Campaign modal closes automatically

---

**Need help?** Check the detailed logs in the console - they now show exactly what's happening at each step!
