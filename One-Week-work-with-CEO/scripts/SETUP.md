# SETUP INSTRUCTIONS - START HERE! 🚀

## Step 1: Download All Files

You need to download these files from the outputs folder to your computer:

**Essential Files (Required):**
1. `package.json` - Dependencies configuration
2. `gologin-github-star-v2.js` - Main automation script
3. `test-connection.js` - Connection test script

**Optional but Recommended:**
4. `QUICKSTART.md` - Quick start guide
5. `README.md` - Full documentation
6. `config.js` - Configuration options
7. `examples.js` - Usage examples

## Step 2: Create a New Folder

```bash
# Create a new folder for your project
mkdir gologin-automation
cd gologin-automation
```

## Step 3: Move Files

Move all downloaded files into your `gologin-automation` folder.

Your folder should look like this:
```
gologin-automation/
├── package.json
├── gologin-github-star-v2.js
├── test-connection.js
├── QUICKSTART.md (optional)
└── README.md (optional)
```

## Step 4: Install Dependencies

Open terminal in the `gologin-automation` folder and run:

```bash
npm install
```

This will install:
- `gologin` (Official GoLogin SDK)
- `puppeteer-core` (Browser automation)

**Wait for installation to complete** (may take 2-3 minutes).

## Step 5: Test Connection

Before running the main script, test your GoLogin connection:

```bash
node test-connection.js
```

This will:
- Verify your API token works
- List all your folders
- Count profiles in each folder
- Confirm SDK is working

If you see "✓ All tests passed!" - you're good to go!

## Step 6: Run the Automation

```bash
node gologin-github-star-v2.js
```

Follow the prompts:
1. Select your folder (by number)
2. Choose operation mode (1 or 2)
3. Provide required inputs (keywords or blog links)
4. Watch it work!

## Troubleshooting

### Error: "Cannot find module 'gologin'"
**Solution:** Run `npm install` first

### Error: "ENOENT: no such file or directory, open package.json"
**Solution:** Make sure package.json is in your current folder

### Error: "Failed to fetch folders"
**Solution:** Check your API token is correct in the script

### Connection test fails
**Solution:**
1. Check internet connection
2. Verify API token
3. Confirm GoLogin account is active

## Quick Commands

```bash
# Install dependencies
npm install

# Test connection
node test-connection.js

# Run automation
node gologin-github-star-v2.js

# Or use npm scripts
npm test           # Test connection
npm start          # Run automation
```

## File Locations

All files are available in the Claude outputs. Download them to your computer and place them in the same folder.

## Need Help?

1. Read QUICKSTART.md for detailed usage
2. Check README.md for full documentation
3. Review examples.js for sample scenarios
4. Look at logs in `gologin-automation-logs.txt`

## Important Notes

- Make sure GoLogin desktop app is installed (optional but recommended)
- Your profiles should have GitHub logged in
- Start with a small folder (2-3 profiles) for testing
- Check logs after each run for issues

Ready? Let's go! 🚀

---

**Current Step:** Download the files above from Claude outputs and continue with Step 2.
