import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';

/**
 * Strip HTML tags and convert to clean plain text
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  try {
    // Use JSDOM to properly parse and extract text
    const dom = new JSDOM(html);
    const text = dom.window.document.body.textContent || '';
    
    // Clean up whitespace
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Keep paragraph breaks
      .trim();
  } catch (error) {
    // Fallback: Simple regex-based stripping
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, '') // Remove all tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp;
      .replace(/&lt;/g, '<') // Decode entities
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Strip HTML from all content fields in scraped data
 */
function cleanScrapedData(data) {
  return {
    ...data,
    description: data.description || '',
    readmeContent: stripHtml(data.readmeHTML),
    featuresContent: stripHtml(data.featuresHTML),
    useCasesContent: stripHtml(data.useCasesHTML),
    pricingContent: stripHtml(data.pricingHTML),
    // Remove HTML versions after conversion
    readmeHTML: undefined,
    featuresHTML: undefined,
    useCasesHTML: undefined,
    pricingHTML: undefined
  };
}

/**
 * Scrape Apify actor page to extract comprehensive data for ChatGPT processing
 */
export async function scrapeApifyActor(url, logFn = console.log) {
  logFn(`🔍 Scraping Apify actor: ${url}`);
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
    
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    logFn(`📄 Loading page: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    
    logFn(`⏳ Waiting for page content to render...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      await Promise.race([
        page.waitForSelector('h1', { timeout: 10000 }),
        new Promise(resolve => setTimeout(resolve, 10000))
      ]);
      logFn(`✅ Page content detected`);
    } catch (e) {
      logFn(`⚠️ Timeout waiting for elements, proceeding anyway...`);
    }
    
    // Extract comprehensive data
    const scrapedData = await page.evaluate(() => {
      // Helper function to extract text content
      const getText = (selectors) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            return element.textContent.trim();
          }
        }
        return null;
      };

      // Helper function to extract HTML content
      const getHTML = (selectors) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            return element.innerHTML;
          }
        }
        return null;
      };

      // Extract title
      const titleSelectors = [
        'h1[class*="ActorHeader"]',
        'h1[class*="Title"]',
        '[data-test="actor-title"]',
        'h1'
      ];
      const title = getText(titleSelectors);

      // Extract description
      const descriptionSelectors = [
        'meta[name="description"]',
        'meta[property="og:description"]',
        '[class*="ActorDescription"]',
        '[class*="Description"]'
      ];
      
      let description = null;
      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          description = element.getAttribute('content') || element.textContent.trim();
          if (description) break;
        }
      }

      // Extract category/tags
      const categories = [];
      const categoryElements = document.querySelectorAll('[class*="Category"], [class*="Tag"], [class*="Badge"]');
      categoryElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length < 50) {
          categories.push(text);
        }
      });

      // Extract README/Documentation content
      const readmeSelectors = [
        '[data-test="readme-content"]',
        '.Readme-Markdown',
        'div[class*="Readme"]',
        'article[class*="Readme"]',
        '[role="tabpanel"]:not([hidden])',
        'main article'
      ];
      
      const readmeHTML = getHTML(readmeSelectors);

      // Extract pricing/stats if available
      const stats = {};
      const statElements = document.querySelectorAll('[class*="Stat"], [class*="Metric"]');
      statElements.forEach(el => {
        const label = el.querySelector('[class*="Label"]')?.textContent.trim();
        const value = el.querySelector('[class*="Value"]')?.textContent.trim();
        if (label && value) {
          stats[label] = value;
        }
      });

      // Extract features section
      const featuresHTML = getHTML([
        '[class*="Features"]',
        '[class*="Capabilities"]',
        'section[class*="features" i]'
      ]);

      // Extract use cases section
      const useCasesHTML = getHTML([
        '[class*="UseCase"]',
        '[class*="Example"]',
        'section[class*="use-case" i]'
      ]);

      // Extract pricing info
      const pricingHTML = getHTML([
        '[class*="Pricing"]',
        '[class*="Price"]',
        'section[class*="pricing" i]'
      ]);

      return {
        title,
        description,
        categories,
        readmeHTML,
        featuresHTML,
        useCasesHTML,
        pricingHTML,
        stats
      };
    });
    
    if (!scrapedData.title) {
      throw new Error('Could not extract title from Apify actor page');
    }
    
    logFn(`✅ Data extracted successfully`);
    logFn(`   Title: ${scrapedData.title}`);
    logFn(`   Description: ${scrapedData.description ? 'Found' : 'Not found'}`);
    logFn(`   README: ${scrapedData.readmeHTML ? 'Found' : 'Not found'}`);
    logFn(`   Categories: ${scrapedData.categories.length}`);
    
    // Generate a safe repository name from title
    const repoName = scrapedData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
    
    // ⭐ CLEAN HTML - Convert to plain text
    logFn(`🧹 Stripping HTML from content...`);
    const cleanedData = cleanScrapedData(scrapedData);
    
    const result = {
      sourceUrl: url,
      title: cleanedData.title,
      description: cleanedData.description,
      categories: cleanedData.categories,
      readmeContent: cleanedData.readmeContent,
      featuresContent: cleanedData.featuresContent,
      useCasesContent: cleanedData.useCasesContent,
      pricingContent: cleanedData.pricingContent,
      stats: cleanedData.stats,
      repoName: repoName
    };
    
    logFn(`✅ HTML stripped successfully`);
    logFn(`   README text: ${result.readmeContent?.length || 0} chars`);
    logFn(`   Features text: ${result.featuresContent?.length || 0} chars`);
    logFn(`   Use cases text: ${result.useCasesContent?.length || 0} chars`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Apify scraping failed:', error.message);
    throw new Error(`Failed to scrape Apify actor: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape multiple Apify actor URLs
 */
export async function scrapeMultipleApifyActors(urls, logFn = console.log) {
  logFn(`🔍 Starting to scrape ${urls.length} Apify actors`);
  
  const results = [];
  const errors = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    
    if (!url) continue;
    
    try {
      logFn(`\n[${i + 1}/${urls.length}] Processing: ${url}`);
      const data = await scrapeApifyActor(url, logFn);
      results.push({ url, data, status: 'success' });
      
      // Add delay between requests
      if (i < urls.length - 1) {
        logFn(`⏳ Waiting 3 seconds before next scrape...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      logFn(`❌ Failed to scrape ${url}: ${error.message}`);
      errors.push({ url, error: error.message });
      results.push({ url, data: null, status: 'failed', error: error.message });
    }
  }
  
  logFn(`\n✅ Scraping completed: ${results.filter(r => r.status === 'success').length} succeeded, ${errors.length} failed`);
  
  return { results, errors };
}