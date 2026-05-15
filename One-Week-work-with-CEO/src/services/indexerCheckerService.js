import puppeteer from 'puppeteer-core';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

let GologinApi;

// Initialize GoLogin API when needed (works in ESM)
async function initGologinApi() {
  if (!GologinApi) {
    try {
      const mod = await import('gologin');
      GologinApi = mod.GologinApi || (mod.default && mod.default.GologinApi) || mod.default;
    } catch (err) {
      console.error('Failed to import GologinApi:', err);
      throw new Error('GologinApi module not available');
    }
  }
  return GologinApi;
}

// Configuration
const config = {
  gologinApiToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTEyZDcyMmE3OWI2NTc3MDIwNTIzOGYifQ.pMYl_8aiEW93c04zvBMqTxJaMd-MoZoFN1nVmb-gXsw',
  gologinApiUrl: 'https://api.gologin.com',
  // Proxy configuration with country rotation to avoid rate limits
  getRandomProxy: () => {
    const countries = ['us', 'gb', 'ca', 'au', 'de', 'fr', 'nl', 'se'];
    const randomCountry = countries[Math.floor(Math.random() * countries.length)];
    return {
      mode: 'http',
      host: 'gw.dataimpulse.com',
      port: 823,
      username: `364a87d67519885f4520__cr.${randomCountry}`,
      password: 'c55e092b8405598b'
    };
  }
};

// Pool of realistic user agents
const userAgentPool = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Create profile with fingerprint using direct API
async function createProfileWithFingerprint() {
  // Select random user agent
  const userAgent = userAgentPool[Math.floor(Math.random() * userAgentPool.length)];
  const isMac = userAgent.includes('Macintosh');
  const isLinux = userAgent.includes('Linux');
  
  let os = 'win';
  let platform = 'Win32';
  
  if (isMac) {
    os = 'mac';
    platform = 'MacIntel';
  } else if (isLinux) {
    os = 'lin';
    platform = 'Linux x86_64';
  }

  // Get a random proxy configuration with country rotation
  const proxyConfig = config.getRandomProxy();
  console.log('🌍 Using proxy country:', proxyConfig.username.split('__cr.')[1]);

  const profileData = {
    name: `IndexChecker_${Date.now()}`,
    browserType: 'chrome',
    os: os,
    navigator: {
      language: 'en-US',
      platform: platform,
      userAgent: userAgent,
      resolution: '1920x1080',
      hardwareConcurrency: 8,
      deviceMemory: 8
    },
    fonts: {
      families: isMac ? [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
        'Helvetica', 'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana'
      ] : [
        'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
        'Courier New', 'Georgia', 'Impact', 'Times New Roman', 'Verdana'
      ]
    },
    webRTC: {
      mode: 'alerted',
      enabled: true,
      customize: true,
      localIpMasking: true,
      fillBasedOnIp: true
    },
    canvas: {
      mode: 'noise'
    },
    webGL: {
      mode: 'noise'
    },
    webGLMetadata: {
      mode: 'mask',
      vendor: isMac ? 'Intel Inc.' : 'Google Inc. (NVIDIA)',
      renderer: isMac ? 'Intel(R) Iris(TM) Plus Graphics 640' : 'ANGLE (NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)'
    },
    audioContext: {
      mode: 'noise'
    },
    mediaDevices: {
      mode: 'noise',
      audioInputs: 1,
      audioOutputs: 2,
      videoInputs: 1
    },
    timezone: {
      enabled: true,
      fillBasedOnIp: true
    },
    geolocation: {
      mode: 'prompt',
      enabled: true,
      customize: true,
      fillBasedOnIp: true
    },
    proxy: proxyConfig
  };

  console.log('🎭 Creating profile with fingerprint...');
  console.log('👤 User Agent:', userAgent);
  console.log('💻 OS:', os);
  console.log('🖥️ Platform:', platform);

  try {
    const response = await axios.post(
      `${config.gologinApiUrl}/browser`,
      profileData,
      {
        headers: {
          'Authorization': `Bearer ${config.gologinApiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Profile created successfully:', response.data.id);
    return response.data.id;
  } catch (error) {
    console.error('❌ API Error Status:', error.response?.status);
    console.error('❌ API Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.error('❌ API Error Message:', error.message);
    throw error;
  }
}

async function deleteProfileDirectAPI(profileId) {
  try {
    await axios.delete(
      `${config.gologinApiUrl}/browser/${profileId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.gologinApiToken}`
        }
      }
    );
    console.log('✅ Profile deleted successfully:', profileId);
    return { status: 'success' };
  } catch (error) {
    console.error('❌ Error deleting profile:', error.message);
    throw error;
  }
}

// Helper function to wait/sleep (compatible with all Puppeteer versions)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Global rate limiter to track last request time across all instances
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 30000; // Minimum 30 seconds between requests

async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`⏳ Rate limiting: Waiting ${Math.round(waitTime)}ms before next request...`);
    await sleep(waitTime);
  }
  
  lastRequestTime = Date.now();
}

class IndexerCheckerService {
  constructor() {
    // No persistent browser - each check creates its own GoLogin profile
  }

  /**
   * Extract repository name from GitHub URL
   */
  extractRepoName(repoUrl) {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', '')
      };
    }
    return null;
  }

  /**
   * Load cookies from file
   */
  async loadCookies(page) {
    try {
      const cookiesPath = path.join(process.cwd(), 'src', 'services', 'google_cookies.json');
      console.log('🍪 Loading cookies from:', cookiesPath);
      
      if (fs.existsSync(cookiesPath)) {
        const cookiesString = fs.readFileSync(cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesString);
        
        // Convert cookie format if needed and set cookies
        for (const cookie of cookies) {
          await page.setCookie({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            expires: cookie.expirationDate || undefined,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: cookie.sameSite || 'Lax'
          });
        }
        
        console.log(`✅ Loaded ${cookies.length} cookies successfully`);
        return true;
      } else {
        console.log('⚠️ No cookies file found at:', cookiesPath);
        return false;
      }
    } catch (error) {
      console.error('❌ Error loading cookies:', error.message);
      return false;
    }
  }

  /**
   * Check if repository is indexed on Google
   */
  async checkIndexing(searchQuery, repoUrl, searchType = 'keyword', retryCount = 0, maxRetries = 3) {
    // Wrap entire operation in a timeout to prevent hanging
    const timeout = 180000; // 3 minutes total timeout
    
    return Promise.race([
      this._checkIndexingInternal(searchQuery, repoUrl, searchType, retryCount, maxRetries),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Index check operation timed out after 3 minutes')), timeout)
      )
    ]);
  }

  /**
   * Internal implementation of checkIndexing
   */
  async _checkIndexingInternal(searchQuery, repoUrl, searchType = 'keyword', retryCount = 0, maxRetries = 3) {
    const GologinApiClass = await initGologinApi();
    
    let gologin = null;
    let browser = null;
    let profileId = null;
    let page = null;

    try {
      // Enforce global rate limiting before starting
      await enforceRateLimit();
      
      console.log('\n🔍 ===== STARTING INDEX CHECK =====');
      console.log('🔎 Search Query:', searchQuery);
      console.log('🔗 Repository URL:', repoUrl);
      console.log('📋 Search Type:', searchType);
      
      // Add exponential backoff delay if this is a retry
      if (retryCount > 0) {
        const backoffDelay = Math.min(60000, (Math.pow(2, retryCount) * 10000) + (Math.random() * 10000)); // Max 60 seconds
        console.log(`🔄 Retry attempt ${retryCount}/${maxRetries} - Waiting ${Math.round(backoffDelay)}ms before retry...`);
        await sleep(backoffDelay);
      }

      // Create profile with fingerprint using direct API
      console.log('🌐 Creating GoLogin profile with fingerprint...');
      profileId = await createProfileWithFingerprint();

      // Initialize GoLogin API for launching
      console.log('🔧 Initializing GologinApi for browser launch...');
      
      try {
        // GoLogin API should be called as a function, not with 'new'
        gologin = GologinApiClass({
          token: config.gologinApiToken,
          tmpdir: path.join(process.cwd(), '.gologin', 'tmp')
        });
        
        console.log('✅ GologinApi initialized successfully');
      } catch (initError) {
        console.error('❌ Failed to initialize GologinApi:', initError.message);
        throw new Error(`GoLogin API initialization failed: ${initError.message}`);
      }

      // Launch browser with the profile
      console.log('🚀 Launching browser...');
      
      // Add timeout and retry logic for browser launch
      let launchAttempts = 0;
      const maxLaunchAttempts = 3;
      
      while (launchAttempts < maxLaunchAttempts) {
        try {
          // Let GoLogin manage the debugging port internally
          const launchResult = await gologin.launch({ 
            profileId,
            headless: false, // Set to false to avoid connection issues
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--disable-blink-features=AutomationControlled',
              '--disable-web-security',
              '--disable-features=IsolateOrigins,site-per-process'
              // Note: NOT setting --remote-debugging-port as GoLogin manages this internally
            ],
            executablePath: undefined, // Let GoLogin determine the path
            timeout: 60000 // 60 second timeout for launch
          });
          
          browser = launchResult.browser;
          
          // Log the actual port being used (if available)
          if (browser && browser._connection && browser._connection._url) {
            console.log('🔌 Browser connected via:', browser._connection._url);
          }
          
          // Verify browser is connected
          if (browser && browser.isConnected()) {
            console.log('✅ Browser launched and connected successfully');
            break;
          } else {
            throw new Error('Browser launched but not connected');
          }
          
        } catch (launchError) {
          launchAttempts++;
          console.error(`❌ Browser launch attempt ${launchAttempts}/${maxLaunchAttempts} failed:`, launchError.message);
          
          if (launchAttempts >= maxLaunchAttempts) {
            throw new Error(`Failed to launch browser after ${maxLaunchAttempts} attempts: ${launchError.message}`);
          }
          
          // Wait before retry
          console.log('⏳ Waiting 5 seconds before retry...');
          await sleep(5000);
          
          // Clean up failed browser instance
          if (browser) {
            try {
              await browser.close();
            } catch (e) {
              // Ignore cleanup errors
            }
            browser = null;
          }
        }
      }

      // Add crash handler
      browser.on('disconnected', () => {
        console.error('❌ Browser disconnected unexpectedly');
      });

      // Verify browser connection before proceeding
      if (!browser || !browser.isConnected()) {
        throw new Error('Browser is not properly connected after launch');
      }

      const pages = await browser.pages();
      page = pages[0] || await browser.newPage();
      
      // Verify page is created
      if (!page) {
        throw new Error('Failed to create or get browser page');
      }

      // Handle page crashes
      page.on('error', err => {
        console.error('❌ Page crashed:', err);
      });

      page.on('pageerror', err => {
        console.error('❌ Page error:', err);
      });

      // Set viewport to realistic size
      try {
        await page.setViewport({
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1
        });
        console.log('✅ Viewport set');
      } catch (viewportErr) {
        console.warn('⚠️ Could not set viewport:', viewportErr.message);
      }

      // Apply stealth techniques to avoid detection
      console.log('🕵️ Applying stealth techniques...');
      
      // Override navigator properties to appear more human (minimal to avoid crashes)
      try {
        await page.evaluateOnNewDocument(() => {
          // Remove webdriver flag - most critical
          delete Object.getPrototypeOf(navigator).webdriver;
        });
        console.log('✅ Stealth techniques applied');
      } catch (stealthErr) {
        console.warn('⚠️ Could not apply some stealth techniques:', stealthErr.message);
      }

      // Verify the fingerprint is being used
      console.log('🔍 Verifying fingerprint/user agent...');
      try {
        const userAgent = await page.evaluate(() => navigator.userAgent);
        console.log('✅ Browser User Agent:', userAgent);
      } catch (verifyErr) {
        console.warn('⚠️ Could not verify fingerprint:', verifyErr.message);
      }

      // Load cookies before navigating
      await this.loadCookies(page);

      // Set default timeout for all operations
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);

      // CRITICAL: Visit Google homepage first to establish session and get cookies
      console.log('🏠 Visiting Google homepage first to establish session...');
      try {
        await page.goto('https://www.google.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Wait and simulate human behavior on homepage - INCREASED DELAY
        const homepageDelay = 5000 + Math.random() * 5000; // 5-10 seconds (increased from 2-5)
        console.log(`⏱️ Spending ${Math.round(homepageDelay)}ms on homepage...`);
        await sleep(homepageDelay);

        // Simulate mouse movement on homepage
        try {
          await page.mouse.move(200 + Math.random() * 300, 150 + Math.random() * 200);
        } catch (mouseErr) {
          console.log('⚠️ Mouse simulation skipped:', mouseErr.message);
        }
        
        // Try to accept any consent dialog on homepage
        try {
          const consentButton = await page.$('button#L2AGLb, button[aria-label="Accept all"]');
          if (consentButton) {
            console.log('ℹ️ Accepting consent on homepage...');
            await sleep(1000);
            await consentButton.click();
            await sleep(2000);
          }
        } catch (consentErr) {
          console.log('⚠️ No consent dialog on homepage or already accepted');
        }

        console.log('✅ Homepage visit completed, session established');
      } catch (homepageErr) {
        console.log('⚠️ Error visiting homepage:', homepageErr.message);
        console.log('⚠️ Continuing anyway...');
      }

      // Construct Google search URL
      const encodedQuery = encodeURIComponent(searchQuery);
      const googleSearchUrl = `https://www.google.com/search?q=${encodedQuery}`;
      
      console.log('🌐 Navigating to Google Search...');
      console.log('🔗 URL:', googleSearchUrl);

      // Add random delay before navigation (human-like behavior) - SIGNIFICANTLY INCREASED
      const preNavigationDelay = 10000 + Math.random() * 10000; // 10-20 seconds (increased from 2-5)
      console.log(`⏱️ Waiting ${Math.round(preNavigationDelay)}ms before search...`);
      await sleep(preNavigationDelay);

      // Navigate to Google search with more realistic wait conditions
      const response = await page.goto(googleSearchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Check for 403 or other error responses
      const statusCode = response.status();
      console.log('📊 Response Status Code:', statusCode);

      if (statusCode === 403) {
        console.error('❌ 403 FORBIDDEN - Google has blocked this request');
        console.error('🔴 This usually means:');
        console.error('   1. Too many requests from this IP/fingerprint');
        console.error('   2. Proxy is flagged/blacklisted');
        console.error('   3. Browser fingerprint is detected as bot');
        
        // Take screenshot for debugging
        try {
          const screenshotDir = path.join(process.cwd(), 'debug-screenshots');
          if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
          }
          const screenshotPath = path.join(screenshotDir, `403-error-${Date.now()}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log('📸 Error screenshot saved:', screenshotPath);
        } catch (screenshotErr) {
          console.log('⚠️ Failed to save error screenshot:', screenshotErr.message);
        }

        throw new Error('Google returned 403 Forbidden - Request blocked by anti-bot protection');
      }

      if (statusCode === 429) {
        console.error('❌ 429 TOO MANY REQUESTS - Rate limited by Google');
        
        // Retry with exponential backoff if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log(`🔄 Will retry after backoff delay (attempt ${retryCount + 1}/${maxRetries})...`);
          
          // Clean up current resources before retry
          try {
            if (browser) await browser.close();
            if (profileId) await deleteProfileDirectAPI(profileId);
            if (gologin && typeof gologin.exit === 'function') await gologin.exit();
          } catch (cleanupErr) {
            console.error('⚠️ Cleanup error before retry:', cleanupErr.message);
          }
          
          // Recursive retry with incremented counter
          return await this._checkIndexingInternal(searchQuery, repoUrl, searchType, retryCount + 1, maxRetries);
        } else {
          console.error('❌ Max retries exceeded. Giving up.');
          throw new Error('Google rate limit exceeded - Too many requests (max retries exceeded)');
        }
      }

      if (statusCode >= 400) {
        console.error(`❌ HTTP Error ${statusCode}`);
        throw new Error(`Google returned error status: ${statusCode}`);
      }

      console.log('✅ Page loaded successfully');

      // Add longer delay after page load to avoid rate limiting
      const postLoadDelay = 5000 + Math.random() * 5000; // 5-10 seconds (increased)
      console.log(`⏱️ Page loaded, waiting ${Math.round(postLoadDelay)}ms...`);
      await sleep(postLoadDelay);

      // Simulate human-like mouse movement and scrolling
      console.log('🖱️ Simulating human behavior...');
      try {
        // Multiple mouse movements to appear more human
        for (let i = 0; i < 3; i++) {
          await page.mouse.move(300 + Math.random() * 400, 200 + Math.random() * 400);
          await sleep(500 + Math.random() * 1000);
        }

        // Scroll down slightly (human-like)
        await page.evaluate(() => {
          window.scrollBy({
            top: 150,
            left: 0,
            behavior: 'smooth'
          });
        });
        await sleep(2000 + Math.random() * 2000); // 2-4 seconds (increased)
        console.log('✅ Human behavior simulation completed');
      } catch (humanErr) {
        console.log('⚠️ Could not complete human behavior simulation:', humanErr.message);
      }

      // Save screenshot for debugging
      try {
        const screenshotDir = path.join(process.cwd(), 'debug-screenshots');
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        const screenshotPath = path.join(screenshotDir, `google-search-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('📸 Screenshot saved:', screenshotPath);
      } catch (screenshotErr) {
        console.log('⚠️ Failed to save screenshot:', screenshotErr.message);
      }

      // Wait for search results to load and handle potential consent dialogs
      try {
        await page.waitForSelector('#search', { timeout: 15000 });
      } catch (err) {
        console.log('⚠️ Search results container not found immediately, trying to handle consent dialog or continue...');

        // Try to accept cookie/consent dialogs that block results
        try {
          // Wait a bit before trying to click consent
          await sleep(1000);

          // common consent buttons
          const consentSelectors = [
            'button#L2AGLb',
            'button[aria-label="Accept all"]',
            'button[aria-label="I agree"]',
            'form[action*="consent"] button'
          ];

          for (const sel of consentSelectors) {
            const btn = await page.$(sel);
            if (btn) {
              console.log('ℹ️ Found consent button selector:', sel, '- clicking it');
              
              // Simulate human-like click with delay
              await sleep(500 + Math.random() * 1000);
              await btn.click();
              await sleep(2000); // Wait longer after consent
              break;
            }
          }

          // Try searching for consent buttons by visible text using a page.evaluate DOM scan
          try {
            const clickedText = await page.evaluate(() => {
              const patterns = ['accept all', 'i agree', 'accept', 'agree'];
              const candidates = Array.from(document.querySelectorAll('button, a'));
              for (const el of candidates) {
                const text = (el.innerText || '').trim().toLowerCase();
                if (!text) continue;
                for (const p of patterns) {
                  if (text === p || text.includes(p)) {
                    try { el.click(); } catch (e) { /* ignore */ }
                    return text;
                  }
                }
              }
              return null;
            });
            if (clickedText) {
              console.log('ℹ️ Clicked consent-like button with text:', clickedText);
              await sleep(2000);
            }
          } catch (evalErr) {
            console.log('⚠️ Consent text-scan attempt failed inside page.evaluate:', evalErr.message);
          }
        } catch (consentErr) {
          console.log('⚠️ Consent handling attempt failed:', consentErr.message);
        }

        // final attempt to wait for search container
        try {
          await page.waitForSelector('#search', { timeout: 10000 });
        } catch (finalErr) {
          console.log('⚠️ Still could not find search container after consent attempts, continuing to try extracting results...');
        }
      }

      // Extract search results using robust selectors (h3 inside links in #search)
      console.log('📊 Extracting search results...');

      // Check if page is still alive
      if (page.isClosed()) {
        throw new Error('Page was closed unexpectedly');
      }

      const results = await page.evaluate(() => {
        const items = [];
        try {
          // Try multiple strategies to find search results
          
          // Strategy 1: Look for h3 elements inside #search area
          const searchContainer = document.querySelector('#search, #rso, #center_col');
          if (searchContainer) {
            const h3Elements = searchContainer.querySelectorAll('h3');
            h3Elements.forEach((h3) => {
              try {
                const link = h3.closest('a') || h3.parentElement?.querySelector('a') || h3.parentElement?.parentElement?.querySelector('a');
                if (link && link.href) {
                  const title = h3.innerText || '';
                  const url = link.href || '';
                  // Find description near the h3
                  const container = h3.closest('div[data-sokoban-container], .g, .tF2Cxc') || h3.parentElement?.parentElement;
                  const descEl = container?.querySelector('.VwiC3b, .yXK7lf, .s3v9rd, [style*="line-height"]');
                  const desc = descEl?.innerText || '';
                  
                  // Only add if it looks like a real result (has github.com or reasonable URL)
                  if (url && !url.includes('google.com/search') && !url.includes('google.com/url?')) {
                    items.push({ position: items.length + 1, url, title, description: desc });
                  }
                }
              } catch (e) {
                // ignore per-item errors
              }
            });
          }
          
          // Strategy 2: Fallback - look for all links with h3 children
          if (items.length === 0) {
            const allLinks = Array.from(document.querySelectorAll('a'));
            allLinks.forEach((a) => {
              try {
                const h3 = a.querySelector('h3');
                if (h3 && a.href && !a.href.includes('google.com/search')) {
                  const title = h3.innerText || '';
                  const url = a.href || '';
                  items.push({ position: items.length + 1, url, title, description: '' });
                }
              } catch (e) {
                // ignore
              }
            });
          }
        } catch (e) {
          console.error('Error in page.evaluate:', e);
        }
        return items;
      });

      console.log(`📋 Found ${results.length} search results`);

      // Check if the repository URL is in the results
      const repoInfo = this.extractRepoName(repoUrl);
      const normalizedRepoUrl = repoUrl.toLowerCase().replace(/\/$/, '');
      
      console.log('\n🔎 Searching for repository in results...');
      console.log('🎯 Target URL:', normalizedRepoUrl);

      let foundResult = null;
      
      for (const result of results) {
        const normalizedResultUrl = result.url.toLowerCase().replace(/\/$/, '');
        
        // Check if URL matches (exact or contains the repo path)
        const urlMatches = normalizedResultUrl.includes(normalizedRepoUrl) ||
                          normalizedResultUrl.includes(`github.com/${repoInfo.owner}/${repoInfo.repo}`);
        
        if (urlMatches) {
          console.log('✅ FOUND! Repository is indexed on Google');
          console.log('📍 Position:', result.position);
          console.log('🔗 URL:', result.url);
          console.log('📝 Title:', result.title);
          
          foundResult = {
            indexed: true,
            position: result.position,
            url: result.url,
            title: result.title,
            description: result.description,
            foundUrl: result.url
          };
          break;
        }
      }

      if (!foundResult) {
        console.log('❌ Repository NOT FOUND in first page of results');
        foundResult = {
          indexed: false,
          searchedPages: 1,
          totalResults: results.length,
          message: 'Repository not found in the first page of Google search results'
        };
      }

      console.log('='.repeat(50) + '\n');

      return foundResult;

    } catch (error) {
      console.error('❌ Error checking indexing:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Handle specific connection errors
      if (error.message && error.message.includes('ECONNREFUSED')) {
        const portMatch = error.message.match(/127\.0\.0\.1:(\d+)/);
        const port = portMatch ? portMatch[1] : 'unknown';
        
        console.error('🔴 CONNECTION REFUSED ERROR DETECTED');
        console.error('🔴 Port:', port);
        console.error('🔴 This usually means:');
        console.error('   1. GoLogin browser failed to start properly');
        console.error('   2. The debug port is not accessible');
        console.error('   3. Firewall or antivirus blocking the connection');
        console.error('   4. GoLogin service not running or crashed');
        
        // Retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          console.log(`🔄 Will retry due to connection error (attempt ${retryCount + 1}/${maxRetries})...`);
          
          // Clean up current resources before retry
          try {
            if (browser) await browser.close().catch(() => {});
            if (profileId) await deleteProfileDirectAPI(profileId).catch(() => {});
            if (gologin && typeof gologin.exit === 'function') await gologin.exit().catch(() => {});
          } catch (cleanupErr) {
            console.error('⚠️ Cleanup error before retry:', cleanupErr.message);
          }
          
          // Longer delay for connection errors
          await sleep(10000);
          
          // Recursive retry with incremented counter
          return await this._checkIndexingInternal(searchQuery, repoUrl, searchType, retryCount + 1, maxRetries);
        }
        
        throw new Error(`Failed to connect to browser (ECONNREFUSED on port ${port}) after ${maxRetries} attempts. Please check if GoLogin service is running properly.`);
      }
      
      throw new Error(`Failed to check indexing: ${error.message || JSON.stringify(error)}`);
    } finally {
      // Cleanup: close browser, delete profile, and exit gologin
      console.log('\n🧹 Starting cleanup...');
      
      try {
        if (browser) {
          console.log('🔒 Closing browser...');
          await browser.close();
          console.log('✅ Browser closed');
        }
      } catch (e) {
        console.error('❌ Error closing browser:', e.message);
      }

      try {
        if (profileId) {
          console.log('🗑️ Deleting GoLogin profile:', profileId);
          const deleteResult = await deleteProfileDirectAPI(profileId);
          console.log('✅ Profile deleted successfully. Status:', deleteResult.status);
        } else {
          console.log('⚠️ No profile to delete');
        }
      } catch (e) {
        console.error('❌ Error deleting profile:', e.message);
        console.error('❌ Delete error details:', e);
      }

      // Exit gologin to cleanup all resources
      try {
        if (gologin && typeof gologin.exit === 'function') {
          console.log('🚪 Exiting gologin...');
          await gologin.exit();
          console.log('✅ Gologin exited successfully');
        }
      } catch (e) {
        console.error('❌ Error exiting gologin:', e.message);
      }

      console.log('✅ Cleanup completed\n');
    }
  }

  /**
   * Cleanup - no longer needed as profiles are created per-check
   */
  async cleanup() {
    console.log('✅ IndexerCheckerService cleanup (no-op - profiles are cleaned per-check)');
  }
}

// Create singleton instance
const indexerCheckerService = new IndexerCheckerService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️ Received SIGINT, closing browser...');
  await indexerCheckerService.cleanup();
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Received SIGTERM, closing browser...');
  await indexerCheckerService.cleanup();
});

export { indexerCheckerService };
