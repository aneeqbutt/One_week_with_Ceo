# Repo Views Campaign - Quick Start Guide

## Overview

The Repo Views Campaign feature generates organic views for your GitHub repositories using automated browser profiles. Each view appears as a unique visitor with different fingerprints.

## Getting Started

### 1. Navigate to Repo Views

- Open the application
- Click **"Repo Views"** in the left sidebar (Eye icon)

### 2. Create Your First Campaign

Click the **"Create Campaign"** button and fill in:

#### Campaign Name

- Give your campaign a descriptive name
- Example: "My React Library Views"

#### Search Type

Choose one of two modes:

**🔍 Keyword Mode**

- Use this when you want views from Google searches
- The bot will search Google with your keyword
- Find your repo URL in results
- Click and view the page
- Best for: SEO visibility, organic discovery

**🌐 About Mode**

- Use this for direct navigation
- The bot navigates straight to your repo
- Skips the Google search step
- Best for: Quick views, traffic boost

#### Search Query

- **Keyword mode**: Enter the search term (e.g., "react component library")
- **About mode**: Enter a description or identifier

#### Repository URL

- Enter your full GitHub repo URL
- Example: `https://github.com/username/repository`
- Must be a valid GitHub URL

#### Number of Views

- Choose between 1 and 1000 views
- Each view uses a unique browser profile
- Recommendation: Start with 10-20 for testing

### 3. Start the Campaign

- Campaign is created in **"Idle"** status
- Click the **▶️ Play button** to start
- Campaign status changes to **"Running"**
- Watch the progress bar fill in real-time

### 4. Monitor Progress

**Stats Dashboard** shows:

- 📊 Total Campaigns
- ⏳ Currently Running
- ✅ Completed
- 👁️ Total Views Generated

**Campaign Card** displays:

- Current status with color-coded badge
- Progress bar (completed/total views)
- Search type and query
- Created timestamp
- Repository URL

### 5. View Results

- Click **"Show results"** on completed campaigns
- See individual view details:
  - View number
  - Success/failure status
  - Profile ID used
  - Any errors encountered

## How It Works

### Behind the Scenes

1. **Profile Creation**

   - Creates a unique GoLogin browser profile
   - Randomized fingerprint (user agent, screen resolution, etc.)
   - Optional proxy for IP rotation

2. **Navigation** (based on search type)

   - **Keyword**: Google search → find repo → click result
   - **About**: Direct navigation to repo URL

3. **Natural Behavior**

   - Scrolls page for 60-90 seconds
   - Random scroll amounts and directions
   - Smooth, human-like movements

4. **Cleanup**

   - Closes browser session
   - Deletes GoLogin profile
   - Logs results to database

5. **Next View**
   - Repeats for all views in campaign
   - Each view is completely independent

## Campaign Controls

### ▶️ Start

- Available for "Idle" campaigns
- Begins view generation
- Cannot be started again once running

### ⏸️ Stop

- Available for "Running" campaigns
- Gracefully stops after current view completes
- Campaign marked as "Stopped"

### 🗑️ Delete

- Available for non-running campaigns
- Removes campaign and all associated logs
- **Warning**: This action cannot be undone

### 🔄 Refresh

- Manually refresh campaign list
- Updates automatically on status changes

## Best Practices

### For Maximum Effectiveness

1. **Use Keyword Mode for SEO**

   - Helps with search engine ranking signals
   - Makes views appear more organic
   - Choose keywords your target audience would search

2. **Start Small**

   - Test with 5-10 views first
   - Verify everything works correctly
   - Scale up gradually

3. **Distribute Views Over Time**

   - Don't run 1000 views at once
   - Create multiple smaller campaigns
   - Spread across different days

4. **Vary Your Keywords**

   - Use different search terms
   - Create multiple campaigns with variations
   - More natural traffic pattern

5. **Monitor Campaign Status**
   - Check for failed views
   - Review error messages
   - Adjust if issues occur

### Common Use Cases

**📈 Boost Repository Visibility**

- Increase GitHub traffic metrics
- Improve search rankings
- Attract organic visitors

**🚀 New Repository Launch**

- Generate initial traction
- Create social proof
- Build momentum

**📊 A/B Testing**

- Test different keywords
- Compare keyword vs. direct views
- Measure effectiveness

**🎯 Targeted Campaigns**

- Focus on specific search terms
- Target particular audiences
- Geographic targeting (with proxies)

## Troubleshooting

### Campaign Stuck in "Running"

- Try refreshing the page
- Check application logs
- Restart the application if needed

### Views Failing

- Verify repository URL is correct and public
- Check internet connection
- Review error messages in results

### Slow Execution

- Each view takes 60-90 seconds minimum
- Plus profile creation/cleanup time
- 10 views ≈ 15-20 minutes

### Progress Not Updating

- Status updates every view completion
- Refresh the page manually if needed
- Check browser console for errors

## Configuration

### Proxy Support (Optional)

Located in `src/services/viewBotRunner.js`:

```javascript
const config = {
  dataImpulseApiKey: "your-api-key-here",
};
```

Benefits of using proxies:

- Different IP for each view
- Geographic diversity
- Avoid rate limiting
- More natural traffic pattern

### GoLogin API Token

Already configured in the code. Contact admin if issues occur.

## Limits and Constraints

- **Max views per campaign**: 1000
- **Min views per campaign**: 1
- **Scroll duration**: 60-90 seconds per view
- **Browser timeout**: 30 seconds for page loads
- **Profile lifetime**: Single-use (created and deleted per view)

## Tips for Success

✅ **DO**:

- Use realistic, relevant keywords
- Start with small test campaigns
- Monitor results regularly
- Use public repositories
- Vary your campaigns

❌ **DON'T**:

- Use same keyword repeatedly
- Run too many views at once
- Point to private/invalid repos
- Expect instant results
- Ignore error messages

## Need Help?

- Check the logs page for detailed execution logs
- Review the REPO_VIEWS_IMPLEMENTATION.md for technical details
- Check campaign results for specific error messages
- Verify your repository URL is publicly accessible

---

**Remember**: Quality over quantity! Organic-looking traffic is more valuable than large volumes of suspicious views.
