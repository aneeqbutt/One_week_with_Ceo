import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import electron from 'electron';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

const { app } = electron;

dotenv.config();

const COOKIES_PATH = './cookies.json';

/**
 * Process scraped Apify data with ChatGPT using Puppeteer with cookie-based auth
 */

export async function processApifyDataWithChatGPT(scrapedData, logFn = console.log, cookies = null, platform = 'bitbash', skipBranding = false) {
logFn(`🤖 Processing data with ChatGPT for: ${scrapedData.title}`);
  logFn(`🎨 Using platform branding: ${platform}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Set a realistic user agent for headless mode
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Attach console handler similar to chatgptScraper for useful logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Autofill') || text.includes("wasn't found")) return;
      if (msg.type() === 'error' && !text.includes('Autofill')) {
        logFn('Browser console error: ' + text);
      }
    });

    // Load cookies - use provided cookies or load from file
    const cookiesLoaded = await loadCookies(page, logFn, cookies);

    logFn(`📱 Opening ChatGPT...`);
    // Navigate to the ChatGPT URL (chatgpt.com is used when cookies rely on __Secure-next-auth.session-token)
    await page.goto('https://chatgpt.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if we need to login
    const isLoggedIn = await page.evaluate(() => {
      return !document.URL.includes('/auth/login');
    });

    if (!isLoggedIn) {
      logFn(`⚠️ ChatGPT requires login. Please login manually...`);
      logFn(`⏳ Waiting for login... (You have 120 seconds)`);
      
      // Wait for user to login manually
      try {
        await page.waitForNavigation({ 
          waitUntil: 'networkidle2', 
          timeout: 120000 
        });
      } catch (e) {
        // Check if we're logged in even without navigation
        const stillNotLoggedIn = await page.evaluate(() => {
          return document.URL.includes('/auth/login');
        });
        
        if (stillNotLoggedIn) {
          throw new Error('Login timeout. Please try again.');
        }
      }
      
      logFn(`✅ Login detected, saving cookies...`);
      
      // Save cookies for future use
      await saveCookies(page, logFn);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      logFn(`✅ Logged in using saved cookies`);
    }

    logFn(`✅ ChatGPT ready`);

    // Prepare the comprehensive prompt
    const prompt = buildPrompt(scrapedData);

    logFn(`📝 Sending prompt to ChatGPT (${prompt.length} characters)...`);

    // Wait for textarea
    await page.waitForSelector('textarea, div[contenteditable="true"]', { timeout: 30000 });

    // Send the entire prompt as a single message
    await sendPromptAsSingleMessage(page, prompt, logFn);

    logFn(`⏳ Waiting for ChatGPT response...`);

    // Wait for response to appear and complete
    await waitForResponse(page, logFn);

    // Extract the response
    logFn(`📥 Extracting response...`);
    const responseText = await extractResponseFromDOM(page, logFn);

    if (!responseText) {
      throw new Error('Failed to extract response from ChatGPT');
    }

    logFn(`✅ Received response from ChatGPT (${responseText.length} characters)`);

    // Parse the response to extract repo metadata and README
    const result = parseGPTResponse(responseText, scrapedData, platform, skipBranding);

    return result;

  } catch (error) {
    logFn(`❌ ChatGPT processing failed: ${error.message}`);
    throw new Error(`Failed to process with ChatGPT: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Load cookies from file or provided cookies array
 */
async function loadCookies(page, logFn, cookiesArray = null) {
  try {
    // If cookies array is provided, use it directly
    if (cookiesArray && Array.isArray(cookiesArray) && cookiesArray.length > 0) {
      try {
        // Sanitize cookies for Puppeteer / DevTools Protocol compatibility
        const sanitized = cookiesArray.map(c => {
          try {
            const out = {
              name: c.name || c.key || '',
              value: c.value || c.session || c.sessionToken || '',
              domain: c.domain,
              path: c.path || '/',
              secure: !!c.secure,
              httpOnly: !!c.httpOnly
            };

            // expirationDate -> expires (DevTools expects number of seconds)
            if (c.expirationDate && !isNaN(Number(c.expirationDate))) {
              out.expires = Math.floor(Number(c.expirationDate));
            }

            // Normalize sameSite values to Strict, Lax, None (case-sensitive per protocol)
            if (c.sameSite) {
              const s = String(c.sameSite).toLowerCase();
              if (s === 'lax') out.sameSite = 'Lax';
              else if (s === 'strict') out.sameSite = 'Strict';
              else if (s === 'none' || s === 'no_restriction' || s === 'no-restrictions' || s === 'no-restriction') out.sameSite = 'None';
              // otherwise omit invalid sameSite
            }

            // Drop empty-name/value cookies
            if (!out.name || out.value === undefined || out.value === null) return null;

            return out;
          } catch (e) {
            return null;
          }
        }).filter(Boolean);

        if (sanitized.length === 0) {
          logFn(`⚠️ No valid cookies found in provided array`);
          return false;
        }

        await page.setCookie(...sanitized);
        logFn(`🍪 Loaded ${sanitized.length} cookies from provided array`);
        return true;
      } catch (e) {
        logFn(`⚠️ Failed to set cookies from array: ${e.message}`);
      }
    }
    
    // Otherwise, load from file (fallback)
    // Try userData path first (Electron app data), fall back to current directory
    let finalPath;
    try {
      const userDataPath = app.getPath('userData');
      const candidate = path.join(userDataPath, 'cookies.json');
      if (fs.existsSync(candidate)) {
        finalPath = candidate;
      }
    } catch (e) {
      // app.getPath may fail in some contexts; ignore and try cwd
    }

    if (!finalPath) {
      const cwdCandidate = path.join(process.cwd(), 'cookies.json');
      if (fs.existsSync(cwdCandidate)) finalPath = cwdCandidate;
    }

    if (!finalPath && fs.existsSync(COOKIES_PATH)) finalPath = COOKIES_PATH;

    if (!finalPath) {
      return false;
    }

    const cookiesString = fs.readFileSync(finalPath, 'utf8');
    const cookies = JSON.parse(cookiesString);

    // If cookies is an object with sessionToken, set the session cookie expected by chatgptScraper
    if (cookies && (cookies.sessionToken || cookies['__Secure-next-auth.session-token'])) {
      const sessionToken = cookies.sessionToken || cookies['__Secure-next-auth.session-token'];
      try {
        await page.setCookie({
          name: '__Secure-next-auth.session-token',
          value: sessionToken,
          domain: '.chatgpt.com',
          path: '/',
          secure: true,
          httpOnly: true
        });
        logFn(`🍪 Loaded session token cookie from: ${finalPath}`);
        return true;
      } catch (e) {
        logFn(`⚠️ Failed to set session token cookie: ${e.message}`);
      }
    }

    // Otherwise, if it's an array of cookie objects, set them directly
    if (Array.isArray(cookies) && cookies.length > 0) {
      try {
        // Sanitize cookies for Puppeteer / DevTools Protocol compatibility
        const sanitized = cookies.map(c => {
          try {
            const out = {
              name: c.name || c.key || '',
              value: c.value || c.session || c.sessionToken || '',
              domain: c.domain,
              path: c.path || '/',
              secure: !!c.secure,
              httpOnly: !!c.httpOnly
            };

            // expirationDate -> expires (DevTools expects number of seconds)
            if (c.expirationDate && !isNaN(Number(c.expirationDate))) {
              out.expires = Math.floor(Number(c.expirationDate));
            }

            // Normalize sameSite values to Strict, Lax, None (case-sensitive per protocol)
            if (c.sameSite) {
              const s = String(c.sameSite).toLowerCase();
              if (s === 'lax') out.sameSite = 'Lax';
              else if (s === 'strict') out.sameSite = 'Strict';
              else if (s === 'none' || s === 'no_restriction' || s === 'no-restrictions' || s === 'no-restriction') out.sameSite = 'None';
              // otherwise omit invalid sameSite
            }

            // Drop empty-name/value cookies
            if (!out.name || out.value === undefined || out.value === null) return null;

            return out;
          } catch (e) {
            return null;
          }
        }).filter(Boolean);

        if (sanitized.length === 0) {
          logFn(`⚠️ No valid cookies found in file: ${finalPath}`);
          return false;
        }

        await page.setCookie(...sanitized);
        logFn(`🍪 Loaded ${sanitized.length} cookies from file: ${finalPath}`);
        return true;
      } catch (e) {
        logFn(`⚠️ Failed to set cookies from file: ${e.message}`);
      }
    }

    return false;
  } catch (error) {
    logFn(`⚠️ Could not load cookies: ${error.message}`);
    return false;
  }
}

/**
 * Save cookies to file
 */
async function saveCookies(page, logFn) {
  try {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    logFn(`🍪 Saved ${cookies.length} cookies to file`);
  } catch (error) {
    logFn(`⚠️ Could not save cookies: ${error.message}`);
  }
}

/**
 * Send the entire prompt as a single message (no chunking)
 */
async function sendPromptAsSingleMessage(page, prompt, logFn) {
  logFn(`📤 Preparing to send prompt as single message...`);
  
  try {
    // Method 1: Use clipboard paste (most reliable for long text)
    logFn(`⌨️ Using clipboard paste method...`);
    
    // Copy prompt to clipboard
    await page.evaluate((text) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }, prompt);
    
    // Find textarea and focus it
    const textareaSelector = 'textarea#prompt-textarea, textarea[placeholder*="Message"], div[contenteditable="true"]';
    await page.waitForSelector(textareaSelector, { timeout: 10000 });
    await page.click(textareaSelector);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Paste using keyboard shortcut
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyV');
    await page.keyboard.up('Control');
    
    logFn(`✅ Prompt pasted successfully`);
    
    // Wait for the text to appear
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the text was pasted
    const textContent = await page.evaluate((selector) => {
      const textarea = document.querySelector(selector);
      return textarea ? (textarea.value || textarea.textContent || textarea.innerText) : '';
    }, textareaSelector);
    
    if (textContent.length < prompt.length * 0.9) {
      logFn(`⚠️ Clipboard paste may have failed, trying direct DOM method...`);
      await sendPromptDirectDOM(page, prompt, textareaSelector);
    }
    
  } catch (error) {
    logFn(`⚠️ Clipboard method failed: ${error.message}, trying direct DOM method...`);
    const textareaSelector = 'textarea#prompt-textarea, textarea[placeholder*="Message"], div[contenteditable="true"]';
    await sendPromptDirectDOM(page, prompt, textareaSelector);
  }
  
  // Wait a moment for the text to be processed
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Find and click send button
  logFn(`📤 Sending message...`);
  const sendButtonSelector = 'button[data-testid="send-button"], button[aria-label*="Send"]';
  
  try {
    await page.waitForSelector(sendButtonSelector, { timeout: 5000 });
    await page.click(sendButtonSelector);
  } catch (e) {
    // Fallback: press Enter
    logFn(`⚠️ Send button not found, using Enter key...`);
    await page.keyboard.press('Enter');
  }
  
  logFn(`✅ Message sent`);
}

/**
 * Send prompt by directly manipulating the DOM
 */
async function sendPromptDirectDOM(page, prompt, textareaSelector) {
  await page.evaluate((selector, text) => {
    const textarea = document.querySelector(selector);
    if (textarea) {
      // For textarea elements
      if (textarea.tagName.toLowerCase() === 'textarea') {
        textarea.value = text;
        
        // Trigger input events to make sure ChatGPT detects the change
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } 
      // For contenteditable divs
      else if (textarea.contentEditable === 'true') {
        textarea.textContent = text;
        textarea.innerText = text;
        
        // Trigger input events
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, textareaSelector, prompt);
}

/**
 * Wait for response to complete
 */
async function waitForResponse(page, logFn) {
  let previousLength = 0;
  let stableCount = 0;
  const maxStableChecks = 5;
  const checkInterval = 2000;

  logFn(`⏳ Waiting for response to complete...`);

  while (stableCount < maxStableChecks) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));

    const currentContent = await page.evaluate(() => {
      const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (assistantMessages.length > 0) {
        const lastMessage = assistantMessages[assistantMessages.length - 1];
        return (lastMessage.innerText || lastMessage.textContent || '').length;
      }
      return 0;
    });

    if (currentContent === previousLength && currentContent > 100) {
      stableCount++;
      logFn(`✓ Content stable (${stableCount}/${maxStableChecks})`);
    } else {
      stableCount = 0;
      logFn(`⏳ Content growing: ${currentContent} characters`);
    }

    previousLength = currentContent;
  }

  logFn(`✅ Response complete`);
}

/**
 * Build comprehensive prompt from scraped data
 */
function buildPrompt(scrapedData) {
  // Check if this is Upwork data with niche information
  if (scrapedData.source === 'upwork' && scrapedData.niche) {
    return buildUpworkPrompt(scrapedData);
  }
  
  // Default Apify prompt
  return `You are a GitHub Repository Documentation Generator.

I have scraped data from an Apify actor page. Your job is to transform this data into a GitHub-ready repository structure.

**Scraped Data:**
- **Title:** ${scrapedData.title}
- **Description:** ${scrapedData.description || 'Not available'}
- **Categories:** ${scrapedData.categories.join(', ') || 'Not available'}

**README Content (HTML):**
${scrapedData.readmeContent || 'Not available'}

**Features (HTML):**
${scrapedData.featuresContent || 'Not available'}

**Use Cases (HTML):**
${scrapedData.useCasesContent || 'Not available'}

**Pricing Info (HTML):**
${scrapedData.pricingContent || 'Not available'}

**Stats:**
${JSON.stringify(scrapedData.stats, null, 2)}

---

You are a GitHub Repository Documentation Generator.
You will be given one Apify Actor Web page scraped Data.
Your job is to transform that data into a GitHub-ready repository, consisting strictly of two main parts only:
Repo Info Block (metadata)
README.md (strict Markdown format)
Your output must be clean, GitHub-formatted Markdown, ready for direct publishing — no extra commentary, no meta text, and absolutely no more than two fenced code blocks total.no extra text even for json response or directory structure.
:jigsaw: OUTPUT REQUIREMENTS
Repo Info Block (first fenced block in pgsql):
Repo Name: <create SEO-friendly repo name: ALWAYS use format {full-tool-name}-scraper (e.g., "upcheck-monitor-scraper" not just "upcheck"). Use hyphens to separate words. Include the complete tool name from the title.>
Description: <main keyword + 2–3 descriptive words (under 6 words)>
Related Topics: <8–10 comma-separated topics including the keyword and 2–3 technical terms never add apify  >
README.md (second fenced block in markdown):
Everything related to the README must stay inside the same second fenced block — this includes introduction, features, data fields, example output, directory structure, use cases, FAQs, and performance sections.
:blue_book: README.md STRUCTURE
# <Project Title>
> Write 2–3 engaging sentences that describe what the project does, the core problem it solves, and the value it delivers.
> Keep it SEO-friendly, natural, and clear — include the main keyword once or twice.
## Introduction
Explain:
- What this project does
- What problem it solves
- Who it’s for
### <Contextual Subheading>
- Choose a relevant subheading (based on project purpose).
- List 3–5 concise, fact-driven bullet points explaining its key aspects or capabilities.
---
## Features
| Feature | Description |
|----------|-------------|
| Feature 1 | Explain the benefit and function clearly. |
| Feature 2 | Continue listing as many as are relevant. |
---
## What Data This Scraper Extracts
| Field Name | Field Description |
|-------------|------------------|
| field_name | Explain what data this field holds. |
| ... | ... |
---
## Example Output
<If available, include example data block. Skip this section if not present.>
<do not use \`\`\` , >
<write this output with tab space behind>
Example:
    [
          {
            "facebookUrl": "https://www.facebook.com/nytimes/",
            "pageId": "5281959998",
            "postId": "10153102374144999",
            "pageName": "The New York Times",
            "url": "https://www.facebook.com/nytimes/posts/pfbid02meAxCj1jLx1jJFwJ9GTXFp448jEPRK58tcPcH2HWuDoogD314NvbFMhiaint4Xvkl",
            "time": "Thursday, 6 April 2023 at 06:55",
            "timestamp": 1680789311000,
            "likes": 22,
            "comments": 2,
            "shares": null,
            "text": "Four days before the wedding they emailed family members a “save the date” invite. It was void of time, location and dress code — the couple were still deciding those details.",
            "link": "https://nyti.ms/3KAutlU"
          }
        ]
---
## Directory Structure Tree
<Assume it’s a complete working project. Show a detailed and realistic folder and file structure with correct extensions.
All directory structure code must remain inside this same fenced block.>
Example:
    facebook-posts-scraper/
    ├── src/
    │   ├── runner.py
    │   ├── extractors/
    │   │   ├── facebook_parser.py
    │   │   └── utils_time.py
    │   ├── outputs/
    │   │   └── exporters.py
    │   └── config/
    │       └── settings.example.json
    ├── data/
    │   ├── inputs.sample.txt
    │   └── sample.json
    ├── docs/
    │   └── README.md
    ├── requirements.txt
    ├── LICENSE
    └── README.md
---
## Use Cases
List 3–5 real-world use cases showing how users benefit:
- **[Who]** uses it to **[do what]**, so they can **[achieve what benefit].**
- Each bullet must be practical and outcome-oriented.
---
## FAQs
Write 2–4 relevant questions a user might ask.
Each should include a detailed, informative answer that adds clarity about setup, limitations, or supported operations.
---
## Performance Benchmarks and Results
Provide realistic, project-specific performance insights using measurable language:
- **Primary Metric:** e.g., average scraping speed or accuracy rate.
- **Reliability Metric:** e.g., success rate or stability.
- **Efficiency Metric:** e.g., throughput or resource usage.
- **Quality Metric:** e.g., data completeness or precision.
Each statement should sound grounded in real-world usage, not placeholders.
:compass: GENERAL RULES
Formatting
Output only two fenced code blocks total.
Do not break README sections into separate fences — everything stays inside one.
Do not include generator comments, meta text, or explanations.
Keep Markdown hierarchy clean and consistent.
use triple \`\`\` inside the readme code fence no problem.
Tone
Marketing-friendly yet professional.
Write as if introducing a quality open-source tool to developers.
Use natural, clear English — no robotic or filler language.
Content
Include every required section listed above.
Infer missing data logically and realistically.
Never reference Apify, scraping origins, or internal system details.
Quality
README should look like a fully polished GitHub project.
Keep the text detailed but concise, visually balanced, and human-like.
Naturally include the main keyword in key sections for SEO.
:no_entry_sign: ABSOLUTE RESTRICTIONS
Never open more than two fenced code blocks.
Never use triple backticks inside the second fenced block.
Never output explanation lines, summaries, or extra commentary.
Never label the blocks — only open and close them cleanly.`;
// NOTE: Inside the template literal above any triple backticks were escaped in-source to avoid
// prematurely closing the surrounding template. If you edit this template, ensure any
// backtick characters are escaped as \` (three backticks -> \`\`\`).
}

/**
 * Build Upwork-specific prompt based on niche
 */
function buildUpworkPrompt(scrapedData) {
  const { title, description, niche } = scrapedData;
  
  // Load appropriate prompt template based on niche
  const promptTemplate = niche === 'Scraping' 
    ? getUpworkScraperPrompt() 
    : getUpworkAutomationPrompt();
  
  // Build job data section
  const jobData = `INPUT
Upwork Job Post: 
Job Title: ${title}
Job Description: ${description}`;
  
  return `${promptTemplate}\n\n${jobData}`;
}

/**
 * Get Upwork Scraper README prompt template
 */
function getUpworkScraperPrompt() {
  // Read from prompts/upwork-scraper-readme.txt
  try {
    const promptPath = path.join(process.cwd(), 'prompts', 'upwork-scraper-readme.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('Failed to load Upwork scraper prompt:', error);
    throw new Error('Upwork scraper prompt file not found');
  }
}

/**
 * Get Upwork Automation README prompt template
 */
function getUpworkAutomationPrompt() {
  // Read from prompts/upwork-automation-readme.txt
  try {
    const promptPath = path.join(process.cwd(), 'prompts', 'upwork-automation-readme.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('Failed to load Upwork automation prompt:', error);
    throw new Error('Upwork automation prompt file not found');
  }
}

/**
 * IMPROVED: Extract response from DOM and strip ChatGPT's syntax highlighting
 */
/**
 * FIXED: Extract FULL response from DOM including both code blocks and surrounding text
 */
async function extractResponseFromDOM(page, logFn = console.log) {
  logFn(`🔍 Extracting FULL response from ChatGPT DOM...`);

  let extractedText = await page.evaluate(() => {
    console.log('=== DOM EXTRACTION START ===');

    function extractFullContent(element) {
      if (!element) return '';

      const clone = element.cloneNode(true);
      clone.querySelectorAll('button, [class*="copy"], [aria-label*="Copy"]').forEach(el => el.remove());

      const markdownDiv = clone.querySelector('.markdown, [class*="markdown"]');
      const targetElement = markdownDiv || clone;

      // CRITICAL FIX: Reconstruct markdown with code fences from code blocks
      let fullText = '';
      
      // Find all code blocks (pre > code) and reconstruct with fences
      const codeBlocks = targetElement.querySelectorAll('pre');
      if (codeBlocks.length > 0) {
        // Walk through all children to preserve order
        const walker = document.createTreeWalker(
          targetElement,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        let lastProcessedPre = null;
        
        while (node = walker.nextNode()) {
          // Skip if already processed as part of a pre block
          if (lastProcessedPre && lastProcessedPre.contains(node)) {
            continue;
          }
          
          if (node.nodeName === 'PRE') {
            lastProcessedPre = node;
            const code = node.querySelector('code');
            if (code) {
              // Get language from class (e.g., "language-pgsql")
              const langClass = code.className.match(/language-(\w+)/);
              const lang = langClass ? langClass[1] : '';
              
              // Reconstruct code fence
              fullText += `\n\`\`\`${lang}\n${code.textContent}\n\`\`\`\n`;
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            // Add text nodes
            const text = node.textContent.trim();
            if (text) {
              fullText += text + '\n';
            }
          } else if (node.nodeName === 'P' || node.nodeName === 'H1' || node.nodeName === 'H2' || node.nodeName === 'H3') {
            // For paragraphs and headers, get their text if not already processed
            if (!lastProcessedPre || !lastProcessedPre.contains(node)) {
              const text = node.textContent.trim();
              if (text && !fullText.includes(text)) {
                fullText += text + '\n';
              }
            }
          }
        }
      } else {
        // Fallback to textContent if no code blocks
        fullText = targetElement.textContent || targetElement.innerText || '';
      }
      
      fullText = fullText.replace(/Copy code/gi, '').replace(/\n{3,}/g, '\n\n').trim();

      return fullText;
    }

    const selectors = [
      '[data-message-author-role="assistant"]:last-child',
      'div[data-message-author-role="assistant"]:last-of-type',
      '.markdown.prose:last-of-type',
      'article:last-child [data-message-author-role="assistant"]',
      'div[class*="markdown"]:last-of-type'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        const extracted = extractFullContent(elements[elements.length - 1]);
        if (extracted && extracted.trim().length > 100) {
          return extracted;
        }
      }
    }

    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (assistantMessages.length > 0) {
      const extracted = extractFullContent(assistantMessages[assistantMessages.length - 1]);
      if (extracted && extracted.trim().length > 100) return extracted;
    }

    return null;
  });

  if (!extractedText) {
    logFn('❌ No meaningful content extracted.');
    return null;
  }

  // --- NEW SECTION: Detect and convert plain text README to Markdown ---
  const looksPlainText = !/[#_*`>[\]]/.test(extractedText) && /\breadme\b/i.test(extractedText);

  if (looksPlainText) {
    logFn('🪄 Detected plain text README — converting to Markdown...');
    const markdown = await remark().use(remarkGfm).use(remarkHtml).process(extractedText);
    extractedText = markdown.toString();
  }

  logFn(`✅ Extraction complete (${extractedText.length} chars)`);
  return extractedText;
}

/**
 * ENHANCED: Sanitize markdown and fix nested code blocks
 */
function sanitizeMarkdownForSyntax(md) {
  if (!md || typeof md !== 'string') return md;

  console.log('=== MARKDOWN SANITIZATION START ===');
  console.log(`Input length: ${md.length} characters`);

  // Step 1: Normalize newlines and remove control chars
  md = md.replace(/\r\n/g, '\n');
  md = md.replace(/\t/g, '  ');
  md = md.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  // Step 2: Remove "Copy code" artifacts
  md = md.replace(/\bCopy code\b/ig, '');

  // Step 3: Fix nested code blocks (CRITICAL FIX)
  md = fixNestedCodeBlocks(md);

  // Step 4: Balance code fences
  md = balanceCodeFences(md);

  // Step 5: Fix specific code block issues
  md = fixCodeBlockSyntax(md);

  // Step 6: Clean up excessive whitespace
  md = md.replace(/\n{4,}/g, '\n\n\n'); // Max 3 newlines
  md = md.trim();

  console.log(`Output length: ${md.length} characters`);
  console.log('=== MARKDOWN SANITIZATION COMPLETE ===');

  return md;
}

/**
 * Fix nested code blocks - the main issue
 */
function fixNestedCodeBlocks(md) {
  console.log('Fixing nested code blocks...');
  
  const initialBackticks = (md.match(/```/g) || []).length;
  console.log(`  Initial backtick count: ${initialBackticks}`);

  // Pattern: Outer code block containing inner code blocks
  const outerBlockPattern = /^```(?:markdown|md|yaml|yml)?\s*\n([\s\S]*)\n```\s*$/;
  const match = md.match(outerBlockPattern);
  
  if (match) {
    console.log('  ✅ Detected outer code block wrapper, unwrapping...');
    md = match[1];
    md = fixInnerCodeBlocks(md);
  } else {
    md = fixInnerCodeBlocks(md);
  }

  const finalBackticks = (md.match(/```/g) || []).length;
  console.log(`  Final backtick count: ${finalBackticks}`);

  return md;
}

/**
 * Fix inner code blocks that might be malformed
 */
function fixInnerCodeBlocks(md) {
  const lines = md.split('\n');
  const result = [];
  let inCodeBlock = false;
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        const langMatch = trimmed.match(/^```(\w+)?/);
        codeBlockLang = langMatch && langMatch[1] ? langMatch[1] : '';
        inCodeBlock = true;
        result.push(line);
      } else {
        inCodeBlock = false;
        codeBlockLang = '';
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  if (inCodeBlock) {
    console.log('  ⚠️ Unclosed code block detected, adding closing fence');
    result.push('```');
  }

  return result.join('\n');
}

/**
 * Balance code fences
 */
function balanceCodeFences(md) {
  const fences = (md.match(/```/g) || []).length;
  
  if (fences % 2 !== 0) {
    console.log(`  ⚠️ Unbalanced code fences (${fences}), adding closing fence`);
    const lastFenceIndex = md.lastIndexOf('```');
    const afterLastFence = md.substring(lastFenceIndex + 3).trim();
    
    if (afterLastFence.length > 10) {
      md = md + '\n```';
    } else {
      const lines = md.split('\n');
      let openBlocks = 0;
      let insertPosition = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('```')) {
          openBlocks = openBlocks === 0 ? 1 : 0;
        }
        
        if (openBlocks === 1 && 
            (lines[i].trim().startsWith('#') || 
             (lines[i].trim().length > 0 && i > 0 && lines[i-1].trim() === ''))) {
          insertPosition = i;
          break;
        }
      }
      
      if (insertPosition > 0) {
        lines.splice(insertPosition, 0, '```');
        md = lines.join('\n');
      } else {
        md = md + '\n```';
      }
    }
  }

  return md;
}

/**
 * Fix syntax issues within code blocks
 */
function fixCodeBlockSyntax(md) {
  md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (full, langRaw, code) => {
    const lang = (langRaw || '').toLowerCase();
    let fixed = code;

    try {
      if (lang === 'json') {
        fixed = fixJsonSyntax(fixed);
      } else if (lang === 'js' || lang === 'javascript') {
        fixed = balancePairs(fixed);
      } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
        fixed = fixBashSyntax(fixed);
      }
      
      fixed = fixed.replace(/\u0000/g, '');
      fixed = fixed.replace(/\s+$/gm, '').trim();
      
    } catch (e) {
      console.warn(`  ⚠️ Error fixing ${lang} code block:`, e.message);
      fixed = code.replace(/\u0000/g, '');
    }

    const langTag = lang ? lang : '';
    return '```' + langTag + '\n' + fixed + '\n```';
  });

  return md;
}

/**
 * Fix JSON syntax issues
 */
function fixJsonSyntax(json) {
  try {
    JSON.parse(json);
    return json;
  } catch (e) {
    let fixed = json
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/,\s*$/gm, '')
      .replace(/(\s*)([a-zA-Z_][a-zA-Z0-9_]*?)(\s*):/g, '$1"$2"$3:');
    
    try {
      JSON.parse(fixed);
      return fixed;
    } catch (e2) {
      return json;
    }
  }
}

/**
 * Fix bash/shell syntax issues
 */
function fixBashSyntax(bash) {
  bash = bash.replace(/\r\n/g, '\n');
  
  bash = bash
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--');
  
  return bash;
}

/**
 * Balance parentheses, braces, and brackets in code
 */
function balancePairs(code) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const opens = Object.keys(pairs).join('');
  const closes = Object.values(pairs).join('');
  const stack = [];
  
  for (let ch of code) {
    if (opens.includes(ch)) {
      stack.push(ch);
    } else if (closes.includes(ch)) {
      const last = stack[stack.length - 1];
      if (last && pairs[last] === ch) {
        stack.pop();
      }
    }
  }
  
  while (stack.length) {
    const open = stack.pop();
    code += pairs[open] || '';
  }
  
  return code;
}

/**
 * ENHANCED: Parse ChatGPT response with improved sanitization
 */
/**
 * Extract topics from metadata block with comprehensive pattern support
 * Handles: comma-separated, multi-line, bullet points, arrays, quoted strings, etc.
 */
function extractTopicsFromMetadata(metadataBlock) {
  console.log('\n🔍 Extracting topics with comprehensive pattern matching...');
  console.log(`📋 Metadata block length: ${metadataBlock.length} chars`);
  console.log(`📋 Metadata preview:\n${metadataBlock.substring(0, 500)}\n`);
  
  const topics = [];
  
  // Pattern 1: Single line with label (comma, semicolon, pipe separated)
  const singleLinePatterns = [
    /(?:Related Topics|Topics|Tags|Keywords):\s*([^\n]+)/i,
    /(?:Related Topics|Topics|Tags|Keywords)\s*[=:]\s*([^\n]+)/i,
  ];
  
  for (const pattern of singleLinePatterns) {
    const match = metadataBlock.match(pattern);
    if (match) {
      console.log(`  ✅ Found single-line topics with pattern: ${pattern}`);
      const rawTopics = match[1];
      console.log(`  📝 Raw topics string: "${rawTopics}"`);
      
      // Try various delimiters: comma, semicolon, pipe, newline
      const delimiters = [',', ';', '|', '\n'];
      let extracted = [];
      
      for (const delimiter of delimiters) {
        if (rawTopics.includes(delimiter)) {
          extracted = rawTopics.split(delimiter).map(t => t.trim()).filter(t => t.length > 0);
          console.log(`  🔍 Split by '${delimiter}': found ${extracted.length} topics`);
          if (extracted.length > 1) break;
        }
      }
      
      // If no delimiter worked, try space-separated (if multiple words)
      if (extracted.length === 0) {
        extracted = [rawTopics.trim()];
        console.log(`  🔍 No delimiter found, using full string as single topic`);
      }
      
      console.log(`  📊 Extracted topics: ${JSON.stringify(extracted)}`);
      topics.push(...extracted);
      if (topics.length > 0) {
        console.log(`  ✅ Returning ${topics.length} topics from single-line match`);
        return cleanTopicsArray(topics);
      }
    }
  }
  
  // Pattern 2: Multi-line topics (bullet points or numbered)
  const multiLineMatch = metadataBlock.match(
    /(?:Related Topics|Topics|Tags|Keywords):\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i
  );
  
  if (multiLineMatch) {
    console.log('  ✅ Found multi-line topics');
    const lines = multiLineMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    for (const line of lines) {
      // Remove bullet points, numbers, dashes
      const cleaned = line.replace(/^[-*•\d\.\)]+\s*/, '').trim();
      if (cleaned.length > 0 && !cleaned.match(/^[A-Z][a-z]+\s*:/)) {
        topics.push(cleaned);
      }
    }
    
    if (topics.length > 0) return cleanTopicsArray(topics);
  }
  
  // Pattern 3: Array format ["topic1", "topic2"] or ['topic1', 'topic2']
  const arrayMatch = metadataBlock.match(
    /(?:Related Topics|Topics|Tags|Keywords):\s*\[([\s\S]*?)\]/i
  );
  
  if (arrayMatch) {
    console.log('  ✅ Found array-formatted topics');
    const arrayContent = arrayMatch[1];
    const items = arrayContent.match(/["']([^"']+)["']/g);
    
    if (items) {
      topics.push(...items.map(item => item.replace(/["']/g, '').trim()));
      if (topics.length > 0) return cleanTopicsArray(topics);
    }
  }
  
  // Pattern 4: Inline within metadata (no explicit label, after description)
  const inlineMatch = metadataBlock.match(
    /Description:[^\n]*\n\s*([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+){2,})/i
  );
  
  if (inlineMatch) {
    console.log('  ✅ Found inline topics after description');
    topics.push(...inlineMatch[1].split(',').map(t => t.trim()));
    if (topics.length > 0) return cleanTopicsArray(topics);
  }
  
  // Pattern 5: Anywhere in metadata with common topic keywords
  const anywhereMatch = metadataBlock.match(
    /(?:scraper|automation|api|data|web|tool|bot|monitor|tracker|parser|extractor|crawler|fetcher)(?:\s*,\s*(?:[a-z0-9-]+)){2,}/i
  );
  
  if (anywhereMatch) {
    console.log('  ✅ Found topics by keyword detection');
    topics.push(...anywhereMatch[0].split(',').map(t => t.trim()));
    if (topics.length > 0) return cleanTopicsArray(topics);
  }
  
  console.log('  ⚠️  No topics found with any pattern');
  return [];
}

/**
 * Clean and validate topics array
 */
function cleanTopicsArray(topics) {
  console.log(`🔍 cleanTopicsArray input: ${JSON.stringify(topics)}`);
  
  const cleaned = topics
    .map(t => {
      // Remove quotes, brackets, extra spaces
      let clean = t.replace(/["'\[\]()]/g, '').trim();
      
      // Remove leading bullets, numbers, dashes
      clean = clean.replace(/^[-*•\d\.\)]+\s*/, '');
      
      // GitHub topic rules: lowercase, alphanumeric + hyphens only
      // 1. Convert to lowercase first
      clean = clean.toLowerCase();
      
      // 2. Replace all whitespace (spaces, tabs, etc.) with hyphens
      clean = clean.replace(/\s+/g, '-');
      
      // 3. Replace all non-alphanumeric chars (including dots, underscores) with hyphens
      clean = clean.replace(/[^a-z0-9-]/g, '-');
      
      // 4. Collapse multiple consecutive hyphens into one
      clean = clean.replace(/-+/g, '-');
      
      // 5. Remove leading/trailing hyphens
      clean = clean.replace(/^-+|-+$/g, '');
      
      return clean;
    })
    .filter(t => {
      // GitHub limits: 1-50 chars, not just numbers
      const isValid = t.length > 0 && t.length <= 50 && !/^\d+$/.test(t);
      if (!isValid && t.length > 0) {
        console.log(`  ⚠️ Filtered out topic: "${t}" (length: ${t.length})`);
      }
      return isValid;
    })
    .slice(0, 20); // Max 20 topics per GitHub
  
  // Remove duplicates
  const result = [...new Set(cleaned)];
  console.log(`🔍 cleanTopicsArray output: ${JSON.stringify(result)}`);
  return result;
}

/**
 * FIXED: Parse ChatGPT response with improved metadata extraction
 */
function parseGPTResponse(responseText, scrapedData, platform = 'bitbash', skipBranding = false) {
  console.log('=== PARSING GPT RESPONSE ===');
  console.log(`Response length: ${responseText.length} characters`);
  console.log(`Platform: ${platform}`);
  
  let repoName = '';
  let description = '';
  let topics = [];
  let readme = '';
  
  try {
    // ===== STEP 1: Extract metadata block =====
    console.log('\n🔍 Step 1: Extracting metadata...');
    
    // More aggressive patterns to catch metadata
    const metadataPatterns = [
      // Pattern 1: Code block with metadata (any language identifier or none)
      /```(?:pgsql|sql|text|kotlin|yaml|yml|json)?\s*\n((?:Repo Name|Description|Related Topics):[\s\S]*?)\n```/i,
      
      // Pattern 2: Plain text metadata at start (no code block)
      /^((?:Repo Name|Description|Related Topics):[\s\S]*?)(?=\n#|\n\n#)/im,
      
      // Pattern 3: Metadata after language identifier
      /^(?:pgsql|sql|text|kotlin|yaml|yml|json)\s*\n((?:Repo Name|Description|Related Topics):[\s\S]*?)(?=\n#|\n\n#)/im,
      
      // Pattern 4: Catch metadata anywhere before markdown headers
      /((?:Repo Name|Description|Related Topics):[\s\S]*?)(?=\n#)/i,
    ];
    
    let metadataBlock = null;
    let metadataEndIndex = 0;
    
    for (let i = 0; i < metadataPatterns.length; i++) {
      const pattern = metadataPatterns[i];
      const match = responseText.match(pattern);
      if (match) {
        metadataBlock = match[1] || match[0];
        metadataEndIndex = match.index + match[0].length;
        console.log(`✅ Found metadata block with Pattern ${i + 1}`);
        console.log('Metadata preview:', metadataBlock.substring(0, 300));
        console.log(`Metadata length: ${metadataBlock.length} chars`);
        break;
      } else {
        console.log(`⚠️ Pattern ${i + 1} did not match`);
      }
    }
    
    if (metadataBlock) {
      // Extract individual fields with better patterns
      const repoMatch = metadataBlock.match(/Repo Name:\s*([^\n]+)/i);
      const descMatch = metadataBlock.match(/Description:\s*([^\n]+)/i);
      
      // Extract topics with comprehensive pattern matching
      topics = extractTopicsFromMetadata(metadataBlock);
      console.log(`🔍 DEBUG - Topics after extraction: ${JSON.stringify(topics)}`);
      console.log(`🔍 DEBUG - Topics type: ${typeof topics}, is array: ${Array.isArray(topics)}, length: ${topics?.length}`);
      
      if (repoMatch) {
        repoName = repoMatch[1].trim();
        console.log(`  📦 Repo Name extracted from GPT: "${repoName}"`);
      }
      
      if (descMatch) {
        description = descMatch[1].trim();
        console.log(`  📝 Description: ${description}`);
      }
      
      if (topics.length > 0) {
        console.log(`  🏷️  Topics extracted (${topics.length}): ${topics.join(', ')}`);
      } else {
        console.log(`  ⚠️  No topics found in metadata block`);
        console.log(`  📋 Full metadata block:\n${metadataBlock}`);
      }
    } else {
      console.log('⚠️  No metadata block found, will use fallbacks');
    }
    
    // ===== STEP 2: Extract README =====
    console.log('\n📄 Step 2: Extracting README...');
    
    // Get everything after metadata
    let remainingContent = metadataEndIndex > 0 
      ? responseText.substring(metadataEndIndex)
      : responseText;
    
    // Remove code fence markers around README
    const readmePatterns = [
      // Pattern 1: Explicit markdown code block
      /```(?:markdown|md)\s*\n([\s\S]+?)```/i,
      
      // Pattern 2: Content between any code fences
      /```\s*\n([\s\S]+?)```/,
      
      // Pattern 3: Just use remaining content
      /([\s\S]+)/
    ];
    
    for (const pattern of readmePatterns) {
      const match = remainingContent.match(pattern);
      if (match) {
        readme = match[1];
        console.log(`✅ README extracted (${readme.length} chars)`);
        break;
      }
    }
    
    // ===== STEP 3: Clean up README =====
    console.log('\n🧹 Step 3: Cleaning README...');
    readme = cleanupReadme(readme);
    
    // ===== STEP 4: Validate and use fallbacks =====
    console.log('\n✓ Step 4: Validating data...');
    // Try additional robust extraction methods for repo name before falling back
    if (!repoName) {
      // 4.1 Try to find an inline "Repo Name:" anywhere in the response (even if not in the first block)
      const inlineRepo = responseText.match(/Repo Name:\s*([^\n]+)/i);
      if (inlineRepo) {
        repoName = inlineRepo[1].trim();
        console.log(`  📦 Repo Name (inline match): "${repoName}"`);
      }
    }
    if (!repoName) {
      // 4.2 Try to read the top-level directory from the Directory Structure Tree (e.g., "upcheck-monitor-scraper/")
      // Pick the first standalone line that ends with "/" and isn't a common folder name
      const dirMatch = responseText.match(/^\s*([a-z0-9._-]{3,})\/\s*$/im);
      if (dirMatch && !/^(src|data|docs|tests|lib|app|dist|build)$/i.test(dirMatch[1])) {
        repoName = dirMatch[1];
        console.log(`  📦 Repo Name (directory tree): "${repoName}"`);
      }
    }
    if (!repoName) {
      // 4.3 Try using the README H1 title
      const h1 = readme.match(/^\s*#\s+(.+)$/m);
      if (h1 && h1[1]) {
        repoName = slugify(h1[1]);
        console.log(`  📦 Repo Name (from H1): "${repoName}"`);
      }
    }
    if (!repoName && Array.isArray(topics) && topics.length > 0) {
      // 4.4 Try a topic that looks like a repo name (prefer one ending with -scraper)
      const topicCandidate = topics.find(t => /-scraper\b/i.test(t)) || topics[0];
      if (topicCandidate) {
        repoName = slugify(topicCandidate);
        console.log(`  📦 Repo Name (from topics): "${repoName}"`);
      }
    }
    
    // Normalize to GitHub-friendly slug if still present
    if (repoName) {
      repoName = slugify(repoName);
    }
    
    // Final fallback to Apify actor title if nothing was extracted
    if (!repoName) {
      repoName = scrapedData.repoName || slugify(scrapedData.title);
      console.log(`⚠️  Using fallback repo name: ${repoName}`);
    }
    
    // IMPORTANT: Override repoName to match the title ONLY for Apify campaigns
    // For Upwork campaigns, we want to use GPT-generated repo name
    // This ensures consistency between the repo name and the title displayed in the branding section
    if (scrapedData.title && scrapedData.source !== 'upwork') {
      repoName = slugify(scrapedData.title);
      console.log(`  📦 Repo Name set to match branding title (Apify): "${repoName}"`);
    } else if (scrapedData.source === 'upwork') {
      console.log(`  📦 Repo Name from GPT (Upwork): "${repoName}"`);
    }
    
    if (!description) {
      description = scrapedData.description || scrapedData.title;
      console.log(`⚠️  Using fallback description`);
    }
    
    if (topics.length === 0) {
      topics = scrapedData.categories?.slice(0, 8) || [];
      console.log(`⚠️  Using fallback topics from categories: ${topics.length}`);
      if (topics.length > 0) {
        console.log(`  📋 Fallback topics: ${topics.join(', ')}`);
      }
    }
    
    console.log(`\n🔧 Sanitizing ${topics.length} topics before GitHub push...`);
    console.log(`🔍 DEBUG - Topics before sanitization: ${JSON.stringify(topics)}`);
    // Sanitize topics for GitHub (lowercase, hyphens only, max 50 chars)
    const sanitizedTopics = sanitizeTopics(topics);
    console.log(`🔍 DEBUG - Topics after sanitization: ${JSON.stringify(sanitizedTopics)}`);
    
    if (sanitizedTopics.length === 0 && topics.length > 0) {
      console.log(`⚠️  WARNING: All ${topics.length} topics were filtered out during sanitization!`);
      console.log(`  Original topics: ${topics.join(', ')}`);
    }
    
    // Create title from repo name
    const title = makeTitleFromRepoName(repoName) || scrapedData.title || '';
    
    // Use description for "about" field
    const about = description || scrapedData.description || scrapedData.title;
  
    // Conditionally inject branding (skip for Upwork to store clean README first)
    if (!skipBranding) {
      readme = injectBrandingSections(readme, repoName, platform);
      console.log('✅ HTML branding injected into README');
    } else {
      console.log('⏭️  Skipping HTML branding injection (will be added later)');
    }
    
    // ===== FINAL RESULTS =====
    console.log('\n📊 ===== PARSE RESULTS =====');
    console.log(`📦 Repo Name: ${repoName}`);
    console.log(`📝 About: ${about}`);
    console.log(`🏷️  Topics count: ${sanitizedTopics.length}`);
    console.log(`🏷️  Topics array: [${sanitizedTopics.join(', ')}]`);
    console.log(`🏷️  Topics is array: ${Array.isArray(sanitizedTopics)}`);
    console.log(`📄 README Length: ${readme.length} characters`);
    console.log('============================\n');
    
    const result = {
      repo_name: repoName,
      title: title,
      about: about,
      description: description,
      readme: readme,
      topics: sanitizedTopics,
      issues: [],
      sourceUrl: scrapedData.sourceUrl
    };
    
    console.log('🔍 FINAL CHECK - Result object topics:', result.topics);
    console.log('🔍 FINAL CHECK - Topics type:', typeof result.topics);
    console.log('🔍 FINAL CHECK - Is array:', Array.isArray(result.topics));
    
    return result;
    
  } catch (error) {
    console.error('❌ Error parsing GPT response:', error.message);
    console.error(error.stack);
    
    // Inject branding even in fallback using a repo-name-consistent label (unless skipped)
    let fallbackReadme = cleanupReadme(responseText);
    const __fallbackRepoName = (scrapedData.repoName || slugify(scrapedData.title || 'scraper'));
    if (!skipBranding) {
      fallbackReadme = injectBrandingSections(fallbackReadme, __fallbackRepoName, platform);
    }
    
    // Return fallback data
    return {
      repo_name: scrapedData.repoName || slugify(scrapedData.title),
      title: scrapedData.title,
      about: scrapedData.description || scrapedData.title,
      description: scrapedData.description || scrapedData.title,
      readme: fallbackReadme,
      topics: sanitizeTopics(scrapedData.categories?.slice(0, 8) || []),
      issues: [],
      sourceUrl: scrapedData.sourceUrl
    };
  }
}

/**
 * IMPROVED: Clean up README - remove ALL metadata and language markers
 */
export function cleanupReadme(readme) {
  if (!readme || typeof readme !== 'string') return '';
  
  console.log('🧹 Cleaning up README...');
  console.log(`  Input length: ${readme.length} chars`);
  
  // ===== Remove ALL metadata lines (case insensitive) =====
  readme = readme.replace(/^Repo Name:.*$/gim, '');
  readme = readme.replace(/^Description:.*$/gim, '');
  readme = readme.replace(/^Related Topics:.*$/gim, '');
  
  // ===== Remove language identifiers at start of lines =====
  readme = readme.replace(/^(?:kotlin|pgsql|sql|text|yaml|yml|json|markdown|md)\s*$/gim, '');
  
  // ===== Remove language identifiers attached to content (like "yaml#") =====
  readme = readme.replace(/^(?:kotlin|pgsql|sql|text|yaml|yml|json|markdown|md)#\s*/gim, '');
  
  // ===== Remove code fence markers =====
  readme = readme.replace(/^```(?:markdown|md|pgsql|sql|text|kotlin|yaml|yml|json)?\s*$/gm, '');
  
  // ===== Remove "README" or "README.md" as standalone heading =====
  readme = readme.replace(/^#+ README(?:\.md)?\s*$/gm, '');
  
  // ===== Remove horizontal rules at the very start =====
  readme = readme.replace(/^---+\s*\n/m, '');
  
  // ===== Remove ChatGPT artifacts =====
  readme = readme.replace(/\bCopy code\b/gi, '');
  
  // ===== Clean up whitespace =====
  readme = readme.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines
  readme = readme.replace(/[ \t]+$/gm, ''); // Remove trailing spaces
  readme = readme.trim();
  
  // ===== Remove leading junk lines =====
  const lines = readme.split('\n');
  let startIndex = 0;
  
  // Skip up to first 30 lines looking for actual content
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    
    // Skip these types of lines
    if (
      line === '' ||
      line === '---' ||
      line.match(/^(Repo Name|Description|Related Topics):/i) ||
      line.match(/^```/) ||
      line.match(/^(kotlin|pgsql|sql|text|yaml|yml|json|markdown|md)$/i) ||
      line.match(/^(kotlin|pgsql|sql|text|yaml|yml|json|markdown|md)#/i)
    ) {
      startIndex = i + 1;
      continue;
    }
    
    // Found actual content (heading or text)
    if (line.startsWith('#') || line.length > 10) {
      break;
    }
  }
  
  if (startIndex > 0) {
    readme = lines.slice(startIndex).join('\n').trim();
    console.log(`  ⏭️  Skipped ${startIndex} leading junk lines`);
  }
  
  // ===== Final cleanup pass =====
  // Remove any remaining metadata-like patterns at the very top
  readme = readme.replace(/^(?:Repo Name|Description|Related Topics):.*\n?/gim, '');
  
  // Remove empty lines at start
  readme = readme.replace(/^\n+/, '');
  
  console.log(`  ✅ README cleaned (${readme.length} chars)\n`);
  
  return readme;
}

/**
 * IMPROVED: Sanitize topics for GitHub requirements
 */
function sanitizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  
  console.log(`🏷️  Sanitizing ${topics.length} topics...`);
  
  const sanitized = topics
    .map(topic => {
      // 1. Convert to lowercase first
      let clean = topic.toLowerCase().trim();
      
      // 2. Replace all whitespace with hyphens
      clean = clean.replace(/\s+/g, '-');
      
      // 3. Replace all invalid characters with hyphens (only alphanumeric and hyphens allowed)
      clean = clean.replace(/[^a-z0-9-]/g, '-');
      
      // 4. Collapse multiple consecutive hyphens into one
      clean = clean.replace(/-+/g, '-');
      
      // 5. Remove leading/trailing hyphens
      clean = clean.replace(/^-+|-+$/g, '');
      
      return clean;
    })
    .filter(topic => {
      // GitHub requirements:
      // - Must be 1-50 chars
      // - Must have content
      // - Not just numbers
      return topic.length > 0 && topic.length <= 50 && !/^\d+$/.test(topic);
    })
    .slice(0, 20); // Max 20 topics per GitHub
  
  // Remove duplicates
  const uniqueSanitized = [...new Set(sanitized)];
  
  console.log(`  ✅ Sanitized to ${uniqueSanitized.length} valid topics`);
  console.log(`  Topics: ${uniqueSanitized.join(', ')}`);
  
  return uniqueSanitized;
}
/**
 * Helper: Make title from repo name
 */
function makeTitleFromRepoName(name) {
  if (!name) return '';
  
  return name
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper: Slugify text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Pretty print HTML with proper indentation
 */
function prettyPrintHtml(html) {
  if (!html || typeof html !== 'string') return html;

  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  
  try {
    let result = '';
    let indent = 0;
    const indentStr = '  ';
    
    html = html.replace(/>\s+</g, '><');
    
    const tags = html.match(/<[^>]+>/g) || [];
    const parts = html.split(/<[^>]+>/);
    
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const content = parts[i] ? parts[i].trim() : '';
      
      if (tag.startsWith('</')) {
        indent = Math.max(0, indent - 1);
        if (content) result += indentStr.repeat(indent) + content + '\n';
        result += indentStr.repeat(indent) + tag + '\n';
      } else if (tag.endsWith('/>') || voidTags.has(tag.match(/<(\w+)/)?.[1])) {
        if (content) result += indentStr.repeat(indent) + content + '\n';
        result += indentStr.repeat(indent) + tag + '\n';
      } else {
        if (content) result += indentStr.repeat(indent) + content + '\n';
        result += indentStr.repeat(indent) + tag + '\n';
        indent++;
      }
    }
    
    if (parts[parts.length - 1]) {
      result += indentStr.repeat(indent) + parts[parts.length - 1].trim();
    }
    
    return result.trim();
  } catch (e) {
    return html;
  }
}

/**
 * Process multiple scraped Apify data items with ChatGPT
 */
export async function processMultipleApifyDataWithGPT(scrapedDataList, logFn = console.log) {
  logFn(`🤖 Processing ${scrapedDataList.length} items with ChatGPT`);

  const results = [];

  for (let i = 0; i < scrapedDataList.length; i++) {
    const data = scrapedDataList[i];

    try {
      logFn(`\n[${i + 1}/${scrapedDataList.length}] Processing: ${data.title}`);
      const processed = await processApifyDataWithChatGPT(data, logFn);
      results.push(processed);

      if (i < scrapedDataList.length - 1) {
        logFn(`⏳ Waiting 5 seconds before next browser session...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      logFn(`❌ Failed to process ${data.title}: ${error.message}`);
      results.push(null);
    }
  }

  const successCount = results.filter(r => r !== null).length;
  logFn(`\n✅ ChatGPT processing completed: ${successCount}/${scrapedDataList.length} succeeded`);

  return results;
}

/**
 * Inject branding sections
 */
export function injectBrandingSections(readme, keyword, platform = 'bitbash') {
  if (platform === 'appilot') {
    return injectAppilotBranding(readme, keyword);
  }
  return injectBitBashBranding(readme, keyword);
}

/**
 * Inject BitBash branding
 */
function injectBitBashBranding(readme, keyword) {
  // Construct project-specific URL
  const projectUrl = `https://www.bitbash.dev/project/${keyword || 'automation'}`;
  
  const topBanner = `
<p align="center">
  <a href="${projectUrl}" target="_blank">
    <img src="https://github.com/Z786ZA/Footer-test/blob/main/media/scraper.png" alt="Bitbash Banner" width="100%"></a>
</p>
<p align="center">
  <a href="https://t.me/Bitbash333" target="_blank">
    <img src="https://img.shields.io/badge/Chat%20on-Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram">
  </a>&nbsp;
  <a href="https://wa.me/923249868488?text=Hi%20BitBash%2C%20I'm%20interested%20in%20automation." target="_blank">
    <img src="https://img.shields.io/badge/Chat-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp">
  </a>&nbsp;
  <a href="mailto:sale@bitbash.dev" target="_blank">
    <img src="https://img.shields.io/badge/Email-sale@bitbash.dev-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail">
  </a>&nbsp;
  <a href="${projectUrl}" target="_blank">
    <img src="https://img.shields.io/badge/Visit-Website-007BFF?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Website">
  </a>
</p>

`;

  // Short centered callout to appear just below the top banner. Use the
  // provided `keyword` as the repo/project name when available.
  const brandingCallout = (k) => {
    // Format the repo name: remove hyphens and capitalize first letter of each word
    const formattedName = k 
      ? k.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      : 'this project';
    
    return `
<p align="center" style="font-weight:600; margin-top:8px; margin-bottom:8px;">
  Created by Bitbash, built to showcase our approach to Scraping and Automation!<br>
  If you are looking for <a href="${projectUrl}" target="_blank"><strong>${formattedName}</strong></a> you've just found your team — Let's Chat. 👆👆 
</p>
`;
  };

  

  const footer = `
<p align="center">
<a href="https://calendar.app.google/74kEaAQ5LWbM8CQNA" target="_blank">
  <img src="https://img.shields.io/badge/Book%20a%20Call%20with%20Us-34A853?style=for-the-badge&logo=googlecalendar&logoColor=white" alt="Book a Call">
</a>
  <a href="https://www.youtube.com/@bitbash-demos/videos" target="_blank">
    <img src="https://img.shields.io/badge/🎥%20Watch%20demos%20-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch on YouTube">
  </a>
</p>
<table>
  <tr>
    <td align="center" width="33%" style="padding:10px;">
      <a href="https://youtu.be/MLkvGB8ZZIk" target="_blank">
        <img src="https://github.com/Z786ZA/Footer-test/blob/main/media/review1.gif" alt="Review 1" width="100%" style="border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
      </a>
      <p style="font-size:14px; line-height:1.5; color:#444; margin:0 15px;">
        "Bitbash is a top-tier automation partner, innovative, reliable, and dedicated to delivering real results every time."
      </p>
      <p style="margin:10px 0 0; font-weight:600;">Nathan Pennington
        <br><span style="color:#888;">Marketer</span>
        <br><span style="color:#f5a623;">★★★★★</span>
      </p>
    </td>
    <td align="center" width="33%" style="padding:10px;">
      <a href="https://youtu.be/8-tw8Omw9qk" target="_blank">
        <img src="https://github.com/Z786ZA/Footer-test/blob/main/media/review2.gif" alt="Review 2" width="100%" style="border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
      </a>
      <p style="font-size:14px; line-height:1.5; color:#444; margin:0 15px;">
        "Bitbash delivers outstanding quality, speed, and professionalism, truly a team you can rely on."
      </p>
      <p style="margin:10px 0 0; font-weight:600;">Eliza
        <br><span style="color:#888;">SEO Affiliate Expert</span>
        <br><span style="color:#f5a623;">★★★★★</span>
      </p>
    </td>
    <td align="center" width="33%" style="padding:10px;">
      <a href="https://youtu.be/m-dRE1dj5-k?si=5kZNVlKsGUhg5Xtx" target="_blank">
        <img src="https://github.com/Z786ZA/Footer-test/blob/main/media/review3.gif" alt="Review 3" width="100%" style="border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
      </a>
      <p style="font-size:14px; line-height:1.5; color:#444; margin:0 15px;">
        "Exceptional results, clear communication, and flawless delivery. <br>Bitbash nailed it."
      </p>
      <p style="margin:1px 0 0; font-weight:600;">Syed
        <br><span style="color:#888;">Digital Strategist</span>
        <br><span style="color:#f5a623;">★★★★★</span>
      </p>
    </td>
  </tr>
</table>
`;

  
    // Try to insert before a heading named "Introduction" (any level)
    const introRegex = /^#{1,6}\s*Introduction\b.*$/im;
    const introMatch = readme.match(introRegex);

    if (introMatch && typeof introMatch.index === 'number') {
      const idx = introMatch.index;
      const before = readme.slice(0, idx).trimEnd();
      const after = readme.slice(idx).trimStart();

      // If the intro is effectively at the very top, fall back to prepend
      if (before.length === 0) {
        readme = `${topBanner}\n\n${brandingCallout(keyword)}\n\n${readme}`;
      } else {
        // Insert banner immediately before the Introduction heading
        readme = `${before}\n\n${topBanner}\n\n${brandingCallout(keyword)}\n\n${after}`;
      }

    } else {
      // No explicit "Introduction" heading found. Try to insert after first H1 title instead.
      const firstH1 = readme.match(/^#\s.*$/m);
      if (firstH1 && typeof firstH1.index === 'number') {
        const insertPos = firstH1.index + firstH1[0].length;
        const before = readme.slice(0, insertPos).trimEnd();
        const after = readme.slice(insertPos).trimStart();
        readme = `${before}\n\n${topBanner}\n\n${brandingCallout(keyword)}\n\n${after}`;
      } else {
        // Ultimate fallback: prepend (keeps previous behavior)
        readme = `${topBanner}\n\n${brandingCallout(keyword)}\n\n${readme}`;
      }
    
  }

  // Always append footer to the end (preserve previous behavior), avoid duplicating if present
 
  readme = `${readme}\n\n${footer}`;
  

  // Ensure the top-most content line is a Markdown heading starting with '## '
  try {
    const allLines = readme.split('\n');
    let firstIdx = 0;
    while (firstIdx < allLines.length && allLines[firstIdx].trim() === '') firstIdx++;

    if (firstIdx < allLines.length) {
      const firstLine = allLines[firstIdx].trim();
      // If it doesn't already start with a markdown heading (#), prepend '## '
      if (!firstLine.startsWith('#')) {
        allLines[firstIdx] = '# ' + firstLine;
        readme = allLines.join('\n');
        console.log('  ℹ️ Prepended "## " to top-level heading');
      }
    }
  } catch (e) {
    console.warn('  ⚠️ Failed to ensure top heading: ' + (e && e.message ? e.message : e));
  }

  return readme;
}

/**
 * Inject Appilot branding
 */
function injectAppilotBranding(readme, keyword) {
  const topBanner = `
<p align="center">
  <a href="https://Appilot.app" target="_blank"><img src="media/appilot-baner.png" alt="Appilot Banner" width="100%"></a>
</p>

<p align="center">
  <a href="https://t.me/+DGn2k6ViYSQzMzI0" target="_blank"><img src="https://img.shields.io/badge/Chat%20on-Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"></a>
  <a href="mailto:support@appilot.app" target="_blank"><img src="https://img.shields.io/badge/Email-support@appilot.app-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail"></a>
  <a href="https://Appilot.app" target="_blank"><img src="https://img.shields.io/badge/Visit-Website-007BFF?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Website"></a>
  <a href="https://discord.gg/xvPWXJXCw7" target="_blank"><img src="https://img.shields.io/badge/Join-Appilot_Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Appilot Discord"></a>
</p>

`;

  const footer = `
<p align="center">
<a href="https://cal.com/appilot/30min" target="_blank">
  <img src="https://img.shields.io/badge/Book%20a%20Call%20with%20Us-34A853?style=for-the-badge&logo=googlecalendar&logoColor=white" alt="Book a Call">
</a>
 
  <a href="https://www.youtube.com/@appilotapp" target="_blank">
    <img src="https://img.shields.io/badge/🎥%20Watch%20demos%20-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch on YouTube">
  </a>
</p>
`;

  // Try to insert before a heading named "Introduction" (any level)
  const introRegex = /^#{1,6}\s*Introduction\b.*$/im;
  const introMatch = readme.match(introRegex);

  if (introMatch && typeof introMatch.index === 'number') {
    const idx = introMatch.index;
    const before = readme.slice(0, idx).trimEnd();
    const after = readme.slice(idx).trimStart();

    // If the intro is effectively at the very top, fall back to prepend
    if (before.length === 0) {
      readme = `${topBanner}\n\n${readme}`;
    } else {
      // Insert banner immediately before the Introduction heading
      readme = `${before}\n\n${topBanner}\n\n${after}`;
    }

  } else {
    // No explicit "Introduction" heading found. Try to insert after first H1 title instead.
    const firstH1 = readme.match(/^#\s.*$/m);
    if (firstH1 && typeof firstH1.index === 'number') {
      const insertPos = firstH1.index + firstH1[0].length;
      const before = readme.slice(0, insertPos).trimEnd();
      const after = readme.slice(insertPos).trimStart();
      readme = `${before}\n\n${topBanner}\n\n${after}`;
    } else {
      // Ultimate fallback: prepend
      readme = `${topBanner}\n\n${readme}`;
    }
  }

  // Always append footer to the end
  readme = `${readme}\n\n${footer}`;

  // Ensure the top-most content line is a Markdown heading
  try {
    const allLines = readme.split('\n');
    let firstIdx = 0;
    while (firstIdx < allLines.length && allLines[firstIdx].trim() === '') firstIdx++;

    if (firstIdx < allLines.length) {
      const firstLine = allLines[firstIdx].trim();
      if (!firstLine.startsWith('#')) {
        allLines[firstIdx] = '# ' + firstLine;
        readme = allLines.join('\n');
        console.log('  ℹ️ Prepended "# " to top-level heading');
      }
    }
  } catch (e) {
    console.warn('  ⚠️ Failed to ensure top heading: ' + (e && e.message ? e.message : e));
  }

  return readme;
}

/**
 * Send a raw prompt in a separate/new chat session and return the raw response text.
 * This ensures code-generation prompts are sent in a fresh chat (no mixed context).
 */
export async function sendPromptInSeparateChat(prompt, logFn = console.log) {
  logFn(`🤖 Sending standalone prompt in a separate chat (${Math.min(1000, prompt.length)} chars preview)...`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Autofill') || text.includes("wasn't found")) return;
      if (msg.type() === 'error' && !text.includes('Autofill')) {
        logFn('Browser console error: ' + text);
      }
    });

    // Load cookies (if available) so we remain logged in
    await loadCookies(page, logFn);

    // Try to open a fresh chat. Prefer the new-chat endpoint if available.
    const newChatUrls = [
      'https://chat.openai.com/chat/new',
      'https://chat.openai.com/chat',
      'https://chatgpt.com/chat/new',
      'https://chatgpt.com/'
    ];

    let navigated = false;
    for (const u of newChatUrls) {
      try {
        logFn(`📱 Navigating to: ${u}`);
        await page.goto(u, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        navigated = true;
        break;
      } catch (e) {
        logFn(`⚠️ Navigation to ${u} failed: ${e.message}`);
      }
    }

    if (!navigated) {
      throw new Error('Could not open ChatGPT UI for standalone prompt');
    }

    // If login required, wait for manual login (same behaviour as processor)
    const isLoggedIn = await page.evaluate(() => { return !document.URL.includes('/auth/login'); });
    if (!isLoggedIn) {
      logFn(`⚠️ ChatGPT requires login for standalone prompt. Please login manually (120s)...`);
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 });
      } catch (e) {
        const stillNotLoggedIn = await page.evaluate(() => { return document.URL.includes('/auth/login'); });
        if (stillNotLoggedIn) throw new Error('Login timeout for standalone prompt');
      }
      logFn('✅ Login detected, continuing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Try to click "New chat" if available to ensure fresh conversation
    const newChatSelectors = [
      'a[aria-label="New chat"]',
      'button[aria-label="New chat"]',
      'a[href="/chat/new"]',
      'a[href*="/chat"]',
      'button[title="New chat"]'
    ];

    for (const sel of newChatSelectors) {
      try {
        const exists = await page.$(sel);
        if (exists) {
          logFn(`🆕 Clicking new-chat element: ${sel}`);
          await page.click(sel);
          await new Promise(resolve => setTimeout(resolve, 800));
          break;
        }
      } catch (e) {
        
      }
    }

    // Wait for the textarea / contenteditable input
    await page.waitForSelector('textarea, div[contenteditable="true"]', { timeout: 30000 });

    // Send prompt
    await sendPromptAsSingleMessage(page, prompt, logFn);

    logFn('⏳ Waiting for assistant response (standalone)...');
    await waitForResponse(page, logFn);

    logFn('📥 Extracting assistant response (standalone)...');
    const responseText = await extractResponseFromDOM(page, logFn);

    if (!responseText) {
      throw new Error('No response extracted for standalone prompt');
    }

    logFn(`✅ Standalone response received (${responseText.length} chars)`);
    return responseText;

  } catch (error) {
    logFn(`❌ Standalone prompt failed: ${error.message}`);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}