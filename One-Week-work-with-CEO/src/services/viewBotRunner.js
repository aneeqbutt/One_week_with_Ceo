import puppeteer from 'puppeteer-core';
import axios from 'axios';
import readline from 'node:readline';

let GoLogin;

// Initialize GoLogin when needed (works in ESM)
async function initGoLogin() {
  if (!GoLogin) {
    try {
      const mod = await import('gologin');
      GoLogin = mod.GoLogin || (mod.default && mod.default.GoLogin) || mod.default;
    } catch (err) {
      console.error('Failed to import GoLogin:', err);
      throw new Error('GoLogin module not available');
    }
  }
  return GoLogin;
}

// Configuration
const config = {
  gologinApiToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTEyZDcyMmE3OWI2NTc3MDIwNTIzOGYifQ.pMYl_8aiEW93c04zvBMqTxJaMd-MoZoFN1nVmb-gXsw',
  dataImpulseApiKey: '', // Leave empty if you don't have one
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

// Create profile with advanced fingerprinting
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
    name: `ViewBot_${Date.now()}`,
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

async function createProfileDirectAPI(proxy) {
  // This function is now replaced by createProfileWithFingerprint()
  // Keep for backwards compatibility but not used
  throw new Error('Use createProfileWithFingerprint() instead');
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
  } catch (error) {
    console.error('Error deleting profile:', error.message);
  }
}

async function naturalScroll(page, minSeconds = 60, maxSeconds = 90) {
  const duration = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
  const scrollSteps = Math.floor(duration / 2000);
  
  for (let i = 0; i < scrollSteps; i++) {
    const scrollDirection = Math.random() > 0.3 ? 1 : -1;
    const scrollAmount = (Math.floor(Math.random() * 300) + 200) * scrollDirection;
    
    await page.evaluate((amount) => {
      window.scrollBy({
        top: amount,
        behavior: 'smooth'
      });
    }, scrollAmount);
    
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
  }
}

async function searchGoogleAndNavigate(page, keyword, targetUrl, logFn) {
  try {
    logFn(`Searching Google for: "${keyword}"`);
    
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    await page.waitForSelector('textarea[name="q"], input[name="q"]', { timeout: 10000 });
    const searchBox = await page.$('textarea[name="q"]') || await page.$('input[name="q"]');
    await searchBox.type(keyword, { delay: 100 });
    await page.keyboard.press('Enter');

    logFn('Waiting for search results...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    logFn('Looking for target URL in results...');

    const cleanTargetUrl = targetUrl.replace('https://', '').replace('http://', '').replace('www.', '');
    
    const linkFound = await page.evaluate((cleanUrl) => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const href = link.href || '';
        if (href.includes(cleanUrl)) {
          link.click();
          return true;
        }
      }
      return false;
    }, cleanTargetUrl);

    if (!linkFound) {
      throw new Error('Target URL not found in search results');
    }

    logFn('Target page loaded, scrolling...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await naturalScroll(page, 60, 90);
    
    logFn('View completed successfully');
    return true;
  } catch (error) {
    logFn(`Error during Google search: ${error.message}`);
    throw error;
  }
}

async function navigateDirectlyToRepo(page, repoUrl, logFn) {
  try {
    logFn(`Navigating directly to: ${repoUrl}`);
    
    await page.goto(repoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    logFn('Repo loaded, scrolling...');
    await naturalScroll(page, 60, 90);
    
    logFn('View completed successfully');
    return true;
  } catch (error) {
    logFn(`Error navigating to repo: ${error.message}`);
    throw error;
  }
}

/**
 * Run a single view with GoLogin profile
 * @param {Object} options
 * @param {number} options.viewNumber - Current view number
 * @param {number} options.totalViews - Total views to execute
 * @param {string} options.searchType - 'keyword' or 'about'
 * @param {string} options.searchQuery - The search query
 * @param {string} options.repoUrl - The GitHub repo URL
 * @param {Function} options.logFn - Logging function
 */
export async function runViewBot(options) {
  const { viewNumber, totalViews, searchType, searchQuery, repoUrl, logFn = console.log } = options;
  
  await initGoLogin();
  
  let GL = null;
  let browser = null;
  let profileId = null;

  try {
    logFn(`[View ${viewNumber}/${totalViews}] Creating GoLogin profile with fingerprint...`);
    profileId = await createProfileWithFingerprint();
    logFn(`[View ${viewNumber}/${totalViews}] Profile created: ${profileId}`);

    logFn(`[View ${viewNumber}/${totalViews}] Initializing GoLogin...`);
    GL = new GoLogin({
      token: config.gologinApiToken,
      profile_id: profileId
      // Note: NOT passing extra_params for debugging port as GoLogin manages this internally
    });

    logFn(`[View ${viewNumber}/${totalViews}] Starting browser...`);
    const { status, wsUrl } = await GL.start();
    
    // Log the WebSocket URL being used
    logFn(`[View ${viewNumber}/${totalViews}] Browser WebSocket: ${wsUrl}`);

    if (status !== 'success' || !wsUrl) {
      throw new Error('Failed to start GoLogin browser');
    }

    browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      ignoreHTTPSErrors: true
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Execute based on search type
    if (searchType === 'keyword') {
      await searchGoogleAndNavigate(page, searchQuery, repoUrl, logFn);
    } else {
      // For 'about' type, navigate directly to repo
      await navigateDirectlyToRepo(page, repoUrl, logFn);
    }

    return {
      profileId,
      searchType,
      searchQuery,
      repoUrl,
      success: true
    };

  } catch (error) {
    logFn(`[View ${viewNumber}/${totalViews}] Error: ${error.message}`);
    throw error;
  } finally {
    try {
      if (browser) {
        logFn(`[View ${viewNumber}/${totalViews}] Closing browser...`);
        await browser.close();
      }
    } catch (e) {
      console.error('Error closing browser:', e.message);
    }

    try {
      if (GL) {
        logFn(`[View ${viewNumber}/${totalViews}] Stopping GoLogin profile...`);
        await GL.stop();
      }
    } catch (e) {
      console.error('Error stopping GoLogin:', e.message);
    }

    try {
      if (profileId) {
        logFn(`[View ${viewNumber}/${totalViews}] Deleting profile...`);
        await deleteProfileDirectAPI(profileId);
      }
    } catch (e) {
      console.error('Error deleting profile:', e.message);
    }
  }
}
