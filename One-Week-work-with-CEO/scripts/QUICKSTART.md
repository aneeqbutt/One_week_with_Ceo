# GoLogin GitHub Star Automation - QUICK START

## Important Update

The script has been updated to use the **official GoLogin SDK** which is more reliable and handles all API calls properly.

## Installation

1. **Install Node.js dependencies:**
```bash
npm install
```

This will install:
- `gologin` - Official GoLogin SDK
- `puppeteer-core` - Browser automation

## Usage

Run the script:
```bash
node gologin-github-star-v2.js
```

Or:
```bash
npm start
```

## What Fixed

The previous version had issues with GoLogin API endpoints. The new version:
- Uses the official GoLogin SDK (`gologin` npm package)
- Properly handles profile launching and browser connections
- More reliable folder and profile fetching
- Better error handling

## Script Features

✅ Fetches folders from your GoLogin account
✅ Lists all profiles in selected folder
✅ Two operation modes:
   - Mode 1: Search GitHub by keyword + target URL
   - Mode 2: Extract repos from blog links
✅ Natural scrolling behavior
✅ GitHub login detection
✅ Automatic starring with human-like delays
✅ Comprehensive error handling and logging

## Step-by-Step Walkthrough

1. **Run the script:**
   ```bash
   node gologin-github-star-v2.js
   ```

2. **Select a folder:**
   - Script shows all your GoLogin folders
   - Enter the number of the folder you want to use

3. **Choose operation mode:**
   - **Mode 1** (Keyword Search): 
     - Enter a keyword (e.g., "react hooks")
     - Enter target URL fragment (e.g., "facebook/react")
   
   - **Mode 2** (Blog Links):
     - Enter blog URLs one by one
     - Press Enter on empty line when done

4. **Watch it run:**
   - Script processes each profile
   - Checks GitHub login
   - Finds repo
   - Stars it naturally
   - Shows progress and results

5. **Check logs:**
   - All activities logged to console
   - Saved to `gologin-automation-logs.txt`

## Troubleshooting

### Error: "No profiles found in this folder"

**Solution:** The folder might be empty. Create profiles in that folder using GoLogin app first.

### Error: "GitHub account is not logged in"

**Solution:** 
1. Open the profile in GoLogin manually
2. Log into GitHub
3. Save and close the profile
4. Run the script again

### Error: "Failed to fetch profiles"

**Solution:**
1. Check your internet connection
2. Verify your API token is correct
3. Make sure GoLogin account is active

### Script hangs or freezes

**Solution:**
1. Close all GoLogin browsers manually
2. Restart the script
3. Try with fewer profiles initially

## Files

- `gologin-github-star-v2.js` - Main script (NEW VERSION)
- `gologin-github-star.js` - Old version (kept for reference)
- `package.json` - Dependencies configuration
- `README.md` - Full documentation
- `config.js` - Configuration options
- `examples.js` - Usage examples

## Key Improvements

The v2 script is better because:

1. **Uses Official SDK** - No manual API endpoint management
2. **Better Profile Launching** - SDK handles all the complex parts
3. **Proper Browser Management** - Automatic cleanup and connection
4. **Folder Filtering** - Checks both `folders` array and `folderId` field
5. **Native fetch API** - Less dependencies, more reliable

## Next Steps

1. Install dependencies: `npm install`
2. Run the script: `node gologin-github-star-v2.js`
3. Select your folder and mode
4. Watch the magic happen!

## Support

If you encounter issues:
1. Check the logs in `gologin-automation-logs.txt`
2. Verify your GoLogin profiles are set up correctly
3. Make sure GitHub is logged in on each profile
4. Try with 1-2 profiles first to test

Happy starring! 🌟
