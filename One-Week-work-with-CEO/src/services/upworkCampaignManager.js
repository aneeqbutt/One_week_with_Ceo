import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage.js';
import { upworkJobService } from './upworkJobService.js';
import { processApifyDataWithChatGPT } from './apifyToGPTProcessor.js';
import { parseCodeResponse, generateCodeWithGPT } from './Codegenerator.js';
import { extractAndRepairJSON, normalizeJobFilterResponse } from '../utils/jsonRepairUtil.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Upwork Campaign Manager
 * Continuously fetches Upwork jobs, filters them with GPT, and creates repos
 */
class UpworkCampaignManager extends EventEmitter {
  constructor() {
    super();
    this.running = new Map();
    this.seenJobIds = new Map(); // Track seen jobs per campaign: campaignId -> Set of job IDs
    // ── Global GPT call queue ──────────────────────────────────────────────
    // All campaigns share ONE ChatGPT account (same cookies).
    // Running multiple browser sessions against the same account simultaneously
    // causes session conflicts and empty responses.
    // This queue serialises every GPT call across ALL campaigns so only one
    // browser is talking to ChatGPT at any given moment.
    this._gptQueue = Promise.resolve();

    // ── Global Upwork fetch queue ──────────────────────────────────────────
    // All campaigns share the same Upwork scraper credentials.
    // Firing 4 fetches simultaneously triggers rate limiting.
    // This queue serialises all fetchJobs calls and enforces a 45s cooldown
    // between each one, keeping the rate at ≤1 request per 45s site-wide.
    this._upworkFetchQueue = Promise.resolve();
    this._upworkCooldownMs = 45000;
    this.prompts = {
      filter: '',
      scraperReadme: '',
      automationReadme: ''
    };
    this.loadPrompts();
    console.log('UpworkCampaignManager initialized');
  }

  /**
   * Enqueues a GPT call so only one runs at a time across ALL campaigns.
   * Usage:  await this.queueGPT(() => this.runGPTPrompt(...))
   */
  queueGPT(fn) {
    // Chain onto the queue; the queue tail always resolves (errors don't block it)
    const call = this._gptQueue.then(() => fn());
    this._gptQueue = call.catch(() => {});   // keep queue alive on failure
    return call;                             // caller gets the real promise (with errors)
  }

  /**
   * Enqueues an Upwork fetch so only one fires at a time across ALL campaigns,
   * with a mandatory cooldown between each call to avoid rate limiting.
   * Usage:  await this.queueUpworkFetch(() => upworkJobService.fetchJobs(...))
   */
  queueUpworkFetch(fn) {
    const call = this._upworkFetchQueue.then(async () => {
      const result = await fn();
      // Hold the queue for the cooldown before releasing the next waiter
      await this.delay(this._upworkCooldownMs);
      return result;
    });
    this._upworkFetchQueue = call.catch(() => {});
    return call;
  }

  /**
   * Check if job was posted within the specified number of minutes
   * @param {string|number|Date} createdDateTime - Job posting time
   * @param {number} minutes - Time window in minutes (default: 5)
   * @returns {boolean}
   */
  isJobPostedWithinMinutes(createdDateTime, minutes = 15) {
    if (!createdDateTime || createdDateTime === 'Unknown') {
      return false;
    }

    const now = new Date();
    let jobDate = null;

    try {
      // Handle Date object
      if (createdDateTime instanceof Date) {
        jobDate = createdDateTime;
      }
      // Handle timestamp (milliseconds)
      else if (typeof createdDateTime === 'number') {
        jobDate = new Date(createdDateTime);
      }
      // Handle string
      else if (typeof createdDateTime === 'string') {
        // Try ISO format first
        jobDate = new Date(createdDateTime);
        
        // If invalid, try parsing as timestamp
        if (isNaN(jobDate.getTime())) {
          const timestamp = parseFloat(createdDateTime);
          if (!isNaN(timestamp)) {
            jobDate = new Date(timestamp);
          }
        }
      }

      if (!jobDate || isNaN(jobDate.getTime())) {
        return false;
      }

      // Calculate time difference in minutes
      const diffMs = now - jobDate;
      const diffMinutes = diffMs / (1000 * 60);
      
      return diffMinutes <= minutes;

    } catch (error) {
      console.error('Error parsing job date:', error);
      return false;
    }
  }
  /**
   * Extract topics from metadata block with comprehensive pattern support
   */
  extractTopicsFromMetadata(metadataBlock) {
    console.log('\n🔍 Extracting topics with comprehensive pattern matching...');
    
    const topics = [];
    
    // Pattern 1: Single line with label (comma, semicolon, pipe separated)
    const singleLinePatterns = [
      /(?:Related Topics|Topics|Tags|Keywords):\s*([^\n]+)/i,
      /(?:Related Topics|Topics|Tags|Keywords)\s*[=:]\s*([^\n]+)/i,
    ];
    
    for (const pattern of singleLinePatterns) {
      const match = metadataBlock.match(pattern);
      if (match) {
        console.log(`  ✅ Found single-line topics: ${pattern}`);
        const rawTopics = match[1];
        
        // Try various delimiters: comma, semicolon, pipe, newline
        const delimiters = [',', ';', '|', '\n'];
        let extracted = [];
        
        for (const delimiter of delimiters) {
          if (rawTopics.includes(delimiter)) {
            extracted = rawTopics.split(delimiter).map(t => t.trim()).filter(t => t.length > 0);
            if (extracted.length > 1) break;
          }
        }
        
        // If no delimiter worked, try space-separated (if multiple words)
        if (extracted.length === 0) {
          extracted = [rawTopics.trim()];
        }
        
        topics.push(...extracted);
        if (topics.length > 0) return this.cleanTopicsArray(topics);
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
      
      if (topics.length > 0) return this.cleanTopicsArray(topics);
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
        if (topics.length > 0) return this.cleanTopicsArray(topics);
      }
    }
    
    // Pattern 4: Inline within metadata (no explicit label, after description)
    const inlineMatch = metadataBlock.match(
      /Description:[^\n]*\n\s*([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+){2,})/i
    );
    
    if (inlineMatch) {
      console.log('  ✅ Found inline topics after description');
      topics.push(...inlineMatch[1].split(',').map(t => t.trim()));
      if (topics.length > 0) return this.cleanTopicsArray(topics);
    }
    
    // Pattern 5: Anywhere in metadata with common topic keywords
    const anywhereMatch = metadataBlock.match(
      /(?:scraper|automation|api|data|web|tool|bot|monitor|tracker|parser|extractor|crawler|fetcher)(?:\s*,\s*(?:[a-z0-9-]+)){2,}/i
    );
    
    if (anywhereMatch) {
      console.log('  ✅ Found topics by keyword detection');
      topics.push(...anywhereMatch[0].split(',').map(t => t.trim()));
      if (topics.length > 0) return this.cleanTopicsArray(topics);
    }
    
    console.log('  ⚠️  No topics found with any pattern');
    return [];
  }

  cleanTopicsArray(topics) {
    const cleaned = topics
      .map(t => {
        // Remove quotes, brackets, extra spaces
        let clean = t.replace(/["'\[\]()]/g, '').trim();
        
        // Remove leading bullets, numbers, dashes
        clean = clean.replace(/^[-*•\d\.\)]+\s*/, '');
        
        // GitHub topic rules: lowercase, alphanumeric + hyphens only
        // 1. Convert to lowercase first
        clean = clean.toLowerCase();
        
        // 2. Replace all whitespace with hyphens
        clean = clean.replace(/\s+/g, '-');
        
        // 3. Replace all non-alphanumeric chars (except hyphens) with hyphens
        clean = clean.replace(/[^a-z0-9-]/g, '-');
        
        // 4. Collapse multiple consecutive hyphens
        clean = clean.replace(/-+/g, '-');
        
        // 5. Remove leading/trailing hyphens
        clean = clean.replace(/^-+|-+$/g, '');
        
        return clean;
      })
      .filter(t => {
        // GitHub limits: 1-50 chars, not just numbers
        return t.length > 0 && t.length <= 50 && !/^\d+$/.test(t);
      })
      .slice(0, 20); // Max 20 topics per GitHub
    
    // Remove duplicates
    return [...new Set(cleaned)];
  }

  /**
   * Log function - same as before
   */
  /**
   * Load prompts from text files
   */
  loadPrompts() {
    try {
      const promptsDir = path.join(__dirname, '..', '..', 'prompts');

      this.prompts.filter = fs.readFileSync(
        path.join(promptsDir, 'upwork-saas-filter.txt'),
        'utf-8'
      );

      this.prompts.scraperReadme = fs.readFileSync(
        path.join(promptsDir, 'upwork-scraper-readme.txt'),
        'utf-8'
      );

      this.prompts.automationReadme = fs.readFileSync(
        path.join(promptsDir, 'upwork-automation-readme.txt'),
        'utf-8'
      );

      this.prompts.blog = fs.readFileSync(
        path.join(promptsDir, 'blog_prompt.txt'),
        'utf-8'
      );

      this.prompts.service = fs.readFileSync(
        path.join(promptsDir, 'service_prompt.txt'),
        'utf-8'
      );

      this.prompts.product = fs.readFileSync(
        path.join(promptsDir, 'product_prompt.txt'),
        'utf-8'
      );

      console.log('✅ Loaded all prompts successfully');
    } catch (error) {
      console.error('❌ Failed to load prompts:', error);
      throw new Error('Failed to load prompts. Make sure prompt files exist in the prompts folder.');
    }
  }

  buildBlogPrompt(job) {
    return `${this.prompts.blog}

Job Title: ${job.title}
Job Description: ${job.description || ''}
Platform: ${job.platform || 'Unknown'}
Tool: ${job.tool || 'Unknown'}
Niche: ${job.niche || 'Automation'}`;
  }

  buildServicesPrompt(job) {
    return `${this.prompts.service}

Job Title: ${job.title}
Job Description: ${job.description || ''}
Platform: ${job.platform || 'Unknown'}
Tool: ${job.tool || 'Unknown'}
Niche: ${job.niche || 'Automation'}`;
  }

  extractJSONFromResponse(responseText) {
    // Try ```json block first
    const fenceMatch = responseText.match(/```json\s*([\s\S]*?)```/);
    if (fenceMatch) return JSON.parse(fenceMatch[1].trim());

    // Try any ``` block
    const anyFenceMatch = responseText.match(/```\s*([\s\S]*?)```/);
    if (anyFenceMatch) {
      try { return JSON.parse(anyFenceMatch[1].trim()); } catch {}
    }

    // Use extractAndRepairJSON for raw JSON anywhere in response
    return extractAndRepairJSON(responseText, '[blog/service] ');
  }

  async runGPTPrompt(prompt, cookies, campaignId) {
    const puppeteer = (await import('puppeteer')).default;
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'],
        ignoreDefaultArgs: ['--enable-automation'],
        defaultViewport: { width: 1920, height: 1080 }
      });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      if (cookies && Array.isArray(cookies)) {
        const sanitized = this.sanitizeCookies(cookies);
        if (sanitized.length > 0) await page.setCookie(...sanitized);
      }
      await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await new Promise(r => setTimeout(r, 3000));
      const isLoggedIn = await page.evaluate(() => !document.URL.includes('/auth/login'));
      if (!isLoggedIn) throw new Error('Not logged in to ChatGPT');
      await page.waitForFunction(() => {
        const el = document.querySelector('#prompt-textarea, div[contenteditable="true"], [role="textbox"], textarea');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }, { timeout: 30000 }).catch(() => {});
      await this.sendPromptToGPT(page, prompt, (msg) => console.log('[GPT prompt]', msg));
      await this.waitForGPTResponse(page, (msg) => console.log('[GPT prompt]', msg), 5, 2000, 200);
      return await this.extractGPTResponse(page);
    } finally {
      if (browser) await browser.close();
    }
  }

  log(campaignId, level, message) {
    const evt = { campaignId, level, message, timestamp: Date.now() };
    storage.appendLog(campaignId, evt);
    this.emit('log', evt);

    const R = '\x1b[0m';
    const B = '\x1b[1m';
    const gray   = '\x1b[90m';
    const green  = '\x1b[32m';
    const red    = '\x1b[31m';
    const yellow = '\x1b[33m';
    const cyan   = '\x1b[36m';
    const white  = '\x1b[37m';

    const ts = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    const LEVELS = {
      info:    { icon: 'ℹ️ ', color: cyan   },
      success: { icon: '✅',        color: green  },
      error:   { icon: '❌',        color: red    },
      warning: { icon: '⚠️ ', color: yellow },
    };

    const { icon, color } = LEVELS[level] ?? { icon: '▸ ', color: white };

    process.stdout.write(
      `${gray}[${ts}]${R} ${icon}  ${color}${B}[${campaignId}]${R} ${message}\n`
    );
  }

  setStatus(campaignId, status, failureReason = null) {
    console.log(`Setting Upwork campaign ${campaignId} status to: ${status}`);
    const update = { status };
    if (failureReason) {
      update.failure_reason = failureReason;
    }
    storage.updateUpworkCampaign(campaignId, update);
    this.emit('status', { campaignId, status, failureReason });
  }

  updateProgress(campaignId, processed, total, viable = 0, nonViable = 0) {
    const progress = { processed, total, viable, nonViable };
    console.log(`Progress update: ${processed}/${total} (Viable: ${viable}, Non-viable: ${nonViable})`);
    storage.updateUpworkCampaign(campaignId, { progress });
    this.emit('progress', { campaignId, ...progress });
  }

  /**
   * Filter job with GPT using the SaaS viability filter prompt
   * @param {Object} jobDetails - Detailed job information
   * @param {string} cookies - GPT account cookies
   * @returns {Promise<{viable: boolean, niche: string, platform: string, tool: string}>}
   */
  /**
   * Finds the ChatGPT input box using multiple strategies in order.
   * Returns a CSS selector string that matched, or throws if nothing found.
   * Robust against ChatGPT UI changes — tries CSS, role, XPath, heuristics.
   */
  async findChatGPTInput(page, logFn) {
    // Strategy 1: known CSS selectors in priority order
    const cssStrategies = [
      '#prompt-textarea',
      'div[contenteditable="true"][data-placeholder]',
      '.ProseMirror[contenteditable="true"]',
      '[role="textbox"]',
      'div[contenteditable="true"]',
      'textarea',
    ];

    for (const sel of cssStrategies) {
      try {
        const found = await page.$(sel);
        if (found) {
          const visible = await page.evaluate((s) => {
            const el = document.querySelector(s);
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }, sel);
          if (visible) {
            logFn(`🎯 Input found via CSS: ${sel}`);
            return { type: 'css', selector: sel };
          }
        }
      } catch {}
    }

    // Strategy 2: XPath fallbacks
    const xpathStrategies = [
      '//div[@contenteditable="true"]',
      '//textarea[not(@type="hidden")]',
      '//*[@role="textbox"]',
    ];

    for (const xp of xpathStrategies) {
      try {
        const els = await page.$$(`::-p-xpath(${xp})`);
        if (els.length > 0) {
          const visible = await els[0].evaluate(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          if (visible) {
            logFn(`🎯 Input found via XPath: ${xp}`);
            return { type: 'xpath', handle: els[0] };
          }
        }
      } catch {}
    }

    // Strategy 3: heuristic — find the largest visible text input on the page
    const heuristicSel = await page.evaluate(() => {
      const candidates = [
        ...document.querySelectorAll('div[contenteditable], textarea, input[type="text"]')
      ];
      let best = null, bestArea = 0;
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea && r.width > 100 && r.height > 20) {
          best = el;
          bestArea = area;
        }
      }
      if (!best) return null;
      if (best.id) return `#${best.id}`;
      if (best.className) return `${best.tagName.toLowerCase()}.${best.className.trim().split(/\s+/)[0]}`;
      return best.tagName.toLowerCase();
    });

    if (heuristicSel) {
      logFn(`🎯 Input found via heuristic: ${heuristicSel}`);
      return { type: 'css', selector: heuristicSel };
    }

    throw new Error('Could not find ChatGPT input box — all strategies failed');
  }

  /**
   * Send prompt using clipboard paste method (most reliable)
   */
  async sendPromptToGPT(page, prompt, logFn) {
    logFn(`📤 Preparing to send prompt...`);

    // Wait for page to have any input element
    await page.waitForFunction(() => {
      const el = document.querySelector('#prompt-textarea, div[contenteditable="true"], [role="textbox"], textarea');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }, { timeout: 15000 }).catch(() => {});

    const input = await this.findChatGPTInput(page, logFn);

    // ── Method 1: clipboard paste ─────────────────────────────────────────────
    let textInBox = 0;
    try {
      logFn(`⌨️ Trying clipboard paste...`);

      // Copy prompt to clipboard
      await page.evaluate((text) => {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }, prompt);

      // Click the input and paste
      if (input.type === 'css') {
        await page.click(input.selector);
      } else {
        await input.handle.click();
      }
      await new Promise(r => setTimeout(r, 400));
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyV');
      await page.keyboard.up('Control');
      await new Promise(r => setTimeout(r, 800));

      textInBox = await this._getInputLength(page, input);
    } catch (e) {
      logFn(`⚠️ Clipboard method error: ${e.message}`);
    }

    // ── Method 2: direct DOM injection (fallback) ─────────────────────────────
    if (textInBox < 20) {
      logFn(`⚠️ Clipboard failed (${textInBox} chars) — trying direct DOM inject...`);
      await this.sendPromptDirectDOM(page, prompt, input);
      await new Promise(r => setTimeout(r, 800));
      textInBox = await this._getInputLength(page, input);
    }

    // ── Hard fail if nothing is in the box ────────────────────────────────────
    if (textInBox < 20) {
      throw new Error(`Prompt injection failed — input empty after both methods (got ${textInBox} chars)`);
    }

    logFn(`✅ Prompt in textarea (${textInBox} chars) — sending...`);
    await new Promise(r => setTimeout(r, 500));

    // ── Click Send ────────────────────────────────────────────────────────────
    const sendSelectors = [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[type="submit"]',
    ];
    let sent = false;
    for (const sel of sendSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.click(sel);
        sent = true;
        break;
      } catch {}
    }
    if (!sent) {
      logFn(`⚠️ Send button not found — pressing Enter`);
      await page.keyboard.press('Enter');
    }

    logFn(`✅ Message sent`);
  }

  /**
   * Gets the current text length inside the found input element.
   */
  async _getInputLength(page, input) {
    try {
      if (input.type === 'css') {
        return await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? (el.value || el.textContent || el.innerText || '').length : 0;
        }, input.selector);
      } else {
        return await input.handle.evaluate(el =>
          (el.value || el.textContent || el.innerText || '').length
        );
      }
    } catch { return 0; }
  }

  /**
   * Send prompt by directly manipulating the DOM (fallback method).
   * Handles both textarea and contenteditable (ProseMirror) elements.
   */
  async sendPromptDirectDOM(page, prompt, input) {
    const injector = (el, text) => {
      if (!el) return;
      el.focus();

      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        // Standard textarea — set value and fire React synthetic events
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        if (nativeInputValueSetter) nativeInputValueSetter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.contentEditable === 'true') {
        // ProseMirror / contenteditable — must use execCommand so React state updates
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
      }
    };

    if (input.type === 'css') {
      await page.evaluate((sel, text) => {
        const el = document.querySelector(sel);
        // Inline the injector since we can't pass functions across evaluate
        if (!el) return;
        el.focus();
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) setter.call(el, text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.contentEditable === 'true') {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, text);
        }
      }, input.selector, prompt);
    } else {
      await input.handle.evaluate((el, text) => {
        if (!el) return;
        el.focus();
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (setter) setter.call(el, text);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.contentEditable === 'true') {
          el.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, text);
        }
      }, prompt);
    }
  }

  /**
   * Wait for GPT response to complete with robust detection and timeout safeguards
   * Backwards compatible signature: (page, logFn, maxStableChecks?, checkInterval?, minLength?)
   */
  async waitForGPTResponse(page, logFn, a = 5, b = 2000, c = 50) {
    // Support old positional args or new options object
    const opts = typeof a === 'object'
      ? { maxStableChecks: 5, checkInterval: 2000, minLength: 50, overallTimeoutMs: 120000, resendOnIdleMs: 45000, ...a }
      : { maxStableChecks: a, checkInterval: b, minLength: c, overallTimeoutMs: 180000, resendOnIdleMs: 45000 };

    let previousLength = 0;
    let stableCount = 0;
    const start = Date.now();
    let lastChangeTs = Date.now();
    let resentOnce = false;

    logFn(`⏳ Waiting for response to complete...`);

    while (true) {
      // Timeout guard
      const elapsed = Date.now() - start;
      if (elapsed > opts.overallTimeoutMs) {
        logFn(`⏱️ Timeout waiting for response (~${Math.round(opts.overallTimeoutMs/1000)}s). Proceeding with current content.`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, opts.checkInterval));

      const state = await page.evaluate(() => {
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
        const last = messages.length > 0 ? messages[messages.length - 1] : null;
        const length = last ? (last.textContent?.length || 0) : 0;
        const isGenerating = !!(document.querySelector('[data-testid="stop-button"], [aria-label*="Stop generating"]'));
        const hasRegenerate = !!document.querySelector('[data-testid="regenerate-button"], button:has(svg[aria-label*="Regenerate"])');
        return { length, isGenerating, hasRegenerate };
      });

      // Consider finished if generation stopped and we have meaningful content
      if (!state.isGenerating && state.length > opts.minLength) {
        // Require a couple stable checks to ensure it's settled
        if (state.length === previousLength) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        previousLength = state.length;

        if (stableCount >= opts.maxStableChecks) {
          logFn(`✅ Response complete (stable at ${state.length} chars)`);
          break;
        }
        continue;
      }

      // Track changes to detect idle
      if (state.length !== previousLength) {
        lastChangeTs = Date.now();
        stableCount = 0;
        previousLength = state.length;
      }

      // If idle for too long and nothing seems to be generating, try a gentle nudge (press Enter once)
      if (!state.isGenerating && state.length <= opts.minLength && (Date.now() - lastChangeTs) > opts.resendOnIdleMs && !resentOnce) {
        try {
          logFn('⚠️ No output detected after sending. Nudging with Enter once...');
          await page.keyboard.press('Enter');
          resentOnce = true;
          lastChangeTs = Date.now();
          continue;
        } catch {}
      }

      // Keep page scrolled to bottom to avoid lazy rendering issues
      try {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } catch {}
    }
  }

  /**
   * Extract response from ChatGPT DOM
   * FIXED: Preserves code fences for metadata extraction
   */
  async extractGPTResponse(page) {
    return await page.evaluate(() => {
      const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        
        // Remove copy buttons
        const clone = lastMessage.cloneNode(true);
        clone.querySelectorAll('button, [class*="copy"], [aria-label*="Copy"]').forEach(el => el.remove());
        
        // Reconstruct markdown with code fences
        let fullText = '';
        
        // Find all code blocks and reconstruct with fences
        const codeBlocks = clone.querySelectorAll('pre');
        if (codeBlocks.length > 0) {
          // Walk through DOM to preserve order
          const walker = document.createTreeWalker(
            clone,
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
          
          return fullText.replace(/Copy code/gi, '').replace(/\n{3,}/g, '\n\n').trim();
        }
        
        // Fallback to textContent if no code blocks
        return lastMessage.textContent || '';
      }
      return '';
    });
  }

  /**
   * Sanitize cookies for Puppeteer / DevTools Protocol compatibility
   * Same implementation as apifyToGPTProcessor.js
   */
  sanitizeCookies(cookies) {
    if (!Array.isArray(cookies)) return [];
    
    return cookies.map(c => {
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
  }

  async filterJobWithGPT(jobDetails, cookies, campaignId) {
    this.log(campaignId, 'info', `🤖 Filtering job: ${jobDetails.title}`);
    
    const puppeteer = (await import('puppeteer')).default;
    let browser;
    
    try {
      // Build the full prompt
      const jobDescription = upworkJobService.buildJobDescription(jobDetails);
      const fullPrompt = `${this.prompts.filter}\n\n====================================================\n\nJob to analyze:\n\n${jobDescription}`;
      
      console.log('[GPT] Sending job to viability filter...');

      // Launch headless browser (same as apifyToGPTProcessor)
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

      // Set realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Load cookies with sanitization
      if (cookies && Array.isArray(cookies)) {
        const sanitizedCookies = this.sanitizeCookies(cookies);
        if (sanitizedCookies.length > 0) {
          await page.setCookie(...sanitizedCookies);
        }
      }

      // Navigate to ChatGPT
      await page.goto('https://chatgpt.com/', { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Wait for page load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if logged in
      const isLoggedIn = await page.evaluate(() => {
        return !document.URL.includes('/auth/login');
      });

      if (!isLoggedIn) {
        throw new Error('Not logged in to ChatGPT. Please update GPT account cookies.');
      }

      // Wait for textarea
      await page.waitForFunction(() => {
        const el = document.querySelector('#prompt-textarea, div[contenteditable="true"], [role="textbox"], textarea');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }, { timeout: 30000 }).catch(() => {});

      await this.sendPromptToGPT(page, fullPrompt, (msg) => console.log('[GPT filter]', msg));
      await this.waitForGPTResponse(page, (msg) => console.log('[GPT filter]', msg), 5, 2000, 50);

      const responseText = await this.extractGPTResponse(page);
      if (!responseText) throw new Error('No response received from GPT');

      console.log('[GPT filter] Parsing response...');
      
      let result;
      try {
        const parsed = extractAndRepairJSON(
          responseText, 
          `[${campaignId}] `
        );
        
        // Normalize the response structure for new prompt format
        result = normalizeJobFilterResponse(parsed);
        
        this.log(campaignId, 'success', `✅ JSON parsed successfully`);
        this.log(campaignId, 'info', `   Open Source Viable: ${result.open_source_viable}`);
        this.log(campaignId, 'info', `   Niche: ${result.niche}`);
        this.log(campaignId, 'info', `   Platform: ${result.platform}`);
        this.log(campaignId, 'info', `   Platform Domain: ${result['platform domain'] || 'None'}`);
        this.log(campaignId, 'info', `   Tool: ${result.tool}`);
        
      } catch (jsonError) {
        this.log(campaignId, 'error', `JSON parsing failed: ${jsonError.message}`);
        this.log(campaignId, 'warning', 'Treating job as non-viable due to parse error');
        
        // Return safe default
        return { 
          viable: false, 
          niche: 'None',
          platform: 'None',
          platformDomain: 'None',
          tool: 'None'
        };
      }

      // Check if job is viable: needs both platform AND tool to be present
      const hasValidPlatform = result.platform && result.platform !== 'None';
      const isViable = hasValidPlatform ;

      return {
        viable: isViable,
        niche: result.niche,
        platform: result.platform,
        platformDomain: result['platform domain'] || 'None',
        tool: result.tool
      };

    } catch (error) {
      this.log(campaignId, 'error', `Failed to filter job: ${error.message}`);
      return { 
        viable: false, 
        niche: 'None',
        platform: 'None',
        platformDomain: 'None',
        tool: 'None'
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate README using appropriate prompt based on niche
   * @param {Object} jobDetails - Detailed job information
   * @param {string} niche - 'Automation' or 'Scraping'
   * @param {string} platform - Platform name from filter
   * @param {string} tool - Tool name from filter
   * @param {string} cookies - GPT account cookies
   * @returns {Promise<Object>} Parsed README data
   */
  async generateReadmeForJob(jobDetails, niche, platform, tool, cookies, campaignId) {
    this.log(campaignId, 'info', `📝 Generating ${niche} README for: ${jobDetails.title}`);
    
    const puppeteer = (await import('puppeteer')).default;
    let browser;
    
    try {
      // Choose appropriate prompt — use product_prompt.txt if populated,
      // otherwise fall back to the niche-specific readme prompts.
      const promptTemplate = this.prompts.product.trim()
        ? this.prompts.product
        : (niche === 'Scraping' ? this.prompts.scraperReadme : this.prompts.automationReadme);
      
      // Build job data with metadata for prompt
      const jobDescription = upworkJobService.buildJobDescription(jobDetails);
      
      // Create metadata block
      const metadata = JSON.stringify({
        platform: platform,
        tool: tool
      }, null, 2);
      
      const fullPrompt = `${promptTemplate}\n\n====================================================\n\nUpwork Job Post:\n\nJob Title: ${jobDetails.title}\n\nJob Description: ${jobDescription}\n\nMetaData:\n${metadata}`;
      
      console.log(`[GPT readme] Platform: ${platform}, Tool: ${tool}`);
      
      // Launch headless browser (same as apifyToGPTProcessor)
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

      // Set realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Load cookies with sanitization
      if (cookies && Array.isArray(cookies)) {
        const sanitizedCookies = this.sanitizeCookies(cookies);
        if (sanitizedCookies.length > 0) {
          await page.setCookie(...sanitizedCookies);
        }
      }

      // Navigate to ChatGPT
      await page.goto('https://chatgpt.com/', { 
        waitUntil: 'networkidle2',
        timeout: 60000 
      });

      // Wait for page load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if logged in
      const isLoggedIn = await page.evaluate(() => {
        return !document.URL.includes('/auth/login');
      });

      if (!isLoggedIn) {
        throw new Error('Not logged in to ChatGPT. Please update GPT account cookies.');
      }

      // Wait for textarea
      await page.waitForFunction(() => {
        const el = document.querySelector('#prompt-textarea, div[contenteditable="true"], [role="textbox"], textarea');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }, { timeout: 30000 }).catch(() => {});

      await this.sendPromptToGPT(page, fullPrompt, (msg) => console.log('[GPT readme]', msg));
      await this.waitForGPTResponse(page, (msg) => console.log('[GPT readme]', msg), 8, 3000, 500);

      const responseText = await this.extractGPTResponse(page);
      if (!responseText) throw new Error('No response received from GPT');

      this.log(campaignId, 'info', '✅ README response received');

      // Parse the response (similar to apifyToGPTProcessor parseGPTResponse)
      return this.parseReadmeResponse(responseText, jobDetails);

    } catch (error) {
      this.log(campaignId, 'error', `Failed to generate README: ${error.message}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Parse README response from GPT
   */
  parseReadmeResponse(responseText, jobDetails) {
    console.log('🔍 Parsing README response from GPT...');

    let repoName = '';
    let description = '';
    let topics = [];
    let readme = '';

    // Try metadata block — accept pgsql, sql, text, yaml, or plain fence
    const metadataMatch = responseText.match(/```(?:pgsql|sql|text|yaml|yml)?\s*\n(Repo Name:[\s\S]*?)```/i)
      || responseText.match(/```[a-z]*\s*\n([\s\S]*?Repo Name:[\s\S]*?)```/i);

    if (metadataMatch) {
      const metadata = metadataMatch[1];
      console.log('✅ Found metadata block');

      const repoNameMatch = metadata.match(/Repo Name:\s*(.+)/i);
      const descMatch = metadata.match(/Description:\s*(.+)/i);
      topics = this.extractTopicsFromMetadata(metadata);

      if (repoNameMatch) { repoName = repoNameMatch[1].trim(); console.log(`  📦 Repo Name: "${repoName}"`); }
      if (descMatch) { description = descMatch[1].trim(); console.log(`  📝 Description: ${description}`); }
    } else {
      // Fallback: look for Repo Name anywhere inline
      const inlineRepo = responseText.match(/Repo Name:\s*(.+)/i);
      const inlineDesc = responseText.match(/Description:\s*(.+)/i);
      if (inlineRepo) { repoName = inlineRepo[1].trim(); console.log(`  📦 Repo Name (inline): "${repoName}"`); }
      if (inlineDesc) { description = inlineDesc[1].trim(); }
      topics = this.extractTopicsFromMetadata(responseText);
      console.log('⚠️  No fenced metadata block — used inline extraction');
    }

    // Extract README: try markdown fence first, then any remaining fence, then full response
    const readmeMarkdown = responseText.match(/```markdown\s*\n([\s\S]*?)```/i);
    const readmeAnyFence = responseText.match(/```(?!pgsql|sql|text|yaml)[a-z]*\s*\n([\s\S]{200,}?)```/i);
    if (readmeMarkdown) {
      readme = readmeMarkdown[1].trim();
    } else if (readmeAnyFence) {
      readme = readmeAnyFence[1].trim();
    } else {
      // Strip any metadata-looking lines and use the rest as readme
      readme = responseText.replace(/```[\s\S]*?```/g, '').trim();
    }
    console.log(`📄 README extracted (${readme.length} chars)`);

    // Fallbacks
    if (!repoName) {
      repoName = jobDetails.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      console.log(`⚠️  Using fallback repo name: ${repoName}`);
    }
    if (!description) { description = jobDetails.title; }

    console.log(`✅ Parse complete - ${topics.length} topics ready`);
    return { repo_name: repoName, description, topics, readme };
  }

  /**
   * Get GPT account cookies
   */
  async getGPTCookies(gptAccountId, campaignId) {
    try {
      const account = await storage.getGPTAccount(gptAccountId);
      if (!account || !account.cookies) {
        throw new Error('GPT account cookies not found');
      }
      
      // Parse cookies if they're a string
      let cookies = account.cookies;
      if (typeof cookies === 'string') {
        try {
          cookies = JSON.parse(cookies);
        } catch (e) {
          throw new Error('Invalid cookies format');
        }
      }
      
      return cookies;
    } catch (error) {
      this.log(campaignId, 'error', `Failed to get GPT cookies: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main campaign loop - REAL-TIME job detection with deduplication
   */
  async startCampaign(id) {
  console.log('\n===== STARTING UPWORK CAMPAIGN (REAL-TIME MODE) =====');
  console.log('Campaign ID:', id);
  
  if (this.running.get(id)) {
    console.log('Campaign already running');
    return;
  }

  this.running.set(id, true);
  this.setStatus(id, 'Running');
  
  // Initialize seen jobs set for this campaign
  if (!this.seenJobIds.has(id)) {
    this.seenJobIds.set(id, new Set());
  }

  const campaign = await storage.getUpworkCampaign(id);

  if (!campaign) {
    console.log('Campaign not found');
    this.running.delete(id);
    return;
  }

  // Normalize snake_case DB columns to camelCase
  const searchInput = campaign.upwork_search_input || campaign.upworkSearchInput || '';
  const gptAccountId = campaign.gpt_account_id || campaign.gptAccountId;

  console.log('Campaign found:', campaign.name);
  console.log('Search input:', searchInput);

  try {
    this.log(id, 'info', `🚀 Starting REAL-TIME Upwork campaign: ${campaign.name}`);
    this.log(id, 'info', `🔍 Search query: ${searchInput}`);
    this.log(id, 'info', `⏱️ Mode: Real-time (fetching jobs posted within 15 minutes)`);
    this.log(id, 'info', `🛡️ Duplicate detection: ENABLED`);

    // Get GPT cookies
    const cookies = await this.getGPTCookies(gptAccountId, id);
    
    let processed = 0;
    let viable = 0;
    let nonViable = 0;
    let duplicatesSkipped = 0; // NEW: Track duplicates
    
    const seenJobs = this.seenJobIds.get(id);
    
    // Infinite loop - continuously polls for NEW jobs
    while (this.running.get(id)) {
      try {
        this.log(id, 'info', '🔍 Scanning for new jobs posted within 15 minutes...');
        
        // Fetch recent jobs — routed through shared queue so all 4 campaigns
        // can't hit Upwork simultaneously; 45s cooldown enforced after each call.
        const jobs = await this.queueUpworkFetch(() => upworkJobService.fetchJobs(searchInput, 10));
        
        if (!jobs || jobs.length === 0) {
          this.log(id, 'info', 'No jobs found in this scan. Waiting 60 seconds...');
          await this.delay(60000);
          continue;
        }
        
        console.log(`📦 Fetched ${jobs.length} jobs from Upwork`);
        
        // Filter for NEW jobs (not seen before AND posted within 5 minutes)
        const newJobs = [];
        for (const job of jobs) {
          const jobId = job.id || job.ciphertext;
          
          if (!jobId) {
            continue;
          }
          
          // Skip if already processed
          if (seenJobs.has(jobId)) {
            continue;
          }
          
          // Check if posted within 5 minutes (real-time detection)
          if (!this.isJobPostedWithinMinutes(job.createdDateTime, 15)) {
            continue;
          }
          
          // Mark as seen immediately to prevent duplicates
          seenJobs.add(jobId);
          newJobs.push(job);
          this.log(id, 'success', `🆕 New job: "${job.title.substring(0, 50)}..."`);
        }
        
        if (newJobs.length === 0) {
          this.log(id, 'info', 'No new jobs posted within 15 minutes. Waiting 60 seconds...');
          await this.delay(60000);
          continue;
        }
        
        this.log(id, 'success', `✅ Found ${newJobs.length} NEW jobs to process!`);
        
        // Process each NEW job
        for (const job of newJobs) {
          // Check if campaign was stopped
          if (!this.running.get(id)) {
            this.log(id, 'info', 'Campaign stopped by user');
            break;
          }
          
          try {
            processed++;
            this.updateProgress(id, processed, processed, viable, nonViable);
            
            // ─────────────────────────────────────────────────────────────
            this.log(id, 'info', `📥 JOB FETCHED  #${processed}: "${job.title}"`);
            // ─────────────────────────────────────────────────────────────

            // ── STAGE 1: Viability Check ──────────────────────────────────
            this.log(id, 'info', '🔎 STAGE 1 → Viability check (GPT filter)...');
            const filterResult = await this.queueGPT(() => this.filterJobWithGPT(job, cookies, id));

            if (!filterResult.viable) {
              nonViable++;
              this.updateProgress(id, processed, processed, viable, nonViable);
              this.log(id, 'warning', `🚫 NOT VIABLE — rejected by GPT filter`);
              this.log(id, 'warning', `   Platform : ${filterResult.platform}`);
              this.log(id, 'warning', `   Tool     : ${filterResult.tool}`);
              continue;
            }

            this.log(id, 'success', `✅ VIABLE — Niche: ${filterResult.niche} | Platform: ${filterResult.platform} | Tool: ${filterResult.tool}`);

            // ── STAGE 2: Duplicate Check ──────────────────────────────────
            this.log(id, 'info', '🔍 STAGE 2 → Duplicate check (85% similarity)...');
            const isDuplicate = await storage.checkJobDuplicate(
              job.title,
              job.description,
              0.85
            );

            if (isDuplicate) {
              duplicatesSkipped++;
              nonViable++;
              this.updateProgress(id, processed, processed, viable, nonViable);
              this.log(id, 'warning', `♻️  DUPLICATE — skipping job`);
              this.log(id, 'warning', `   Matched  : "${isDuplicate.title}"`);
              this.log(id, 'warning', `   Seen on  : ${new Date(isDuplicate.createdAt).toLocaleString()}`);
              continue;
            }

            this.log(id, 'success', `✅ UNIQUE — no duplicate found`);

            viable++;
            this.updateProgress(id, processed, processed, viable, nonViable);

            const jobMeta = {
              title: job.title,
              description: job.description || '',
              niche: filterResult.niche,
              platform: filterResult.platform,
              tool: filterResult.tool
            };

            // ── STAGE 3: Generate Product (README) ───────────────────────
            // NOTE: We generate ALL content BEFORE saving to DB so the sync-service
            // always picks up a complete record (job + product + blog + service).
            this.log(id, 'info', '📦 STAGE 3 → Generating product README (up to 3 attempts)...');
            let repoData = null;
            try {
              repoData = await this.withRetry(
                () => this.queueGPT(() => this.generateReadmeForJob(job, filterResult.niche, filterResult.platform, filterResult.tool, cookies, id)),
                id, 'README generation'
              );
              this.log(id, 'success', `✅ README generated → repo: "${repoData.repo_name}"`);
            } catch (err) {
              this.log(id, 'error', `❌ STAGE 3 FAILED (all retries exhausted) — ${err.message}`);
            }

            // ── STAGE 4: Generate Blog ────────────────────────────────────
            this.log(id, 'info', '⏳ Waiting 15s before next GPT request...');
            await new Promise(r => setTimeout(r, 8000));
            this.log(id, 'info', '📝 STAGE 4 → Generating blog post (up to 3 attempts)...');
            let blogData = null;
            try {
              const blogResponse = await this.withRetry(
                () => this.queueGPT(() => this.runGPTPrompt(this.buildBlogPrompt(jobMeta), cookies, id)),
                id, 'Blog generation'
              );
              let parsed = null;
              try { parsed = this.extractJSONFromResponse(blogResponse); } catch {}
              if (parsed?.title && parsed?.content) {
                blogData = parsed;
              } else {
                // GPT returned plain text (stability check triggered before JSON block)
                // Use first line as title, full response as content
                const lines = String(blogResponse).trim().split('\n');
                const title = lines[0].replace(/^[#*\s]+/, '').slice(0, 120) || `${jobMeta.title} — Automation Guide`;
                blogData = { title, content: String(blogResponse).trim() };
                this.log(id, 'warning', `⚠️ STAGE 4 — no JSON block, using plain text fallback`);
              }
              this.log(id, 'success', `✅ Blog generated → "${blogData.title}"`);
            } catch (err) {
              this.log(id, 'error', `❌ STAGE 4 FAILED (all retries exhausted) — ${err.message}`);
            }

            // ── STAGE 5: Generate Service ─────────────────────────────────
            this.log(id, 'info', '⏳ Waiting 15s before next GPT request...');
            await new Promise(r => setTimeout(r, 8000));
            this.log(id, 'info', '🛎️  STAGE 5 → Generating service listing (up to 3 attempts)...');
            let serviceData = null;
            try {
              const serviceResponse = await this.withRetry(
                () => this.queueGPT(() => this.runGPTPrompt(this.buildServicesPrompt(jobMeta), cookies, id)),
                id, 'Service generation'
              );
              let parsedSvc = null;
              try { parsedSvc = this.extractJSONFromResponse(serviceResponse); } catch {}
              if (parsedSvc?.title && parsedSvc?.content) {
                serviceData = parsedSvc;
              } else {
                const svcLines = String(serviceResponse).trim().split('\n');
                const svcTitle = svcLines[0].replace(/^[#*\s]+/, '').slice(0, 120) || `${jobMeta.title} — Service`;
                serviceData = { title: svcTitle, content: String(serviceResponse).trim() };
                this.log(id, 'warning', `⚠️ STAGE 5 — no JSON block, using plain text fallback`);
              }
              this.log(id, 'success', `✅ Service generated → "${serviceData.title}"`);
            } catch (err) {
              this.log(id, 'error', `❌ STAGE 5 FAILED (all retries exhausted) — ${err.message}`);
            }

            // ── STAGE 6: Save everything atomically ───────────────────────
            // Job only appears in jobs_selected once product/blog/service are ready.
            // The sync-service will therefore always pick up a complete record.
            this.log(id, 'info', '💾 STAGE 6 → Saving job + content to DB (atomic)...');
            let savedJobId = null;
            try {
              savedJobId = await storage.saveJobWithRelations(
                job, filterResult, id, searchInput,
                { repoData, blogData, serviceData }
              );
              this.log(id, 'success',
                `✅ Saved → jobs_selected id: ${savedJobId}` +
                `  product:${repoData ? '✅' : '—'}` +
                `  blog:${blogData ? '✅' : '—'}` +
                `  service:${serviceData ? '✅' : '—'}`
              );
            } catch (saveErr) {
              this.log(id, 'error', `❌ STAGE 6 FAILED — DB save: ${saveErr.message}`);
              this.log(id, 'error', `   Stack: ${saveErr.stack?.split('\n')[1]?.trim() || 'N/A'}`);
            }

            // ── STAGE 7: Cooldown + Duplicate Guard ──────────────────────
            this.log(id, 'info', '⏳ STAGE 7 → Cooldown 6s then marking job processed...');
            await this.delay(6000);

            try {
              await storage.storeProcessedJob({
                id: job.id || job.ciphertext,
                title: job.title,
                description: job.description,
                campaignId: id,
                niche: filterResult.niche,
                platform: filterResult.platform,
                tool: filterResult.tool,
                repoUrl: null,
                upworkJobUrl: job.url || `https://www.upwork.com/jobs/${job.id || job.ciphertext}`
              });
              this.log(id, 'success', `✅ DONE — job fully processed and stored`);
            } catch (storeError) {
              this.log(id, 'warning', `⚠️  Failed to store in duplicate guard DB: ${storeError.message}`);
            }
            // ─────────────────────────────────────────────────────────────
            
          } catch (error) {
            this.log(id, 'error', `Failed to process job: ${error.message}`);
            // Continue with next job
          }
        }
        
        // After processing batch, wait 60 seconds before next poll
        this.log(id, 'info', '✅ Batch processed. Waiting 60 seconds before next scan...');
        if (duplicatesSkipped > 0) {
          this.log(id, 'info', `   📊 Total duplicates skipped: ${duplicatesSkipped}`);
        }
        await this.delay(60000);

      } catch (error) {
        this.log(id, 'error', `Error in campaign loop: ${error.message}`);
        this.log(id, 'info', 'Retrying in 60 seconds...');
        await this.delay(60000);
      }
    }
    
    this.log(id, 'success', `Campaign completed - Total duplicates prevented: ${duplicatesSkipped}`);
    this.setStatus(id, 'Completed');
    
  } catch (error) {
    this.log(id, 'error', `Campaign failed: ${error.message}`);
    this.setStatus(id, 'Failed', error.message);
  } finally {
    this.running.delete(id);
    // Clear seen jobs for this campaign
    this.seenJobIds.delete(id);
  }
}

  async stopCampaign(id) {
    console.log(`Stopping Upwork campaign: ${id}`);
    
    if (!this.running.get(id)) {
      console.log('Campaign is not running');
      return;
    }
    
    this.log(id, 'info', 'Stopping campaign...');
    this.running.delete(id);
    
    // Clear seen jobs for this campaign to allow fresh start
    if (this.seenJobIds.has(id)) {
      this.seenJobIds.delete(id);
      console.log('Cleared seen jobs cache for campaign');
    }
    
    this.setStatus(id, 'Stopped');
    console.log('Campaign stopped');
  }

  /**
   * Extract job ID from Upwork job URL
   * @param {string} url - Upwork job URL
   * @returns {string|null} Job ID or null if invalid
   */
  extractJobIdFromUrl(url) {
    try {
      // Handle different Upwork URL formats:
      // 1. https://www.upwork.com/jobs/~01234567890abcdef
      // 2. https://www.upwork.com/ab/proposals/job/~01234567890abcdef
      // 3. Job ID might be in URL params or path
      
      const urlObj = new URL(url);
      const pathname = urlObj.pathname || '';

      // 1) Prefer explicit ~id patterns anywhere in the pathname (returns without the ~)
      let match = pathname.match(/~([a-zA-Z0-9]+)/);
      if (match && match[1]) return match[1];

      // 2) Handle slug_~id patterns (e.g. "...slug_~0219918.../")
      match = pathname.match(/_~([a-zA-Z0-9]+)/);
      if (match && match[1]) return match[1];

      // 3) Check common query params that might contain an id
      const params = urlObj.searchParams;
      if (params.has('id')) return params.get('id');
      if (params.has('jobId')) return params.get('jobId');

      // 4) Fallback: inspect last path segment and try to extract trailing alphanumeric id
      const parts = pathname.split('/').filter(p => p.length > 0);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        // If last part contains a ~ anywhere, return the alphanumeric after it
        match = lastPart.match(/~?([a-zA-Z0-9]+)$/);
        if (match && match[1]) return match[1];
      }

      return null;
    } catch (error) {
      console.error('Failed to extract job ID from URL:', error);
      return null;
    }
  }

  /**
   * Start a scrape-jobs campaign - processes specific job URLs
   * @param {string} id - Campaign ID
   */
  parseManualJobEntry(jobText) {
  const lines = jobText.split('\n').map(l => l.trim()).filter(l => l);
  
  const job = {
    title: '',
    description: '',
    skills: '',
    budget: '',
    duration: '',
    fullText: jobText
  };
  
  for (const line of lines) {
    const lower = line.toLowerCase();
    
    if (lower.startsWith('job title:') || lower.startsWith('title:')) {
      job.title = line.split(':').slice(1).join(':').trim();
    } else if (lower.startsWith('description:')) {
      job.description = line.split(':').slice(1).join(':').trim();
    } else if (lower.startsWith('skills:') || lower.startsWith('required skills:')) {
      job.skills = line.split(':').slice(1).join(':').trim();
    } else if (lower.startsWith('budget:')) {
      job.budget = line.split(':').slice(1).join(':').trim();
    } else if (lower.startsWith('duration:')) {
      job.duration = line.split(':').slice(1).join(':').trim();
    } else if (!job.description && job.title) {
      // If we have a title but no description yet, treat remaining lines as description
      job.description += (job.description ? ' ' : '') + line;
    }
  }
  
  // Fallback: if no structured data found, use first line as title and rest as description
  if (!job.title && lines.length > 0) {
    job.title = lines[0];
    job.description = lines.slice(1).join(' ');
  }
  
  return job;
}

/**
 * Build job description for GPT from manual entry
 * @param {Object} jobEntry - Parsed job object
 * @returns {string} Formatted job description
 */
buildManualJobDescription(jobEntry) {
  const sections = [];
  
  if (jobEntry.title) {
    sections.push(`Job Title: ${jobEntry.title}`);
  }
  
  if (jobEntry.description) {
    sections.push(`\nJob Description:\n${jobEntry.description}`);
  }
  
  if (jobEntry.skills) {
    sections.push(`\nRequired Skills: ${jobEntry.skills}`);
  }
  
  if (jobEntry.budget) {
    sections.push(`\nBudget: ${jobEntry.budget}`);
  }
  
  if (jobEntry.duration) {
    sections.push(`\nDuration: ${jobEntry.duration}`);
  }
  
  return sections.join('\n');
}

/**
 * Start a scrape-jobs campaign with manual job entries
 * @param {string} id - Campaign ID
 */
async startScrapeJobsCampaign(id) {
  console.log('\n===== STARTING MANUAL JOBS CAMPAIGN =====');
  console.log('Campaign ID:', id);
  
  if (this.running.get(id)) {
    console.log('Campaign already running');
    return;
  }

  this.running.set(id, true);
  this.setStatus(id, 'Running');

  const campaign = await storage.getScrapeJobsCampaign(id);

  if (!campaign) {
    console.log('Campaign not found');
    this.running.delete(id);
    return;
  }

  // Normalize snake_case DB columns to camelCase
  const scrapeJobUrls = campaign.scrape_job_urls || campaign.scrapeJobUrls || [];
  const scrapeJobNiche = campaign.scrape_job_niche || campaign.scrapeJobNiche || 'Automation';
  const scrapeGptAccountId = campaign.gpt_account_id || campaign.gptAccountId;
  const delayBetweenRepos = campaign.delay_between_repos || campaign.delayBetweenRepos || 900000;

  // Parse scrapeJobUrls if it's a string (raw DB text)
  const jobEntries = typeof scrapeJobUrls === 'string'
    ? scrapeJobUrls.split('---').map(j => j.trim()).filter(j => j.length > 0)
    : scrapeJobUrls;

  console.log('Campaign found:', campaign.name);
  console.log('Manual jobs to process:', jobEntries.length);
  console.log('Selected niche:', scrapeJobNiche);

  try {
    this.log(id, 'info', `🚀 Starting Manual Jobs campaign: ${campaign.name}`);
    this.log(id, 'info', `📋 Total jobs to process: ${jobEntries.length}`);
    this.log(id, 'info', `🎯 Niche: ${scrapeJobNiche}`);
    this.log(id, 'info', `🛡️ Duplicate detection: ENABLED`);

    // Get GPT cookies
    const cookies = await this.getGPTCookies(scrapeGptAccountId, id);
    
    let processed = 0;
    let successfulRepos = 0;
    let duplicates = 0;
    let errors = 0;
    let results = [];
    
    // Process each manual job entry
    for (let i = 0; i < jobEntries.length; i++) {
      // Check if campaign was stopped
      if (!this.running.get(id)) {
        this.log(id, 'info', 'Campaign stopped by user');
        break;
      }

      const jobText = jobEntries[i];

      try {
        processed++;
        const progress = {
          processed,
          total: jobEntries.length,
          successfulRepos,
          duplicates,
          errors
        };
        await storage.updateScrapeJobsCampaign(id, { progress });
        this.emit('progress', { campaignId: id, ...progress });

        this.log(id, 'info', `\n📋 Processing job ${processed}/${jobEntries.length}`);

        // Parse manual job entry
        this.log(id, 'info', '📝 Parsing manual job entry...');
        const jobEntry = this.parseManualJobEntry(jobText);

        if (!jobEntry.title) {
          this.log(id, 'error', `❌ Could not parse job entry (no title found)`);
          errors++;

          // Update progress for parse error
          const parseErrorProgress = {
            processed,
            total: jobEntries.length,
            successfulRepos,
            duplicates,
            errors
          };
          await storage.updateScrapeJobsCampaign(id, { progress: parseErrorProgress });
          this.emit('progress', { campaignId: id, ...parseErrorProgress });

          continue;
        }

        this.log(id, 'success', `✅ Job parsed: ${jobEntry.title}`);

        // Check for duplicates
        this.log(id, 'info', '🔍 Checking for duplicate jobs in database...');

        const isDuplicate = await storage.checkJobDuplicate(
          jobEntry.title,
          jobEntry.description,
          0.85
        );

        if (isDuplicate) {
          duplicates++;
          const newProgress = {
            processed,
            total: jobEntries.length,
            successfulRepos,
            duplicates,
            errors
          };
          await storage.updateScrapeJobsCampaign(id, { progress: newProgress });
          this.emit('progress', { campaignId: id, ...newProgress });

          this.log(id, 'warning', `⚠️ DUPLICATE DETECTED - Skipping job`);
          this.log(id, 'warning', `   Original job: "${isDuplicate.title}"`);
          this.log(id, 'warning', `   Processed on: ${new Date(isDuplicate.createdAt).toLocaleString()}`);
          if (isDuplicate.repoUrl) {
            this.log(id, 'warning', `   Repo: ${isDuplicate.repoUrl}`);
          }
          this.log(id, 'info', `   Total duplicates skipped: ${duplicates}`);

          // Wait before next job
          if (i < jobEntries.length - 1) {
            this.log(id, 'info', `⏸️ Waiting ${Math.round(delayBetweenRepos / 1000)}s before next job...`);
            await this.delay(delayBetweenRepos);
          }
          continue;
        }

        this.log(id, 'success', `✅ No duplicate found - proceeding with job`);

        // Use user-selected niche (no GPT filtering needed)
        const niche = scrapeJobNiche;
        this.log(id, 'info', `🎯 Using selected niche: ${niche}`);

        // NOTE: We generate ALL content BEFORE saving so the sync-service
        // always picks up a complete record (job + product + blog + service).
        const entryMeta = {
          title: jobEntry.title,
          description: jobEntry.description || '',
          niche, platform: 'None', tool: 'None'
        };

        // Product
        this.log(id, 'info', '📦 Generating product README (up to 3 attempts)...');
        let repoData = null;
        try {
          repoData = await this.withRetry(
            () => this.queueGPT(() => this.generateReadmeForJob(jobEntry, niche, 'None', 'None', cookies, id)),
            id, 'README generation'
          );
          this.log(id, 'success', `✅ README generated: "${repoData.repo_name}"`);
        } catch (err) {
          this.log(id, 'error', `❌ Product generation failed (all retries): ${err.message}`);
        }

        // Blog
        this.log(id, 'info', '⏳ Waiting 15s before next GPT request...');
        await new Promise(r => setTimeout(r, 8000));
        this.log(id, 'info', '📝 Generating blog post (up to 3 attempts)...');
        let blogData = null;
        try {
          const blogResponse = await this.withRetry(
            () => this.queueGPT(() => this.runGPTPrompt(this.buildBlogPrompt(entryMeta), cookies, id)),
            id, 'Blog generation'
          );
          let parsedBlog2 = null;
          try { parsedBlog2 = this.extractJSONFromResponse(blogResponse); } catch {}
          if (parsedBlog2?.title && parsedBlog2?.content) {
            blogData = parsedBlog2;
          } else {
            const blogLines2 = String(blogResponse).trim().split('\n');
            const blogTitle2 = blogLines2[0].replace(/^[#*\s]+/, '').slice(0, 120) || `${entryMeta.title} — Automation Guide`;
            blogData = { title: blogTitle2, content: String(blogResponse).trim() };
            this.log(id, 'warning', `⚠️ Blog — no JSON block, using plain text fallback`);
          }
          this.log(id, 'success', `✅ Blog generated: "${blogData.title}"`);
        } catch (err) {
          this.log(id, 'error', `❌ Blog generation failed (all retries): ${err.message}`);
        }

        // Service
        this.log(id, 'info', '⏳ Waiting 15s before next GPT request...');
        await new Promise(r => setTimeout(r, 8000));
        this.log(id, 'info', '🛎️ Generating service listing (up to 3 attempts)...');
        let serviceData = null;
        try {
          const serviceResponse = await this.withRetry(
            () => this.queueGPT(() => this.runGPTPrompt(this.buildServicesPrompt(entryMeta), cookies, id)),
            id, 'Service generation'
          );
          let parsedSvc2 = null;
          try { parsedSvc2 = this.extractJSONFromResponse(serviceResponse); } catch {}
          if (parsedSvc2?.title && parsedSvc2?.content) {
            serviceData = parsedSvc2;
          } else {
            const svcLines2 = String(serviceResponse).trim().split('\n');
            const svcTitle2 = svcLines2[0].replace(/^[#*\s]+/, '').slice(0, 120) || `${entryMeta.title} — Service`;
            serviceData = { title: svcTitle2, content: String(serviceResponse).trim() };
            this.log(id, 'warning', `⚠️ STAGE 5 — no JSON block, using plain text fallback`);
          }
          this.log(id, 'success', `✅ Service generated: "${serviceData.title}"`);
        } catch (err) {
          this.log(id, 'error', `❌ Service generation failed (all retries): ${err.message}`);
        }

        // Save everything atomically (job + all relations in one transaction)
        this.log(id, 'info', '💾 Saving job + content to DB (atomic)...');
        let savedJobId = null;
        try {
          savedJobId = await storage.saveJobWithRelations(
            { title: jobEntry.title, description: jobEntry.description, url: 'manual-entry' },
            { niche, platform: 'None', tool: 'None' },
            id, null,
            { repoData, blogData, serviceData }
          );
          this.log(id, 'success',
            `✅ Saved → id: ${savedJobId}  product:${repoData ? '✅' : '—'}  blog:${blogData ? '✅' : '—'}  service:${serviceData ? '✅' : '—'}`
          );
        } catch (saveErr) {
          this.log(id, 'error', `❌ DB save failed: ${saveErr.message}`);
        }

        // Summary
        this.log(id, 'info', `📊 JOB SUMMARY (id: ${savedJobId}) → product:${repoData ? '✅' : '❌'}  blog:${blogData ? '✅' : '❌'}  service:${serviceData ? '✅' : '❌'}`);

        successfulRepos++;
        
        // Store processed job to prevent duplicates
        try {
          await storage.storeProcessedJob({
            id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: jobEntry.title,
            description: jobEntry.description,
            campaignId: id,
            niche: niche,
            platform: 'None',
            tool: 'None',
            repoUrl: null,
            upworkJobUrl: 'manual-entry'
          });
          
          this.log(id, 'success', `💾 Job stored in database to prevent future duplicates`);
        } catch (storeError) {
          this.log(id, 'warning', `⚠️ Failed to store job in duplicate database: ${storeError.message}`);
        }
        
        // Record result
        results.push({
          jobTitle: jobEntry.title,
          niche: niche,
          repoName: 'pending-day-2',
          repoUrl: null,
          repoDescription: '',
          timestamp: new Date().toISOString(),
          status: 'success'
        });
        
        // Update progress with successful repo count
        const updatedProgress = {
          processed,
          total: jobEntries.length,
          successfulRepos,
          duplicates,
          errors
        };
        
        // Save results and updated progress
        await storage.updateScrapeJobsCampaign(id, {
          results: results,
          progress: updatedProgress
        });
        this.emit('progress', { campaignId: id, ...updatedProgress });
        
        this.log(id, 'success', `📊 Progress: ${successfulRepos} repos / ${duplicates} duplicates / ${errors} errors`);
        
      } catch (error) {
        this.log(id, 'error', `❌ Failed to process job: ${error.message}`);
        errors++;
        
        // Record failed result
        results.push({
          jobText: jobText.substring(0, 100) + '...',
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Update progress with error count
        const errorProgress = {
          processed,
          total: jobEntries.length,
          successfulRepos,
          duplicates,
          errors
        };
        
        await storage.updateScrapeJobsCampaign(id, {
          results: results,
          progress: errorProgress
        });
        this.emit('progress', { campaignId: id, ...errorProgress });
      }
      
      // Wait before next job (unless it's the last one)
      if (i < jobEntries.length - 1 && this.running.get(id)) {
        this.log(id, 'info', `⏸️ Waiting ${Math.round(delayBetweenRepos / 1000)}s before next job...`);
        await this.delay(delayBetweenRepos);
      }
    }
    
    this.log(id, 'success', `\n✅ Campaign completed!`);
    this.log(id, 'success', `   📊 Final stats:`);
    this.log(id, 'success', `   - Total processed: ${processed}`);
    this.log(id, 'success', `   - Repos created: ${successfulRepos}`);
    this.log(id, 'success', `   - Duplicates skipped: ${duplicates}`);
    this.log(id, 'success', `   - Errors: ${errors}`);
    
    this.setStatus(id, 'Completed');
    
  } catch (error) {
    this.log(id, 'error', `Campaign failed: ${error.message}`);
    this.setStatus(id, 'Failed', error.message);
  } finally {
    this.running.delete(id);
  }
}


  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retries an async function up to `maxRetries` extra times.
   * Waits `delayMs` between attempts. Re-throws on final failure.
   */
  async withRetry(fn, campaignId, label = 'GPT call', maxRetries = 2, delayMs = 8000) {
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (err) {
        lastErr = err;
        if (attempt <= maxRetries) {
          this.log(campaignId, 'warning',
            `⚠️ ${label} — attempt ${attempt} failed: ${err.message}. Retrying in ${delayMs / 1000}s...`
          );
          await this.delay(delayMs);
        }
      }
    }
    throw lastErr;
  }

  getCampaignLogs(id) {
    console.log(`Getting logs for Upwork campaign: ${id}`);
    return storage.getLogs(id);
  }
}

export const upworkCampaignManager = new UpworkCampaignManager();