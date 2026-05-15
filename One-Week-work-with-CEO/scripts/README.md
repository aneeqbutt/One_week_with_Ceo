# GoLogin GitHub Star Automation

Automate GitHub repository starring across multiple GoLogin browser profiles with natural human-like behavior.

## Features

- **Multiple Profile Support**: Run automation across all profiles in a selected GoLogin folder
- **Two Operation Modes**:
  - Mode 1: Search GitHub by keyword and find specific target URLs
  - Mode 2: Extract GitHub repos from blog links randomly
- **Natural Scrolling**: Mimics human scrolling behavior before starring
- **Login Detection**: Automatically checks if GitHub is logged in on each profile
- **Error Handling**: Comprehensive error handling with detailed logging
- **Skip on Error**: Automatically skips problematic profiles and continues
- **Activity Logs**: Generates detailed logs of all operations

## Prerequisites

- Node.js (v14 or higher)
- GoLogin account with active profiles
- GoLogin API token
- GitHub accounts logged in on GoLogin profiles

## Installation

1. Clone or download the script files

2. Install dependencies:
```bash
npm install
```

3. Make sure GoLogin desktop app is installed and running

## Usage

Run the script:
```bash
node gologin-github-star.js
```

Or use npm:
```bash
npm start
```

### Step-by-Step Process

1. **Select Folder**: The script will display all your GoLogin folders. Enter the number corresponding to your desired folder.

2. **Choose Operation Mode**:
   - **Mode 1 - Keyword Search**: 
     - Enter a search keyword
     - Enter target URL fragment (part of the repo URL you're looking for)
     - Script will search GitHub and find matching repos
   
   - **Mode 2 - Blog Links**:
     - Enter multiple blog URLs (one per line)
     - Press Enter on empty line when done
     - Script will randomly pick one blog per profile and extract GitHub repos

3. **Automation Runs**: The script will:
   - Loop through each profile in the selected folder
   - Check if GitHub is logged in
   - Find the target repository
   - Scroll naturally on the repo page
   - Star the repository
   - Log all activities

4. **View Results**: At the end, you'll see a summary with:
   - Total profiles processed
   - Successful stars
   - Failed attempts with reasons
   - Detailed logs saved to file

## Configuration

The GoLogin API token is already configured in the script. If you need to change it:

```javascript
const GOLOGIN_TOKEN = 'your-new-token-here';
```

## Error Handling

The script handles various scenarios:

- **Not Logged In**: Skips profile if GitHub is not logged in
- **Repo Not Found**: Logs error and moves to next profile
- **Star Button Missing**: Handles cases where star button isn't found
- **Already Starred**: Detects and logs if repo is already starred
- **Network Errors**: Catches and logs connection issues
- **Profile Start Failures**: Handles GoLogin profile startup errors

## Logs

All operations are logged to console and saved to:
```
gologin-automation-logs.txt
```

Log entries include:
- Timestamp
- Log level (INFO, SUCCESS, WARNING, ERROR)
- Detailed message

## Example Workflows

### Workflow 1: Star a Specific Repo from Search

1. Run script
2. Select folder: "My GitHub Accounts"
3. Choose mode: 1
4. Enter keyword: "react nextjs"
5. Enter target: "vercel/next.js"
6. Script stars the Next.js repo from all profiles

### Workflow 2: Star Repos from Blog Posts

1. Run script
2. Select folder: "Active Profiles"
3. Choose mode: 2
4. Enter blogs:
   - https://blog.example.com/best-tools
   - https://dev.to/some-article
   - (empty line to finish)
5. Script randomly picks blogs and stars found repos

## Natural Behavior Features

- **Random Scrolling**: 3-5 scroll actions per repo
- **Variable Scroll Distance**: 300-800px per scroll
- **Mixed Scroll Direction**: 70% down, 30% up
- **Random Delays**: 1-3 seconds between scrolls
- **Profile Delays**: 5-10 seconds between profiles
- **Pre-Star Wait**: 1-2 seconds before clicking star

## Troubleshooting

**GoLogin profiles not starting**:
- Ensure GoLogin desktop app is running
- Check your API token is valid
- Verify profiles exist in the selected folder

**GitHub not detected as logged in**:
- Log into GitHub manually on the profile
- Save the session
- Run script again

**Star button not found**:
- Check if the repo URL is valid
- Ensure you're not already starring from that account
- Some repos may have different layouts

**Rate Limiting**:
- The script includes natural delays
- If you hit GitHub rate limits, wait and retry
- Consider using fewer profiles per run

## Security Notes

- Your GoLogin token is sensitive - don't share the script with the token included
- GitHub may flag suspicious activity if done in bulk
- Use reasonable delays between actions
- Don't abuse the automation

## Support

For issues related to:
- **GoLogin API**: Check GoLogin documentation
- **Script errors**: Review logs in `gologin-automation-logs.txt`
- **GitHub blocks**: Reduce frequency, add more delays

## License

ISC
