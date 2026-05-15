// import puppeteer from 'puppeteer-core';
// import GoLogin from 'gologin';
// import readline from 'readline';
// import { promises as fs } from 'fs';

// // GoLogin API Configuration
// const GOLOGIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTAxZWFkMWQ5ZDQwMGQwNWVhNTRlOGYifQ.V1bHwt59yXUbP8wODHM_K0Pa2Ipf0wv8l06cP8zthmc';

// // Logging utility
// class Logger {
//     constructor() {
//         this.logs = [];
//     }

//     log(message, type = 'INFO') {
//         const timestamp = new Date().toISOString();
//         const logMessage = `[${timestamp}] [${type}] ${message}`;
//         console.log(logMessage);
//         this.logs.push(logMessage);
//     }

//     error(message) {
//         this.log(message, 'ERROR');
//     }

//     success(message) {
//         this.log(message, 'SUCCESS');
//     }

//     warning(message) {
//         this.log(message, 'WARNING');
//     }

//     async saveLogs(filename = 'gologin-automation-logs.txt') {
//         try {
//             await fs.writeFile(filename, this.logs.join('\n'));
//             console.log(`\nLogs saved to ${filename}`);
//         } catch (error) {
//             console.error('Failed to save logs:', error.message);
//         }
//     }
// }

// const logger = new Logger();

// // Create readline interface for user input
// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// });

// function askQuestion(question) {
//     return new Promise((resolve) => {
//         rl.question(question, (answer) => {
//             resolve(answer);
//         });
//     });
// }

// // Get all profiles using fetch API with optional folder filtering
// async function getAllProfiles(folderName = null) {
//     try {
//         if (folderName) {
//             logger.log(`Fetching profiles for folder: ${folderName}`);
            
//             // When filtering by folder name, the API returns only profiles in that folder
//             const response = await fetch(`https://api.gologin.com/browser/v2?folder=${encodeURIComponent(folderName)}`, {
//                 headers: {
//                     'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
//                     'Content-Type': 'application/json'
//                 }
//             });
            
//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }
            
//             const data = await response.json();
//             const profiles = data.profiles || [];
//             logger.log(`Found ${profiles.length} profiles in folder "${folderName}"`);
//             return profiles;
            
//         } else {
//             logger.log('Fetching all profiles...');
            
//             // Without folder filter, API only returns 30 profiles at a time
//             // We can't paginate properly, so just get what we can
//             const response = await fetch('https://api.gologin.com/browser/v2', {
//                 headers: {
//                     'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
//                     'Content-Type': 'application/json'
//                 }
//             });
            
//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }
            
//             const data = await response.json();
//             const profiles = data.profiles || [];
            
//             logger.log(`Fetched ${profiles.length} profiles (out of ${data.allProfilesCount || 'unknown'} total)`);
            
//             if (data.allProfilesCount && data.allProfilesCount > profiles.length) {
//                 logger.warning(`Note: API returned only ${profiles.length} profiles, but ${data.allProfilesCount} exist. Use folder filtering to get specific profiles.`);
//             }
            
//             return profiles;
//         }
//     } catch (error) {
//         logger.error(`Failed to fetch profiles: ${error.message}`);
//         throw error;
//     }
// }

// // Get folders
// async function getFolders() {
//     try {
//         logger.log('Fetching folders...');
//         const response = await fetch('https://api.gologin.com/folders', {
//             headers: {
//                 'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
//                 'Content-Type': 'application/json'
//             }
//         });
        
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
        
//         const data = await response.json();
//         return data || [];
//     } catch (error) {
//         logger.error(`Failed to fetch folders: ${error.message}`);
//         throw error;
//     }
// }

// // Natural scrolling function with configurable duration
// async function naturalScroll(page, durationSeconds = 3) {
//     logger.log(`Performing natural scrolling for ${durationSeconds} seconds...`);
    
//     try {
//         const startTime = Date.now();
//         const endTime = startTime + (durationSeconds * 1000);
        
//         while (Date.now() < endTime) {
//             const scrollDistance = Math.floor(Math.random() * 500) + 300; // 300-800px
//             const scrollDirection = Math.random() > 0.3 ? 1 : -1; // 70% down, 30% up
            
//             await page.evaluate((distance, direction) => {
//                 window.scrollBy(0, distance * direction);
//             }, scrollDistance, scrollDirection);
            
//             // Random delay between scrolls (1-3 seconds)
//             await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));
//         }
        
//         logger.log('Natural scrolling completed');
//     } catch (error) {
//         logger.warning(`Error during scrolling: ${error.message}`);
//     }
// }

// // Check if GitHub is logged in
// async function isGitHubLoggedIn(page) {
//     try {
//         await page.goto('https://github.com', { waitUntil: 'networkidle2', timeout: 30000 });
        
//         // Check for logged-in indicators
//         const loggedIn = await page.evaluate(() => {
//             // Check for user avatar or profile icon
//             const avatar = document.querySelector('[data-target="react-app.avatarMenu"]') || 
//                           document.querySelector('img.avatar') ||
//                           document.querySelector('[aria-label="View profile and more"]') ||
//                           document.querySelector('summary.Header-link') ||
//                           document.querySelector('[data-login]');
//             return avatar !== null;
//         });
        
//         return loggedIn;
//     } catch (error) {
//         logger.warning(`Error checking GitHub login status: ${error.message}`);
//         return false;
//     }
// }

// // Star a GitHub repository with natural behavior
// async function starRepository(page, repoUrl) {
//     try {
//         // Check if we're already on the repo page (from Google click)
//         const currentUrl = page.url();
        
//         if (!currentUrl.includes('github.com') || !currentUrl.includes(repoUrl.split('github.com/')[1])) {
//             // We're not on the repo page yet, navigate to it
//             logger.log(`Navigating to repository: ${repoUrl}`);
//             await page.goto(repoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
//         } else {
//             logger.log(`Already on repository page: ${repoUrl}`);
//         }
        
//         // Wait for 5 seconds after page load
//         logger.log('Waiting 5 seconds after page load...');
//         await new Promise(resolve => setTimeout(resolve, 5000));
        
//         // Perform natural scrolling for 20 seconds
//         await naturalScroll(page, 20);
        
//         // Random delay before checking star status (2-4 seconds)
//         await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 2000));
        
//         // Check if already starred
//         const isStarred = await page.evaluate(() => {
//             const unstarButton = document.querySelector('button[aria-label*="Unstar"]') ||
//                                 document.querySelector('button[value="unstar"]');
//             return unstarButton !== null;
//         });
        
//         if (isStarred) {
//             logger.warning('Repository is already starred');
            
//             // Still do the 10-second scroll before finishing
//             await naturalScroll(page, 10);
            
//             return { success: true, message: 'Already starred' };
//         }
        
//         // Scroll to the star button area naturally
//         logger.log('Scrolling to star button...');
//         await page.evaluate(() => {
//             window.scrollTo({ top: 0, behavior: 'smooth' });
//         });
        
//         await new Promise(resolve => setTimeout(resolve, 1500));
        
//         // Find the star button and move mouse to it
//         logger.log('Attempting to star the repository with natural behavior...');
        
//         const starButtonFound = await page.evaluate(() => {
//             const starButtons = [
//                 ...document.querySelectorAll('button'),
//                 ...document.querySelectorAll('form button')
//             ].filter(btn => {
//                 const text = btn.textContent.toLowerCase();
//                 const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
//                 return (text.includes('star') && !text.includes('unstar')) || 
//                        ariaLabel.includes('star this repository');
//             });
            
//             if (starButtons.length > 0) {
//                 const starButton = starButtons[0];
                
//                 // Scroll the button into view
//                 starButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
//                 return true;
//             }
//             return false;
//         });
        
//         if (!starButtonFound) {
//             logger.error('Star button not found');
//             return { success: false, message: 'Star button not found' };
//         }
        
//         // Wait for scroll to complete
//         await new Promise(resolve => setTimeout(resolve, 1000));
        
//         // Move mouse to star button with natural movement
//         const starButton = await page.evaluateHandle(() => {
//             const starButtons = [
//                 ...document.querySelectorAll('button'),
//                 ...document.querySelectorAll('form button')
//             ].filter(btn => {
//                 const text = btn.textContent.toLowerCase();
//                 const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
//                 return (text.includes('star') && !text.includes('unstar')) || 
//                        ariaLabel.includes('star this repository');
//             });
//             return starButtons[0];
//         });
        
//         if (starButton) {
//             // Get button position
//             const box = await starButton.boundingBox();
            
//             if (box) {
//                 // Move mouse to button with slight randomness
//                 const x = box.x + box.width / 2 + (Math.random() * 10 - 5);
//                 const y = box.y + box.height / 2 + (Math.random() * 10 - 5);
                
//                 logger.log('Moving mouse to star button...');
//                 await page.mouse.move(x, y, { steps: 10 }); // Smooth mouse movement
                
//                 // Random small delay before clicking (500-1500ms)
//                 await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1000) + 500));
                
//                 // Hover effect - slight pause
//                 await new Promise(resolve => setTimeout(resolve, 300));
                
//                 // Click the star button
//                 logger.log('Clicking star button...');
//                 await page.mouse.click(x, y);
                
//                 // Wait for the star action to complete
//                 await new Promise(resolve => setTimeout(resolve, 3000));
                
//                 // Verify if starred successfully
//                 const starredSuccess = await page.evaluate(() => {
//                     const unstarButton = document.querySelector('button[aria-label*="Unstar"]') ||
//                                         document.querySelector('button[value="unstar"]');
//                     return unstarButton !== null;
//                 });
                
//                 if (starredSuccess) {
//                     logger.success('Repository starred successfully');
                    
//                     // Scroll for another 10 seconds after starring
//                     await naturalScroll(page, 10);
                    
//                     return { success: true, message: 'Starred successfully' };
//                 } else {
//                     logger.warning('Star button was clicked but verification failed - might still be processing');
                    
//                     // Still scroll after attempt
//                     await naturalScroll(page, 10);
                    
//                     return { success: true, message: 'Star attempted (verification pending)' };
//                 }
//             }
//         }
        
//         logger.error('Could not interact with star button');
//         return { success: false, message: 'Could not interact with star button' };
        
//     } catch (error) {
//         logger.error(`Failed to star repository: ${error.message}`);
//         return { success: false, message: error.message };
//     }
// }

// // Method 1: Search Google for keyword and click on target GitHub repo from search results
// async function searchGoogleAndClickRepo(browser, keyword, targetUrl) {
//     let searchPage = null;
    
//     try {
//         logger.log(`Searching Google for keyword: "${keyword}"`);
//         logger.log(`Looking for repository matching: "${targetUrl}"`);
        
//         // Open a new tab for search
//         logger.log('Opening new tab for Google search...');
//         searchPage = await browser.newPage();
        
//         // Normalize target URL for comparison
//         const normalizedTarget = targetUrl.toLowerCase().replace(/^https?:\/\/(www\.)?github\.com\//i, '');
//         logger.log(`Normalized target: ${normalizedTarget}`);
        
//         let clicked = false;
//         const maxPages = 10; // Search through first 10 pages
        
//         for (let page = 0; page < maxPages; page++) {
//             const startIndex = page * 10; // Google uses start parameter (0, 10, 20, 30...)
            
//             // Search on Google with plain keyword (no site:github.com)
//             const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${startIndex}`;
            
//             logger.log(`Checking Google page ${page + 1}...`);
//             await searchPage.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
//             // Wait for search results to load
//             await new Promise(resolve => setTimeout(resolve, 2000));
            
//             // Perform light scrolling
//             await naturalScroll(searchPage, 3);
            
//             // Try to find and click the target URL in Google results
//             const foundAndClicked = await searchPage.evaluate((target) => {
//                 const normalizedTarget = target.toLowerCase().replace(/^https?:\/\/(www\.)?github\.com\//i, '');
                
//                 // Get all links from Google search results
//                 const allLinks = Array.from(document.querySelectorAll('a'));
                
//                 for (const link of allLinks) {
//                     const href = link.getAttribute('href');
//                     if (!href || !href.includes('github.com')) continue;
                    
//                     // Normalize the href for comparison
//                     const normalizedHref = href.toLowerCase().replace(/^https?:\/\/(www\.)?github\.com\//i, '');
                    
//                     // Check if this href matches or contains the target
//                     if (normalizedHref.includes(normalizedTarget) || normalizedTarget.includes(normalizedHref)) {
//                         // Extract clean repository URL for logging
//                         const match = href.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
//                         if (match) {
//                             const cleanUrl = `https://github.com/${match[1]}/${match[2]}`;
//                             console.log('Match found, clicking link:', cleanUrl);
                            
//                             // Click the link instead of returning the URL
//                             link.click();
//                             return cleanUrl; // Return URL just for logging
//                         }
//                     }
//                 }
                
//                 return null;
//             }, normalizedTarget);
            
//             if (foundAndClicked) {
//                 logger.success(`Found repository on Google page ${page + 1}: ${foundAndClicked}`);
//                 logger.log('Clicked on search result, waiting for page to load...');
                
//                 // Wait for navigation after clicking
//                 try {
//                     await searchPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
//                 } catch (e) {
//                     logger.warning('Navigation timeout, but continuing...');
//                 }
                
//                 clicked = true;
                
//                 // Now the searchPage IS the repo page, so we'll use it instead of closing
//                 logger.log('Successfully navigated to repository via Google search result');
//                 return { success: true, page: searchPage, url: foundAndClicked };
//             }
            
//             logger.log(`Repository not found on page ${page + 1}, checking next page...`);
            
//             // Small delay between page searches to avoid rate limiting
//             await new Promise(resolve => setTimeout(resolve, 2000));
//         }
        
//         // If we didn't find and click the repo, close the search tab
//         if (!clicked) {
//             logger.warning(`Repository matching "${targetUrl}" not found in first ${maxPages} pages of Google search results`);
//             logger.log('The target repository was not found. Skipping this profile.');
//             await searchPage.close();
//             return { success: false, page: null, url: null };
//         }
        
//     } catch (error) {
//         logger.error(`Error during Google search: ${error.message}`);
        
//         // Make sure to close search tab on error
//         if (searchPage) {
//             try {
//                 await searchPage.close();
//             } catch (e) {
//                 // Ignore close errors
//             }
//         }
        
//         return { success: false, page: null, url: null };
//     }
// }

// // Method 2: Extract GitHub repo from blog links
// async function extractRepoFromBlog(page, blogUrl) {
//     try {
//         logger.log(`Extracting GitHub repo from blog: ${blogUrl}`);
        
//         await page.goto(blogUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
//         // Extract GitHub repository links
//         const githubLinks = await page.evaluate(() => {
//             const links = Array.from(document.querySelectorAll('a[href*="github.com"]'));
//             const repoLinks = links
//                 .map(link => link.href)
//                 .filter(href => {
//                     // Match pattern: github.com/username/repo
//                     const match = href.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
//                     return match && match[1] !== 'github' && !href.includes('/issues') && !href.includes('/pull');
//                 })
//                 .map(href => href.split('?')[0].split('#')[0]); // Clean URL
            
//             return [...new Set(repoLinks)]; // Remove duplicates
//         });
        
//         if (githubLinks.length > 0) {
//             // Return first valid repo link
//             logger.success(`Found ${githubLinks.length} GitHub repo(s) in blog`);
//             return githubLinks[0];
//         } else {
//             logger.warning('No GitHub repository links found in blog');
//             return null;
//         }
//     } catch (error) {
//         logger.error(`Error extracting repo from blog: ${error.message}`);
//         return null;
//     }
// }

// // Close all extra tabs and keep only the first one
// async function closeExtraTabs(browser) {
//     try {
//         const pages = await browser.pages();
//         logger.log(`Found ${pages.length} open tab(s)`);
        
//         // Close all tabs except the first one
//         for (let i = 1; i < pages.length; i++) {
//             await pages[i].close();
//             logger.log(`Closed extra tab ${i}`);
//         }
//     } catch (error) {
//         logger.warning(`Error closing extra tabs: ${error.message}`);
//     }
// }

// // Main automation function
// async function automateProfile(profile, mode, options) {
//     let browser = null;
//     let GL = null;
    
//     try {
//         logger.log(`\n${'='.repeat(60)}`);
//         logger.log(`Processing profile: ${profile.name} (${profile.id})`);
//         logger.log('='.repeat(60));
        
//         // Create GoLogin instance with timeout and font handling
//         GL = new GoLogin({
//             token: GOLOGIN_TOKEN,
//             profile_id: profile.id,
//             skipOrbitaHashChecking: true,
//             tmpdir: '/tmp/gologin_profiles'
//         });
        
//         // Launch profile with extended timeout
//         logger.log('Launching profile...');
//         const startResult = await GL.start();
        
//         // Extract wsUrl from result (could be string or object)
//         let wsUrl;
//         if (typeof startResult === 'string') {
//             wsUrl = startResult;
//         } else if (startResult && startResult.wsUrl) {
//             wsUrl = startResult.wsUrl;
//         } else if (startResult && startResult.ws) {
//             wsUrl = startResult.ws;
//         } else {
//             throw new Error('Failed to get WebSocket URL from GoLogin');
//         }
        
//         logger.log(`WebSocket URL: ${wsUrl}`);
//         logger.log('Connecting to browser...');
        
//         // Connect puppeteer with increased timeout
//         browser = await puppeteer.connect({
//             browserWSEndpoint: wsUrl,
//             ignoreHTTPSErrors: true,
//             defaultViewport: null,
//             protocolTimeout: 300000 // 5 minutes timeout instead of default 3 minutes
//         });
        
//         // Close any extra tabs that might have opened
//         await closeExtraTabs(browser);
        
//         const pages = await browser.pages();
//         const page = pages[0] || await browser.newPage();
        
//         // Check if GitHub is logged in
//         logger.log('Checking GitHub login status...');
//         const loggedIn = await isGitHubLoggedIn(page);
        
//         if (!loggedIn) {
//             logger.error('GitHub account is not logged in on this profile');
//             logger.warning('Skipping this profile and continuing with next one...');
//             return { success: false, profile: profile.name, reason: 'Not logged in to GitHub', skipped: true };
//         }
        
//         logger.success('GitHub account is logged in');
        
//         let repoUrl = null;
//         let repoPage = null;
        
//         // Execute based on mode
//         if (mode === '1') {
//             // Method 1: Search by keyword and target URL using Google
//             const searchResult = await searchGoogleAndClickRepo(browser, options.keyword, options.targetUrl);
            
//             if (!searchResult.success) {
//                 logger.error('Failed to find repository URL in Google search results');
//                 logger.warning('Repository not found. Skipping this profile.');
//                 return { success: false, profile: profile.name, reason: 'Repository not found in Google search', skipped: true };
//             }
            
//             repoUrl = searchResult.url;
//             repoPage = searchResult.page; // This is the page that's already on the repo
            
//         } else if (mode === '2') {
//             // Method 2: Random blog selection
//             const randomBlog = options.blogLinks[Math.floor(Math.random() * options.blogLinks.length)];
//             logger.log(`Selected random blog: ${randomBlog}`);
//             repoUrl = await extractRepoFromBlog(page, randomBlog);
            
//             if (!repoUrl) {
//                 logger.error('Failed to find repository URL from blog');
//                 logger.warning('Repository not found. Skipping this profile.');
//                 return { success: false, profile: profile.name, reason: 'Repository not found in blog', skipped: true };
//             }
            
//             repoPage = page; // Use the main page for blog method
//         }
        
//         // Star the repository (using the appropriate page)
//         const starResult = await starRepository(repoPage, repoUrl);
        
//         // Wait 2 seconds before closing
//         logger.log('Waiting 2 seconds before closing...');
//         await new Promise(resolve => setTimeout(resolve, 2000));
        
//         // Close all tabs before finishing
//         logger.log('Closing all tabs...');
//         await closeExtraTabs(browser);
        
//         return { 
//             success: starResult.success, 
//             profile: profile.name, 
//             repo: repoUrl,
//             message: starResult.message
//         };
        
//     } catch (error) {
//         logger.error(`Error processing profile ${profile.name}: ${error.message}`);
        
//         // Log specific error types
//         if (error.message.includes('404')) {
//             logger.warning('This might be a GoLogin API/font issue - continuing to next profile');
//         }
//         if (error.message.includes('timeout')) {
//             logger.warning('Profile launch timeout - this profile may have connectivity issues');
//         }
        
//         return { success: false, profile: profile.name, reason: error.message };
//     } finally {
//         // Comprehensive cleanup
//         try {
//             logger.log('Cleaning up profile...');
            
//             if (browser) {
//                 logger.log('Closing browser...');
//                 // Close all pages first
//                 const pages = await browser.pages();
//                 for (const page of pages) {
//                     try {
//                         await page.close();
//                     } catch (e) {
//                         // Ignore errors
//                     }
//                 }
//                 // Disconnect browser
//                 await browser.disconnect();
//                 logger.log('Browser closed');
//             }
            
//             if (GL) {
//                 logger.log('Stopping GoLogin profile...');
//                 await GL.stop();
//                 logger.log('Profile stopped');
//             }
//         } catch (error) {
//             logger.error(`Cleanup error: ${error.message}`);
//         }
//     }
// }

// // Main function
// async function main() {
//     try {
//         console.log('\n' + '='.repeat(60));
//         console.log('GoLogin GitHub Star Automation Tool');
//         console.log('='.repeat(60) + '\n');
        
//         // Fetch folders
//         const folders = await getFolders();
        
//         if (!folders || folders.length === 0) {
//             console.log('No folders found in your GoLogin account');
//             return;
//         }
        
//         // Display folders
//         console.log('Available Folders:\n');
//         folders.forEach((folder, index) => {
//             console.log(`${index + 1}. ${folder.name} (ID: ${folder.id})`);
//         });
        
//         // Select folder
//         const folderChoice = await askQuestion('\nEnter folder number: ');
//         const selectedFolder = folders[parseInt(folderChoice) - 1];
        
//         if (!selectedFolder) {
//             console.log('Invalid folder selection');
//             return;
//         }
        
//         logger.log(`Selected folder: ${selectedFolder.name}`);
        
//         // Get profiles filtered by this specific folder using folder name
//         const profiles = await getAllProfiles(selectedFolder.name);
        
//         logger.log(`Found ${profiles.length} profile(s) in folder`);
        
//         if (profiles.length === 0) {
//             console.log('No profiles found in this folder');
//             return;
//         }
        
//         // Display all profiles in the selected folder
//         console.log('\n' + '='.repeat(60));
//         console.log(`PROFILES IN FOLDER: ${selectedFolder.name}`);
//         console.log('='.repeat(60));
//         profiles.forEach((profile, index) => {
//             console.log(`${index + 1}. ${profile.name} (ID: ${profile.id})`);
//         });
//         console.log('='.repeat(60) + '\n');
        
//         logger.log(`Found ${profiles.length} profile(s) in folder`);
        
//         // Select mode
//         console.log('\n' + '='.repeat(60));
//         console.log('Select Operation Mode:\n');
//         console.log('1. Search GitHub by keyword and target URL');
//         console.log('2. Extract repos from blog links');
//         console.log('='.repeat(60) + '\n');
        
//         const mode = await askQuestion('Enter mode (1 or 2): ');
        
//         let options = {};
        
//         if (mode === '1') {
//             const keyword = await askQuestion('Enter search keyword: ');
//             const targetUrl = await askQuestion('Enter target URL (part of repo URL): ');
//             options = { keyword, targetUrl };
//         } else if (mode === '2') {
//             console.log('\nEnter blog links (one per line, enter empty line when done):');
//             const blogLinks = [];
//             while (true) {
//                 const link = await askQuestion('Blog URL: ');
//                 if (!link.trim()) break;
//                 blogLinks.push(link.trim());
//             }
            
//             if (blogLinks.length === 0) {
//                 console.log('No blog links provided');
//                 return;
//             }
            
//             options = { blogLinks };
//         } else {
//             console.log('Invalid mode selection');
//             return;
//         }
        
//         // Process all profiles
//         console.log('\n' + '='.repeat(60));
//         console.log('Starting automation...');
//         console.log('='.repeat(60) + '\n');
        
//         const results = [];
        
//         for (const profile of profiles) {
//             const result = await automateProfile(profile, mode, options);
//             results.push(result);
            
//             // Delay between profiles (10 seconds)
//             if (profiles.indexOf(profile) < profiles.length - 1) {
//                 logger.log('Waiting 10 seconds before next profile...\n');
//                 await new Promise(resolve => setTimeout(resolve, 10000));
//             }
//         }
        
//         // Summary
//         console.log('\n' + '='.repeat(60));
//         console.log('AUTOMATION SUMMARY');
//         console.log('='.repeat(60) + '\n');
        
//         const successful = results.filter(r => r.success).length;
//         const skipped = results.filter(r => !r.success && r.skipped).length;
//         const failed = results.filter(r => !r.success && !r.skipped).length;
        
//         console.log(`Total Profiles: ${results.length}`);
//         console.log(`✅ Successful: ${successful}`);
//         console.log(`⏭️  Skipped (Not logged in): ${skipped}`);
//         console.log(`❌ Failed (Errors): ${failed}\n`);
        
//         if (successful > 0) {
//             console.log('Successfully Starred:');
//             results.filter(r => r.success).forEach(r => {
//                 console.log(`  ✅ ${r.profile} - ${r.repo}`);
//             });
//             console.log('');
//         }
        
//         if (skipped > 0) {
//             console.log('Skipped (Not logged into GitHub):');
//             results.filter(r => !r.success && r.skipped).forEach(r => {
//                 console.log(`  ⏭️  ${r.profile}`);
//             });
//             console.log('');
//         }
        
//         if (failed > 0) {
//             console.log('Failed (Errors):');
//             results.filter(r => !r.success && !r.skipped).forEach(r => {
//                 console.log(`  ❌ ${r.profile}: ${r.reason}`);
//             });
//         }
        
//         // Save logs
//         await logger.saveLogs();
        
//     } catch (error) {
//         logger.error(`Fatal error: ${error.message}`);
//         console.error(error);
//     } finally {
//         rl.close();
//     }
// }

// // Run the script
// main().catch(error => {
//     console.error('Unhandled error:', error);
//     process.exit(1);
// });



import puppeteer from 'puppeteer-core';
import GoLogin from 'gologin';
import readline from 'readline';
import { promises as fs } from 'fs';

// GoLogin API Configuration
const GOLOGIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTAxZWFkMWQ5ZDQwMGQwNWVhNTRlOGYifQ.V1bHwt59yXUbP8wODHM_K0Pa2Ipf0wv8l06cP8zthmc';

// Logging utility
class Logger {
    constructor() {
        this.logs = [];
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type}] ${message}`;
        console.log(logMessage);
        this.logs.push(logMessage);
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    success(message) {
        this.log(message, 'SUCCESS');
    }

    warning(message) {
        this.log(message, 'WARNING');
    }

    async saveLogs(filename = 'gologin-automation-logs.txt') {
        try {
            await fs.writeFile(filename, this.logs.join('\n'));
            console.log(`\nLogs saved to ${filename}`);
        } catch (error) {
            console.error('Failed to save logs:', error.message);
        }
    }
}

const logger = new Logger();

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Get all profiles using fetch API with optional folder filtering
async function getAllProfiles(folderName = null) {
    try {
        if (folderName) {
            logger.log(`Fetching profiles for folder: ${folderName}`);
            
            const response = await fetch(`https://api.gologin.com/browser/v2?folder=${encodeURIComponent(folderName)}`, {
                headers: {
                    'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const profiles = data.profiles || [];
            logger.log(`Found ${profiles.length} profiles in folder "${folderName}"`);
            return profiles;
            
        } else {
            logger.log('Fetching all profiles...');
            
            const response = await fetch('https://api.gologin.com/browser/v2', {
                headers: {
                    'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const profiles = data.profiles || [];
            
            logger.log(`Fetched ${profiles.length} profiles (out of ${data.allProfilesCount || 'unknown'} total)`);
            
            if (data.allProfilesCount && data.allProfilesCount > profiles.length) {
                logger.warning(`Note: API returned only ${profiles.length} profiles, but ${data.allProfilesCount} exist. Use folder filtering to get specific profiles.`);
            }
            
            return profiles;
        }
    } catch (error) {
        logger.error(`Failed to fetch profiles: ${error.message}`);
        throw error;
    }
}

// Get folders
async function getFolders() {
    try {
        logger.log('Fetching folders...');
        const response = await fetch('https://api.gologin.com/folders', {
            headers: {
                'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data || [];
    } catch (error) {
        logger.error(`Failed to fetch folders: ${error.message}`);
        throw error;
    }
}

// Natural scrolling function with configurable duration
async function naturalScroll(page, durationSeconds = 3) {
    logger.log(`Performing natural scrolling for ${durationSeconds} seconds...`);
    
    try {
        const startTime = Date.now();
        const endTime = startTime + (durationSeconds * 1000);
        
        while (Date.now() < endTime) {
            const scrollDistance = Math.floor(Math.random() * 500) + 300;
            const scrollDirection = Math.random() > 0.3 ? 1 : -1;
            
            await page.evaluate((distance, direction) => {
                window.scrollBy(0, distance * direction);
            }, scrollDistance, scrollDirection);
            
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000));
        }
        
        logger.log('Natural scrolling completed');
    } catch (error) {
        logger.warning(`Error during scrolling: ${error.message}`);
    }
}

// Check if GitHub is logged in
async function isGitHubLoggedIn(page) {
    try {
        await page.goto('https://github.com', { waitUntil: 'networkidle2', timeout: 30000 });
        
        const loggedIn = await page.evaluate(() => {
            const avatar = document.querySelector('[data-target="react-app.avatarMenu"]') || 
                          document.querySelector('img.avatar') ||
                          document.querySelector('[aria-label="View profile and more"]') ||
                          document.querySelector('summary.Header-link') ||
                          document.querySelector('[data-login]');
            return avatar !== null;
        });
        
        return loggedIn;
    } catch (error) {
        logger.warning(`Error checking GitHub login status: ${error.message}`);
        return false;
    }
}

// DIAGNOSTIC VERSION: Log everything and never assume it's starred
async function starRepository(page, repoUrl) {
    try {
        const currentUrl = page.url();
        
        if (!currentUrl.includes('github.com') || !currentUrl.includes(repoUrl.split('github.com/')[1])) {
            logger.log(`Navigating to repository: ${repoUrl}`);
            await page.goto(repoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        } else {
            logger.log(`Already on repository page: ${repoUrl}`);
        }
        
        // Wait for page to fully load
        logger.log('Waiting 5 seconds after page load...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Perform natural scrolling
        await naturalScroll(page, 20);
        
        // Scroll to top where star button is located
        logger.log('Scrolling to top of page...');
        await page.evaluate(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // COMPREHENSIVE DIAGNOSTIC LOGGING
        logger.log('\n' + '='.repeat(80));
        logger.log('COMPREHENSIVE PAGE ANALYSIS - DIAGNOSING STAR BUTTON ISSUE');
        logger.log('='.repeat(80));
        
        const pageAnalysis = await page.evaluate(() => {
            const results = {
                allForms: [],
                allButtons: [],
                allLinks: [],
                starRelatedElements: []
            };
            
            // Analyze all forms
            const forms = Array.from(document.querySelectorAll('form'));
            results.allForms = forms.map((form, idx) => ({
                index: idx,
                action: form.getAttribute('action'),
                method: form.getAttribute('method'),
                innerHTML: form.innerHTML.substring(0, 200),
                hasStarInAction: (form.getAttribute('action') || '').includes('star')
            }));
            
            // Analyze all buttons
            const buttons = Array.from(document.querySelectorAll('button'));
            results.allButtons = buttons.map((btn, idx) => ({
                index: idx,
                text: btn.textContent?.trim(),
                ariaLabel: btn.getAttribute('aria-label'),
                value: btn.getAttribute('value'),
                type: btn.getAttribute('type'),
                name: btn.getAttribute('name'),
                className: btn.className,
                id: btn.id,
                formAction: btn.closest('form')?.getAttribute('action'),
                dataAttributes: Array.from(btn.attributes)
                    .filter(attr => attr.name.startsWith('data-'))
                    .map(attr => `${attr.name}=${attr.value}`)
                    .join(', ')
            }));
            
            // Find specific star-related elements
            const starForms = forms.filter(f => (f.getAttribute('action') || '').includes('star'));
            const starButtons = buttons.filter(b => {
                const text = (b.textContent || '').toLowerCase();
                const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
                const value = (b.getAttribute('value') || '').toLowerCase();
                return text.includes('star') || ariaLabel.includes('star') || value.includes('star');
            });
            
            results.starRelatedElements = {
                starFormsCount: starForms.length,
                starButtonsCount: starButtons.length,
                starForms: starForms.map(f => ({
                    action: f.getAttribute('action'),
                    method: f.getAttribute('method')
                })),
                starButtons: starButtons.map(b => ({
                    text: b.textContent?.trim(),
                    ariaLabel: b.getAttribute('aria-label'),
                    value: b.getAttribute('value'),
                    formAction: b.closest('form')?.getAttribute('action')
                }))
            };
            
            return results;
        });
        
        // Log forms
        logger.log('\n--- ALL FORMS ON PAGE ---');
        if (pageAnalysis.allForms.length === 0) {
            logger.log('NO FORMS FOUND');
        } else {
            pageAnalysis.allForms.forEach(form => {
                logger.log(`Form ${form.index}:`);
                logger.log(`  Action: ${form.action || 'null'}`);
                logger.log(`  Method: ${form.method || 'null'}`);
                logger.log(`  Has 'star' in action: ${form.hasStarInAction}`);
                if (form.hasStarInAction) {
                    logger.log(`  >>> THIS FORM CONTAINS 'STAR' <<<`);
                }
            });
        }
        
        // Log buttons
        logger.log('\n--- ALL BUTTONS ON PAGE (first 20) ---');
        if (pageAnalysis.allButtons.length === 0) {
            logger.log('NO BUTTONS FOUND');
        } else {
            pageAnalysis.allButtons.slice(0, 20).forEach(btn => {
                logger.log(`Button ${btn.index}:`);
                logger.log(`  Text: "${btn.text}"`);
                logger.log(`  Aria-label: "${btn.ariaLabel}"`);
                logger.log(`  Value: "${btn.value}"`);
                logger.log(`  Type: "${btn.type}"`);
                logger.log(`  Form Action: "${btn.formAction}"`);
                logger.log(`  Data attributes: ${btn.dataAttributes || 'none'}`);
                
                // Highlight star-related buttons
                const hasStarText = (btn.text || '').toLowerCase().includes('star');
                const hasStarLabel = (btn.ariaLabel || '').toLowerCase().includes('star');
                const hasStarValue = (btn.value || '').toLowerCase().includes('star');
                
                if (hasStarText || hasStarLabel || hasStarValue) {
                    logger.log(`  >>> THIS BUTTON IS STAR-RELATED <<<`);
                }
            });
        }
        
        // Log star-specific analysis
        logger.log('\n--- STAR-SPECIFIC ELEMENTS SUMMARY ---');
        logger.log(`Total forms with 'star' in action: ${pageAnalysis.starRelatedElements.starFormsCount}`);
        logger.log(`Total buttons with 'star' in text/aria/value: ${pageAnalysis.starRelatedElements.starButtonsCount}`);
        
        if (pageAnalysis.starRelatedElements.starForms.length > 0) {
            logger.log('\nStar Forms:');
            pageAnalysis.starRelatedElements.starForms.forEach((form, idx) => {
                logger.log(`  ${idx + 1}. Action: ${form.action}, Method: ${form.method}`);
            });
        }
        
        if (pageAnalysis.starRelatedElements.starButtons.length > 0) {
            logger.log('\nStar Buttons:');
            pageAnalysis.starRelatedElements.starButtons.forEach((btn, idx) => {
                logger.log(`  ${idx + 1}. Text: "${btn.text}", Value: "${btn.value}", Form Action: "${btn.formAction}"`);
            });
        }
        
        logger.log('='.repeat(80) + '\n');
        
        // NOW: Never assume it's starred, always try to click
        logger.log('ATTEMPTING TO CLICK STAR BUTTON (ignoring starred state check)...');
        
        const clickResult = await page.evaluate(() => {
            // Strategy 1: Find form with /star action (NOT /unstar)
            const forms = Array.from(document.querySelectorAll('form'));
            const starForm = forms.find(form => {
                const action = form.getAttribute('action') || '';
                return action.includes('/star') && !action.includes('/unstar');
            });
            
            if (starForm) {
                const submitButton = starForm.querySelector('button[type="submit"]');
                if (submitButton) {
                    console.log('Strategy 1: Found star form, clicking submit button');
                    console.log('Form action:', starForm.getAttribute('action'));
                    console.log('Button text:', submitButton.textContent?.trim());
                    submitButton.click();
                    return { success: true, method: 'star-form', details: {
                        formAction: starForm.getAttribute('action'),
                        buttonText: submitButton.textContent?.trim()
                    }};
                }
            }
            
            // Strategy 2: Find button with value="star"
            const starValueButton = document.querySelector('button[value="star"]');
            if (starValueButton) {
                console.log('Strategy 2: Found button with value="star"');
                console.log('Button text:', starValueButton.textContent?.trim());
                starValueButton.click();
                return { success: true, method: 'button-value-star', details: {
                    buttonText: starValueButton.textContent?.trim()
                }};
            }
            
            // Strategy 3: Find button with exact text "Star" or "Star [number]"
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const btn of buttons) {
                const text = btn.textContent?.trim() || '';
                // Match "Star" or "Star 123" but NOT "Starred" or "Unstar"
                if (text.match(/^Star(\s+[\d,\.]+[kKmM]?)?$/)) {
                    console.log('Strategy 3: Found button with star text pattern');
                    console.log('Button text:', text);
                    btn.click();
                    return { success: true, method: 'button-text-star', details: {
                        buttonText: text
                    }};
                }
            }
            
            // Strategy 4: Find button with aria-label containing "star this repository"
            for (const btn of buttons) {
                const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (ariaLabel.includes('star this repository')) {
                    console.log('Strategy 4: Found button with aria-label "star this repository"');
                    console.log('Button text:', btn.textContent?.trim());
                    btn.click();
                    return { success: true, method: 'aria-label-star', details: {
                        buttonText: btn.textContent?.trim(),
                        ariaLabel: btn.getAttribute('aria-label')
                    }};
                }
            }
            
            return { success: false, method: 'none', details: {} };
        });
        
        logger.log(`\nClick Result: ${JSON.stringify(clickResult, null, 2)}`);
        
        if (!clickResult.success) {
            logger.error('FAILED TO FIND ANY STAR BUTTON');
            logger.error('This means GitHub UI has changed or the page structure is different');
            return { success: false, message: 'No star button found on page' };
        }
        
        logger.success(`Star button clicked using: ${clickResult.method}`);
        logger.log(`Details: ${JSON.stringify(clickResult.details, null, 2)}`);
        
        // Wait for action to complete
        logger.log('\nWaiting 4 seconds for star action to process...');
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Verify the star worked
        logger.log('Verifying if star action was successful...');
        
        const verifyResult = await page.evaluate(() => {
            // After starring, GitHub should show:
            // 1. Form with /unstar action, OR
            // 2. Button with value="unstar", OR
            // 3. Button text "Starred" or "Starred [number]"
            
            const forms = Array.from(document.querySelectorAll('form'));
            const unstarForm = forms.find(form => {
                const action = form.getAttribute('action') || '';
                return action.includes('/unstar');
            });
            
            if (unstarForm) {
                return { 
                    success: true, 
                    method: 'unstar-form-found',
                    formAction: unstarForm.getAttribute('action')
                };
            }
            
            const unstarButton = document.querySelector('button[value="unstar"]');
            if (unstarButton) {
                return { 
                    success: true, 
                    method: 'unstar-button-found',
                    buttonText: unstarButton.textContent?.trim()
                };
            }
            
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const btn of buttons) {
                const text = btn.textContent?.trim() || '';
                // Match "Starred" or "Starred 123"
                if (text.match(/^Starred(\s+[\d,\.]+[kKmM]?)?$/i)) {
                    return { 
                        success: true, 
                        method: 'starred-text-found',
                        buttonText: text
                    };
                }
            }
            
            return { success: false, method: 'verification-failed' };
        });
        
        logger.log(`\nVerification Result: ${JSON.stringify(verifyResult, null, 2)}`);
        
        if (verifyResult.success) {
            logger.success(`✓ STAR VERIFIED! Method: ${verifyResult.method}`);
            await naturalScroll(page, 10);
            return { success: true, message: 'Repository starred and verified' };
        } else {
            logger.warning('Star click was performed but verification failed');
            logger.warning('Waiting additional 3 seconds and rechecking...');
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const recheckResult = await page.evaluate(() => {
                const forms = Array.from(document.querySelectorAll('form'));
                const unstarForm = forms.find(form => (form.getAttribute('action') || '').includes('/unstar'));
                if (unstarForm) return { success: true, method: 'unstar-form' };
                
                const unstarButton = document.querySelector('button[value="unstar"]');
                if (unstarButton) return { success: true, method: 'unstar-button' };
                
                const buttons = Array.from(document.querySelectorAll('button'));
                for (const btn of buttons) {
                    if ((btn.textContent?.trim() || '').match(/^Starred/i)) {
                        return { success: true, method: 'starred-text' };
                    }
                }
                
                return { success: false, method: 'still-failed' };
            });
            
            if (recheckResult.success) {
                logger.success(`✓ STAR VERIFIED ON RECHECK! Method: ${recheckResult.method}`);
                await naturalScroll(page, 10);
                return { success: true, message: 'Repository starred (delayed verification)' };
            } else {
                logger.error('✗ Verification failed after multiple attempts');
                await naturalScroll(page, 10);
                return { success: false, message: 'Star clicked but verification failed' };
            }
        }
        
    } catch (error) {
        logger.error(`Exception in starRepository: ${error.message}`);
        logger.error(`Stack: ${error.stack}`);
        return { success: false, message: error.message };
    }
}

// Method 1: Search Google for keyword and click on target GitHub repo from search results
async function searchGoogleAndClickRepo(browser, keyword, targetUrl) {
    let searchPage = null;
    
    try {
        logger.log(`Searching Google for keyword: "${keyword}"`);
        logger.log(`Looking for repository matching: "${targetUrl}"`);
        
        searchPage = await browser.newPage();
        
        const normalizedTarget = targetUrl.toLowerCase().replace(/^https?:\/\/(www\.)?github\.com\//i, '');
        logger.log(`Normalized target: ${normalizedTarget}`);
        
        let clicked = false;
        const maxPages = 10;
        
        for (let page = 0; page < maxPages; page++) {
            const startIndex = page * 10;
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&start=${startIndex}`;
            
            logger.log(`Checking Google page ${page + 1}...`);
            await searchPage.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            await naturalScroll(searchPage, 3);
            
            const foundAndClicked = await searchPage.evaluate((target) => {
                const normalizedTarget = target.toLowerCase().replace(/^https?:\/\/(www\.)?github\.com\//i, '');
                const allLinks = Array.from(document.querySelectorAll('a'));
                
                for (const link of allLinks) {
                    const href = link.getAttribute('href');
                    if (!href || !href.includes('github.com')) continue;
                    
                    const normalizedHref = href.toLowerCase().replace(/^https?:\/\/(www\.)?github\.com\//i, '');
                    
                    if (normalizedHref.includes(normalizedTarget) || normalizedTarget.includes(normalizedHref)) {
                        const match = href.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
                        if (match) {
                            const cleanUrl = `https://github.com/${match[1]}/${match[2]}`;
                            console.log('Match found, clicking link:', cleanUrl);
                            link.click();
                            return cleanUrl;
                        }
                    }
                }
                
                return null;
            }, normalizedTarget);
            
            if (foundAndClicked) {
                logger.success(`Found repository on Google page ${page + 1}: ${foundAndClicked}`);
                logger.log('Clicked on search result, waiting for page to load...');
                
                try {
                    await searchPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                } catch (e) {
                    logger.warning('Navigation timeout, but continuing...');
                }
                
                clicked = true;
                logger.log('Successfully navigated to repository via Google search result');
                return { success: true, page: searchPage, url: foundAndClicked };
            }
            
            logger.log(`Repository not found on page ${page + 1}, checking next page...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (!clicked) {
            logger.warning(`Repository matching "${targetUrl}" not found in first ${maxPages} pages of Google search results`);
            logger.log('The target repository was not found. Skipping this profile.');
            await searchPage.close();
            return { success: false, page: null, url: null };
        }
        
    } catch (error) {
        logger.error(`Error during Google search: ${error.message}`);
        
        if (searchPage) {
            try {
                await searchPage.close();
            } catch (e) {
                // Ignore
            }
        }
        
        return { success: false, page: null, url: null };
    }
}

// Method 2: Extract GitHub repo from blog links
async function extractRepoFromBlog(page, blogUrl) {
    try {
        logger.log(`Extracting GitHub repo from blog: ${blogUrl}`);
        
        await page.goto(blogUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        const githubLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="github.com"]'));
            const repoLinks = links
                .map(link => link.href)
                .filter(href => {
                    const match = href.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
                    return match && match[1] !== 'github' && !href.includes('/issues') && !href.includes('/pull');
                })
                .map(href => href.split('?')[0].split('#')[0]);
            
            return [...new Set(repoLinks)];
        });
        
        if (githubLinks.length > 0) {
            logger.success(`Found ${githubLinks.length} GitHub repo(s) in blog`);
            return githubLinks[0];
        } else {
            logger.warning('No GitHub repository links found in blog');
            return null;
        }
    } catch (error) {
        logger.error(`Error extracting repo from blog: ${error.message}`);
        return null;
    }
}

// Close all extra tabs and keep only the first one
async function closeExtraTabs(browser) {
    try {
        const pages = await browser.pages();
        logger.log(`Found ${pages.length} open tab(s)`);
        
        for (let i = 1; i < pages.length; i++) {
            await pages[i].close();
            logger.log(`Closed extra tab ${i}`);
        }
    } catch (error) {
        logger.warning(`Error closing extra tabs: ${error.message}`);
    }
}

// Main automation function
async function automateProfile(profile, mode, options) {
    let browser = null;
    let GL = null;
    
    try {
        logger.log(`\n${'='.repeat(60)}`);
        logger.log(`Processing profile: ${profile.name} (${profile.id})`);
        logger.log('='.repeat(60));
        
        GL = new GoLogin({
            token: GOLOGIN_TOKEN,
            profile_id: profile.id,
            skipOrbitaHashChecking: true,
            tmpdir: '/tmp/gologin_profiles'
        });
        
        logger.log('Launching profile...');
        const startResult = await GL.start();
        
        let wsUrl;
        if (typeof startResult === 'string') {
            wsUrl = startResult;
        } else if (startResult && startResult.wsUrl) {
            wsUrl = startResult.wsUrl;
        } else if (startResult && startResult.ws) {
            wsUrl = startResult.ws;
        } else {
            throw new Error('Failed to get WebSocket URL from GoLogin');
        }
        
        logger.log(`WebSocket URL: ${wsUrl}`);
        logger.log('Connecting to browser...');
        
        browser = await puppeteer.connect({
            browserWSEndpoint: wsUrl,
            ignoreHTTPSErrors: true,
            defaultViewport: null,
            protocolTimeout: 300000
        });
        
        await closeExtraTabs(browser);
        
        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();
        
        logger.log('Checking GitHub login status...');
        const loggedIn = await isGitHubLoggedIn(page);
        
        if (!loggedIn) {
            logger.error('GitHub account is not logged in on this profile');
            logger.warning('Skipping this profile and continuing with next one...');
            return { success: false, profile: profile.name, reason: 'Not logged in to GitHub', skipped: true };
        }
        
        logger.success('GitHub account is logged in');
        
        let repoUrl = null;
        let repoPage = null;
        
        if (mode === '1') {
            const searchResult = await searchGoogleAndClickRepo(browser, options.keyword, options.targetUrl);
            
            if (!searchResult.success) {
                logger.error('Failed to find repository URL in Google search results');
                logger.warning('Repository not found. Skipping this profile.');
                return { success: false, profile: profile.name, reason: 'Repository not found in Google search', skipped: true };
            }
            
            repoUrl = searchResult.url;
            repoPage = searchResult.page;
            
        } else if (mode === '2') {
            const randomBlog = options.blogLinks[Math.floor(Math.random() * options.blogLinks.length)];
            logger.log(`Selected random blog: ${randomBlog}`);
            repoUrl = await extractRepoFromBlog(page, randomBlog);
            
            if (!repoUrl) {
                logger.error('Failed to find repository URL from blog');
                logger.warning('Repository not found. Skipping this profile.');
                return { success: false, profile: profile.name, reason: 'Repository not found in blog', skipped: true };
            }
            
            repoPage = page;
        }
        
        const starResult = await starRepository(repoPage, repoUrl);
        
        logger.log('Waiting 2 seconds before closing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        logger.log('Closing all tabs...');
        await closeExtraTabs(browser);
        
        return { 
            success: starResult.success, 
            profile: profile.name, 
            repo: repoUrl,
            message: starResult.message
        };
        
    } catch (error) {
        logger.error(`Error processing profile ${profile.name}: ${error.message}`);
        
        if (error.message.includes('404')) {
            logger.warning('This might be a GoLogin API/font issue - continuing to next profile');
        }
        if (error.message.includes('timeout')) {
            logger.warning('Profile launch timeout - this profile may have connectivity issues');
        }
        
        return { success: false, profile: profile.name, reason: error.message };
    } finally {
        try {
            logger.log('Cleaning up profile...');
            
            if (browser) {
                logger.log('Closing browser...');
                const pages = await browser.pages();
                for (const page of pages) {
                    try {
                        await page.close();
                    } catch (e) {
                        // Ignore
                    }
                }
                await browser.disconnect();
                logger.log('Browser closed');
            }
            
            if (GL) {
                logger.log('Stopping GoLogin profile...');
                await GL.stop();
                logger.log('Profile stopped');
            }
        } catch (error) {
            logger.error(`Cleanup error: ${error.message}`);
        }
    }
}

// Main function
async function main() {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('GoLogin GitHub Star Automation Tool - DIAGNOSTIC MODE');
        console.log('='.repeat(60) + '\n');
        
        const folders = await getFolders();
        
        if (!folders || folders.length === 0) {
            console.log('No folders found in your GoLogin account');
            return;
        }
        
        console.log('Available Folders:\n');
        folders.forEach((folder, index) => {
            console.log(`${index + 1}. ${folder.name} (ID: ${folder.id})`);
        });
        
        const folderChoice = await askQuestion('\nEnter folder number: ');
        const selectedFolder = folders[parseInt(folderChoice) - 1];
        
        if (!selectedFolder) {
            console.log('Invalid folder selection');
            return;
        }
        
        logger.log(`Selected folder: ${selectedFolder.name}`);
        
        const profiles = await getAllProfiles(selectedFolder.name);
        
        logger.log(`Found ${profiles.length} profile(s) in folder`);
        
        if (profiles.length === 0) {
            console.log('No profiles found in this folder');
            return;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`PROFILES IN FOLDER: ${selectedFolder.name}`);
        console.log('='.repeat(60));
        profiles.forEach((profile, index) => {
            console.log(`${index + 1}. ${profile.name} (ID: ${profile.id})`);
        });
        console.log('='.repeat(60) + '\n');
        
        console.log('\n' + '='.repeat(60));
        console.log('Select Operation Mode:\n');
        console.log('1. Search GitHub by keyword and target URL');
        console.log('2. Extract repos from blog links');
        console.log('='.repeat(60) + '\n');
        
        const mode = await askQuestion('Enter mode (1 or 2): ');
        
        let options = {};
        
        if (mode === '1') {
            const keyword = await askQuestion('Enter search keyword: ');
            const targetUrl = await askQuestion('Enter target URL (part of repo URL): ');
            options = { keyword, targetUrl };
        } else if (mode === '2') {
            console.log('\nEnter blog links (one per line, enter empty line when done):');
            const blogLinks = [];
            while (true) {
                const link = await askQuestion('Blog URL: ');
                if (!link.trim()) break;
                blogLinks.push(link.trim());
            }
            
            if (blogLinks.length === 0) {
                console.log('No blog links provided');
                return;
            }
            
            options = { blogLinks };
        } else {
            console.log('Invalid mode selection');
            return;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('Starting automation in DIAGNOSTIC MODE...');
        console.log('This will provide detailed logging to help identify issues');
        console.log('='.repeat(60) + '\n');
        
        const results = [];
        
        for (const profile of profiles) {
            const result = await automateProfile(profile, mode, options);
            results.push(result);
            
            if (profiles.indexOf(profile) < profiles.length - 1) {
                logger.log('Waiting 10 seconds before next profile...\n');
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('AUTOMATION SUMMARY');
        console.log('='.repeat(60) + '\n');
        
        const successful = results.filter(r => r.success).length;
        const skipped = results.filter(r => !r.success && r.skipped).length;
        const failed = results.filter(r => !r.success && !r.skipped).length;
        
        console.log(`Total Profiles: ${results.length}`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`⏭️  Skipped: ${skipped}`);
        console.log(`❌ Failed: ${failed}\n`);
        
        if (successful > 0) {
            console.log('Successfully Starred:');
            results.filter(r => r.success).forEach(r => {
                console.log(`  ✅ ${r.profile} - ${r.repo}`);
            });
            console.log('');
        }
        
        if (skipped > 0) {
            console.log('Skipped:');
            results.filter(r => !r.success && r.skipped).forEach(r => {
                console.log(`  ⏭️  ${r.profile} - ${r.reason}`);
            });
            console.log('');
        }
        
        if (failed > 0) {
            console.log('Failed:');
            results.filter(r => !r.success && !r.skipped).forEach(r => {
                console.log(`  ❌ ${r.profile}: ${r.reason}`);
            });
        }
        
        await logger.saveLogs();
        
        console.log('\n' + '='.repeat(60));
        console.log('Check the log file for detailed diagnostic information');
        console.log('='.repeat(60));
        
    } catch (error) {
        logger.error(`Fatal error: ${error.message}`);
        console.error(error);
    } finally {
        rl.close();
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});