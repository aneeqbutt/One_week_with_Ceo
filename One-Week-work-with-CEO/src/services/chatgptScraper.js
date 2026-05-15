import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import electron from 'electron';
const { app } = electron;

// Helper function to wait (replaces waitForTimeout)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to wait for page to be fully loaded and interactive
async function waitForPageReady(page, timeoutMs = 30000) {
  console.log('⏳ Waiting for page to be fully ready...');
  
  try {
    await page.waitForFunction(() => {
      return document.readyState === 'complete';
    }, { timeout: timeoutMs });
    
    await page.waitForFunction(() => {
      const body = document.body;
      return body && body.innerText && body.innerText.length > 100;
    }, { timeout: timeoutMs });
    
    await wait(3000);
    
    console.log('✅ Page is fully ready');
    return true;
  } catch (error) {
    console.warn('⚠️ Page ready check timed out, proceeding anyway...');
    return false;
  }
}

// Helper function to wait for ChatGPT to finish responding
async function waitForResponseComplete(page, timeoutMs = 180000) {
  console.log('⏳ Waiting for ChatGPT to complete response...');
  
  const startTime = Date.now();
  let lastLength = 0;
  let stableCount = 0;
  const requiredStableChecks = 3; // Response must be stable for 3 checks
  
  try {
    while (Date.now() - startTime < timeoutMs) {
      // Check if response is still being generated
      const responseStatus = await page.evaluate(() => {
        // Multiple ways to detect if ChatGPT is still typing
        
        // Method 1: Check for "stop generating" button
        const stopButton = document.querySelector('button[aria-label*="Stop"]') || 
                          document.querySelector('button[aria-label*="stop"]');
        
        // Method 2: Look for streaming indicators
        const streamingIndicators = document.querySelectorAll('[class*="streaming"]');
        
        // Method 3: Check for cursor/typing animation
        const typingCursor = document.querySelector('[class*="cursor"]') || 
                           document.querySelector('[class*="blink"]');
        
        // Method 4: Get the last assistant message
        const assistantMessages = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn"]'));
        const lastMessage = assistantMessages[assistantMessages.length - 1];
        
        if (!lastMessage) {
          return { isTyping: true, hasMessage: false, text: '', textLength: 0 };
        }
        
        const messageText = lastMessage.innerText || lastMessage.textContent || '';
        
        // Check if there's a code block with JSON
        const codeBlocks = lastMessage.querySelectorAll('pre code, code');
        let hasJsonBlock = false;
        let jsonText = '';
        
        for (const block of codeBlocks) {
          const blockText = block.innerText || block.textContent || '';
          if (blockText.includes('{') && blockText.includes('repo_name')) {
            hasJsonBlock = true;
            jsonText = blockText;
            break;
          }
        }
        
        // If no code block, check the whole message
        if (!hasJsonBlock && messageText.includes('{') && messageText.includes('repo_name')) {
          hasJsonBlock = true;
          jsonText = messageText;
        }
        
        const isTyping = !!(stopButton || streamingIndicators.length > 0 || typingCursor);
        
        return {
          isTyping,
          hasMessage: true,
          hasJsonBlock,
          text: messageText,
          jsonText: jsonText,
          textLength: messageText.length
        };
      });
      
      console.log(`📊 Response status: typing=${responseStatus.isTyping}, length=${responseStatus.textLength}, hasJSON=${responseStatus.hasJsonBlock}`);
      
      // If we have a JSON block and ChatGPT is not typing, check for stability
      if (responseStatus.hasJsonBlock && !responseStatus.isTyping) {
        if (responseStatus.textLength === lastLength) {
          stableCount++;
          console.log(`✓ Response stable (${stableCount}/${requiredStableChecks})`);
          
          if (stableCount >= requiredStableChecks) {
            console.log('✅ Response is complete and stable!');
            return true;
          }
        } else {
          stableCount = 0;
          lastLength = responseStatus.textLength;
        }
      } else {
        stableCount = 0;
        lastLength = responseStatus.textLength;
      }
      
      await wait(2000); // Check every 2 seconds
    }
    
    console.warn('⚠️ Timeout waiting for response completion');
    return false;
    
  } catch (error) {
    console.error('❌ Error waiting for response:', error.message);
    return false;
  }
}

// Helper function to extract response from ChatGPT
async function extractChatGPTResponse(page) {
  console.log('🔍 Extracting ChatGPT response...');
  
  try {
    const extraction = await page.evaluate(() => {
      // Find all conversation turns
      const turns = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn"]'));
      
      if (turns.length === 0) {
        console.error('No conversation turns found');
        return { success: false, error: 'No messages found' };
      }
      
      // Get the last assistant message
      const lastMessage = turns[turns.length - 1];
      
      console.log('Found last message element');
      
      // Strategy 1: Look for the markdown container with the specific class structure
      const markdownContainer = lastMessage.querySelector('.markdown.prose, div[class*="markdown"]');
      
      if (markdownContainer) {
        console.log('Found markdown container');
        
        // Look for code blocks within pre tags
        const preElements = markdownContainer.querySelectorAll('pre');
        console.log(`Found ${preElements.length} pre elements`);
        
        let allCodeContent = '';
        
        for (const pre of preElements) {
          // Try multiple selectors to get the code content
          const codeElement = pre.querySelector('code') || 
                             pre.querySelector('div[class*="overflow"] code') ||
                             pre.querySelector('div[dir="ltr"] code');
          
          if (codeElement) {
            const codeText = codeElement.innerText || codeElement.textContent || '';
            console.log(`Code block found, length: ${codeText.length}`);
            allCodeContent += codeText + '\n\n';
          }
        }
        
        // If we found code content, check if it contains our data
        if (allCodeContent.length > 50) {
          console.log(`Total code content length: ${allCodeContent.length}`);
          
          // Check if this contains repo_name (could be in YAML or JSON format)
          if (allCodeContent.includes('repo_name') || 
              allCodeContent.includes('Repo Name:') ||
              allCodeContent.includes('repo-name')) {
            console.log('Found repo data in code blocks');
            return {
              success: true,
              text: allCodeContent,
              fullMessage: markdownContainer.innerText || markdownContainer.textContent,
              source: 'markdown-code-blocks'
            };
          }
        }
        
        // If code blocks didn't work, try getting all text from markdown container
        const fullText = markdownContainer.innerText || markdownContainer.textContent || '';
        console.log(`Markdown container text length: ${fullText.length}`);
        
        if (fullText.includes('repo_name') || fullText.includes('Repo Name:')) {
          console.log('Found repo data in markdown text');
          return {
            success: true,
            text: fullText,
            fullMessage: fullText,
            source: 'markdown-container'
          };
        }
      }
      
      // Strategy 2: Try standard code block selectors
      console.log('Trying standard code block extraction...');
      const codeBlocks = lastMessage.querySelectorAll('pre code, code, pre');
      
      for (const block of codeBlocks) {
        const blockText = block.innerText || block.textContent || '';
        
        if ((blockText.includes('{') && blockText.includes('repo_name')) ||
            blockText.includes('Repo Name:')) {
          console.log('Found data in standard code block');
          return { 
            success: true, 
            text: blockText,
            fullMessage: lastMessage.innerText || lastMessage.textContent,
            source: 'standard-code-block'
          };
        }
      }
      
      // Strategy 3: Get all text and try pattern matching
      console.log('Trying pattern extraction from full message...');
      const messageText = lastMessage.innerText || lastMessage.textContent || '';
      console.log(`Full message length: ${messageText.length}`);
      console.log(`Message preview: ${messageText.substring(0, 300)}`);
      
      // Try to find JSON pattern
      const patterns = [
        /\{[\s\S]*?"repo_name"[\s\S]*?"description"[\s\S]*?"readme"[\s\S]*?\}/,
        /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*"repo_name"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/,
        /\{(?:[^{}]|\{[^{}]*\})*"repo_name"(?:[^{}]|\{[^{}]*\})*\}/s,
      ];
      
      for (let i = 0; i < patterns.length; i++) {
        const match = messageText.match(patterns[i]);
        if (match) {
          const extracted = match[0];
          const openBraces = (extracted.match(/\{/g) || []).length;
          const closeBraces = (extracted.match(/\}/g) || []).length;
          
          if (openBraces === closeBraces) {
            console.log(`Found JSON with pattern ${i + 1}`);
            return { 
              success: true, 
              text: extracted,
              fullMessage: messageText,
              source: `pattern-${i + 1}`
            };
          }
        }
      }
      
      // Strategy 4: Manual JSON extraction
      console.log('Trying manual JSON extraction...');
      const firstBrace = messageText.indexOf('{');
      const lastBrace = messageText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const extracted = messageText.substring(firstBrace, lastBrace + 1);
        
        if (extracted.includes('repo_name') && extracted.includes('description')) {
          console.log('Found JSON via manual extraction');
          return {
            success: true,
            text: extracted,
            fullMessage: messageText,
            source: 'manual-extraction'
          };
        }
      }
      

      // Strategy 5: Look for a <p data-start="..."> element that contains the JSON but uses <br> and HTML entities
      console.log('Trying <p data-start> fallback extraction...');
      try {
        const pCandidates = Array.from(document.querySelectorAll('p[data-start]'));
        for (const p of pCandidates) {
          const inner = p.innerHTML || p.textContent || p.innerText || '';
          if (inner.includes('repo_name') || inner.includes('Repo Name')) {
            // Convert <br> to newlines, then decode HTML entities by leveraging the DOM
            const htmlWithNewlines = inner.replace(/<br\s*\/?>/gi, '\n');
            const tmp = document.createElement('div');
            tmp.innerHTML = htmlWithNewlines;
            const decoded = tmp.textContent || tmp.innerText || '';

            if (decoded && (decoded.includes('repo_name') || decoded.includes('description'))) {
              console.log('Found JSON in <p data-start> element');
              return {
                success: true,
                text: decoded,
                fullMessage: decoded,
                source: 'p-data-start-fallback'
              };
            }
          }
        }
      } catch (e) {
        console.log('Error during <p data-start> fallback extraction:', e && e.message);
      }
      // Last resort: return full message text
      console.log('Returning full message text');
      return { 
        success: true, 
        text: messageText,
        fullMessage: messageText,
        source: 'full-message-fallback'
      };
    });
    
    if (!extraction.success) {
      throw new Error(extraction.error || 'Failed to extract response');
    }
    
    console.log(`✅ Extracted response from: ${extraction.source}`);
    console.log(`📏 Response length: ${extraction.text.length} characters`);
    console.log(`📝 Preview: ${extraction.text.substring(0, 200)}...`);
    
    return extraction.text;
    
  } catch (error) {
    console.error('❌ Error extracting response:', error.message);
    
    // Take a debug screenshot
    await page.screenshot({ path: 'extraction-error.png' });
    console.log('📸 Debug screenshot saved as extraction-error.png');
    
    throw error;
  }
}

// Helper function to parse and clean JSON
function parseAndCleanJSON(text) {
  console.log('🔧 Parsing and cleaning JSON...');
  console.log('📝 Input text preview:', text.substring(0, 200));
  
  try {
    // Step 1: Remove markdown code block markers
    let cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // Step 2: Try multiple extraction strategies
    let jsonText = null;
    
    // Strategy 1: Text is already pure JSON
    if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
      console.log('✓ Text appears to be pure JSON');
      jsonText = cleaned;
    }
    
    // Strategy 2: Extract JSON using multiple patterns
    if (!jsonText) {
      const patterns = [
        // Match complete JSON with required fields
        /\{[\s\S]*?"repo_name"[\s\S]*?"description"[\s\S]*?"readme"[\s\S]*?\}/,
        // Match from first { containing repo_name to its closing }
        /\{(?:[^{}]|(?:\{(?:[^{}]|\{[^{}]*\})*\}))*"repo_name"(?:[^{}]|(?:\{(?:[^{}]|\{[^{}]*\})*\}))*\}/s,
        // More greedy pattern
        /\{[^]*?"repo_name"[^]*?\}/,
      ];
      
      for (let i = 0; i < patterns.length; i++) {
        const match = cleaned.match(patterns[i]);
        if (match) {
          const candidate = match[0];
          // Verify balanced braces
          const openBraces = (candidate.match(/\{/g) || []).length;
          const closeBraces = (candidate.match(/\}/g) || []).length;
          
          if (openBraces === closeBraces && candidate.includes('description') && candidate.includes('readme')) {
            console.log(`✓ Extracted JSON with pattern ${i + 1}`);
            jsonText = candidate;
            break;
          }
        }
      }
    }
    
    // Strategy 3: Manual extraction - find the JSON object boundaries
    if (!jsonText) {
      console.log('Trying manual JSON extraction...');
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = cleaned.substring(firstBrace, lastBrace + 1);
        
        if (candidate.includes('repo_name') && candidate.includes('description') && candidate.includes('readme')) {
          console.log('✓ Extracted JSON manually');
          jsonText = candidate;
        }
      }
    }
    
    // Strategy 4: Look for JSON line by line (in case there's text before/after)
    if (!jsonText) {
      console.log('Trying line-by-line extraction...');
      const lines = cleaned.split('\n');
      let startIdx = -1;
      let endIdx = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (startIdx === -1 && lines[i].trim().startsWith('{')) {
          startIdx = i;
        }
        if (startIdx !== -1 && lines[i].trim().endsWith('}')) {
          endIdx = i;
        }
      }
      
      if (startIdx !== -1 && endIdx !== -1) {
        const candidate = lines.slice(startIdx, endIdx + 1).join('\n');
        if (candidate.includes('repo_name') && candidate.includes('description') && candidate.includes('readme')) {
          console.log('✓ Extracted JSON line-by-line');
          jsonText = candidate;
        }
      }
    }
    
    if (!jsonText) {
      console.error('❌ Could not find valid JSON in text');
      console.log('Full text:', cleaned.substring(0, 1000));
      throw new Error('Could not extract JSON from response');
    }
    
    // Clean up any remaining issues
    jsonText = jsonText.trim();
    
    // Remove any trailing commas before closing braces/brackets (common JSON error)
    jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
    
    console.log('📝 Final JSON text preview:', jsonText.substring(0, 200));
    
    // Parse the JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ JSON.parse failed:', parseError.message);
      console.log('JSON text that failed to parse:', jsonText.substring(0, 500));
      
      // Try to fix common JSON issues
      console.log('Attempting to fix common JSON issues...');
      
      // Fix unescaped newlines in strings
      let fixed = jsonText.replace(/\n(?=(?:[^"]*"[^"]*")*[^"]*"[^"]*$)/g, '\\n');
      
      // Fix unescaped quotes in strings (rough heuristic)
      // This is tricky and might not work perfectly
      
      try {
        parsed = JSON.parse(fixed);
        console.log('✓ Fixed JSON successfully');
      } catch (e) {
        throw new Error(`Invalid JSON structure: ${parseError.message}`);
      }
    }
    
    // Validate required fields
    if (!parsed.repo_name) {
      throw new Error('Missing required field: repo_name');
    }
    
    if (!parsed.description) {
      throw new Error('Missing required field: description');
    }
    
    if (!parsed.readme) {
      throw new Error('Missing required field: readme');
    }
    
    // Normalize tags/topics
    if (parsed.tags && !parsed.topics) {
      parsed.topics = parsed.tags;
    }
    
    if (parsed.topics && !parsed.tags) {
      parsed.tags = parsed.topics;
    }
    
    console.log('✅ JSON parsed and validated successfully');
    console.log('📦 Repo name:', parsed.repo_name);
    console.log('📝 Description length:', parsed.description.length);
    console.log('📄 README length:', parsed.readme.length);
    console.log('🐛 Issues count:', parsed.issues?.length || 0);
    
    return parsed;
    
  } catch (error) {
    console.error('❌ JSON parsing failed:', error.message);
    console.log('📝 Input text (first 500 chars):', text.substring(0, 500));
    console.log('📝 Input text (last 500 chars):', text.substring(Math.max(0, text.length - 500)));
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
}

// Helper function to find and click send button
async function clickSendButton(page, timeoutMs = 10000) {
  console.log('🔍 Looking for send button...');
  
  try {
    await page.waitForFunction(() => {
      const selectors = [
        'button[data-testid="send-button"]',
        'button[aria-label="Send message"]',
        'button[aria-label*="Send"]',
        'form button[type="submit"]',
      ];
      
      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button && !button.disabled) {
          return true;
        }
      }
      
      const allButtons = Array.from(document.querySelectorAll('button'));
      for (const btn of allButtons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const title = btn.getAttribute('title') || '';
        if ((ariaLabel.toLowerCase().includes('send') || 
             title.toLowerCase().includes('send')) && 
            !btn.disabled) {
          return true;
        }
      }
      
      return false;
    }, { timeout: timeoutMs });
    
    const buttonClicked = await page.evaluate(() => {
      const selectors = [
        'button[data-testid="send-button"]',
        'button[aria-label="Send message"]',
        'button[aria-label*="Send"]',
        'form button[type="submit"]',
      ];
      
      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button && !button.disabled) {
          button.click();
          return { success: true, method: selector };
        }
      }
      
      const allButtons = Array.from(document.querySelectorAll('button'));
      for (const btn of allButtons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const title = btn.getAttribute('title') || '';
        if ((ariaLabel.toLowerCase().includes('send') || 
             title.toLowerCase().includes('send')) && 
            !btn.disabled) {
          btn.click();
          return { success: true, method: 'aria-label/title search' };
        }
      }
      
      return { success: false };
    });
    
    if (buttonClicked.success) {
      console.log(`✅ Send button clicked via: ${buttonClicked.method}`);
      return true;
    } else {
      console.log('⚠️ Could not find enabled send button');
      return false;
    }
    
  } catch (error) {
    console.log('⚠️ Send button not found:', error.message);
    return false;
  }
}

// FIXED: Helper function to safely find and wait for input field (headless-compatible)
async function findInputField(page, timeoutMs = 20000) {
  console.log('🔍 Looking for input field...');
  
  try {
    // Remove offsetParent check for headless compatibility
    await page.waitForFunction(() => {
      const selectors = [
        '#prompt-textarea',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="message"]', 
        'textarea',
        'div[contenteditable="true"]',
        '[data-id="root"] textarea',
        'form textarea',
        'main textarea'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        // Simplified check - just verify element exists
        if (element) {
          const style = window.getComputedStyle(element);
          // Only check for display none, not offsetParent
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            return true;
          }
        }
      }
      return false;
    }, { timeout: timeoutMs });
    
    const inputInfo = await page.evaluate(() => {
      const selectors = [
        '#prompt-textarea',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="message"]',
        'textarea',
        'div[contenteditable="true"]',
        '[data-id="root"] textarea',
        'form textarea',
        'main textarea'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const style = window.getComputedStyle(element);
          const isVisible = style.display !== 'none' && 
                           style.visibility !== 'hidden' && 
                           style.opacity !== '0';
          
          if (isVisible) {
            const rect = element.getBoundingClientRect();
            
            return { 
              selector: selector,
              type: element.tagName.toLowerCase(),
              isContentEditable: element.contentEditable === 'true',
              bounds: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              }
            };
          }
        }
      }
      
      return null;
    });
    
    if (!inputInfo) {
      await page.screenshot({ path: 'input-not-found.png' });
      console.log('📸 Screenshot saved as input-not-found.png');
      throw new Error('Could not find a visible and interactable input field');
    }
    
    console.log(`✅ Found input field: ${inputInfo.type} (${inputInfo.selector})`);
    return inputInfo;
    
  } catch (error) {
    console.error('❌ Could not find input field:', error.message);
    throw new Error('Input field not found on page');
  }
}

// Helper function to safely type text into input
async function typeIntoInput(page, inputInfo, text, options = {}) {
  const { chunkSize = 500, delay = 5 } = options;
  const selector = inputInfo.selector;
  
  console.log(`⌨️ Attempting to type into: ${selector}`);
  
  try {
    await wait(1500);
    
    await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, selector);
    
    await wait(1000);
    
    try {
      await page.click(selector, { delay: 100 });
      console.log('✅ Clicked input field');
      await wait(1000);
      
      const isFocused = await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return document.activeElement === element;
      }, selector);
      
      if (!isFocused) {
        console.log('⚠️ Element not focused after click, trying to focus...');
        await page.focus(selector);
        await wait(500);
      }
      
    } catch (clickError) {
      console.log('⚠️ Click failed, trying alternative method...');
      await page.focus(selector);
      await wait(1000);
    }
    
    console.log('🧹 Clearing existing text...');
    try {
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await wait(200);
      await page.keyboard.press('Backspace');
      await wait(500);
    } catch (clearError) {
      console.log('⚠️ Could not clear text, continuing...');
    }
    
    console.log('⌨️ Typing text...');
    let typingSuccess = false;
    
    try {
      const chunks = text.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [text];
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`⌨️ Typing chunk ${i + 1}/${chunks.length}...`);
        await page.type(selector, chunks[i], { delay });
        await wait(150);
      }
      
      typingSuccess = true;
      console.log('✅ Text typed successfully via keyboard');
      
    } catch (typeError) {
      console.log('⚠️ Keyboard typing failed, trying direct value setting...');
      
      const setSuccess = await page.evaluate((sel, txt, isContentEditable) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        
        try {
          if (isContentEditable) {
            element.textContent = txt;
            element.innerText = txt;
          } else {
            element.value = txt;
          }
          
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          
          return true;
        } catch (e) {
          console.error('Direct set failed:', e);
          return false;
        }
      }, selector, text, inputInfo.isContentEditable);
      
      if (setSuccess) {
        typingSuccess = true;
        console.log('✅ Text set successfully via direct value setting');
      } else {
        throw new Error('All typing strategies failed');
      }
    }
    
    await wait(500);
    const currentValue = await page.evaluate((sel, isContentEditable) => {
      const element = document.querySelector(sel);
      if (!element) return '';
      return isContentEditable ? (element.textContent || element.innerText) : element.value;
    }, selector, inputInfo.isContentEditable);
    
    console.log(`📏 Text entered: ${currentValue.length} characters`);
    
    if (currentValue.length === 0) {
      throw new Error('Text was not entered into input field');
    }
    
    if (currentValue.length < text.length * 0.9) {
      console.warn(`⚠️ Warning: Only ${currentValue.length}/${text.length} characters entered`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error in typeIntoInput:', error.message);
    await page.screenshot({ path: 'typing-error.png' });
    console.log('📸 Screenshot saved as typing-error.png');
    throw error;
  }
}

// Load cookies from JSON file or passed cookies array
function loadCookies(cookiesArray = null) {
  try {
    console.log('\n🍪 ===== LOADING CHATGPT COOKIES =====');
    
    // If cookies array is provided, use it directly
    if (cookiesArray && Array.isArray(cookiesArray)) {
      console.log('✅ Using provided cookies array');
      console.log(`📋 Total cookies: ${cookiesArray.length}`);
      
      // Try to extract session token from cookies array
      let sessionToken = null;
      for (const cookie of cookiesArray) {
        if (cookie.name === '__Secure-next-auth.session-token' || cookie.name === 'sessionToken') {
          sessionToken = cookie.value;
          break;
        }
      }
      
      if (!sessionToken) {
        console.error('❌ sessionToken not found in cookies array');
        throw new Error('Cookies array must contain "__Secure-next-auth.session-token" cookie');
      }
      
      console.log('✅ Session token loaded from cookies array');
      console.log('🔑 Token preview:', sessionToken.substring(0, 20) + '...');
      console.log('=====================================\n');
      return { sessionToken };
    }
    
    // Otherwise, load from file (fallback)
    const userDataPath = app.getPath('userData');
    const cookiesPath = path.join(userDataPath, 'cookies.json');
    
    console.log('📁 userData path:', userDataPath);
    console.log('📁 Checking cookies path:', cookiesPath);
    
    let finalPath = cookiesPath;
    if (!fs.existsSync(cookiesPath)) {
      console.log('⚠️ cookies.json not found in userData, trying current directory...');
      finalPath = path.join(process.cwd(), 'cookies.json');
      console.log('📁 Current directory path:', finalPath);
    }
    
    if (!fs.existsSync(finalPath)) {
      console.error('❌ cookies.json not found at:', finalPath);
      throw new Error(`cookies.json not found. Please create it at: ${finalPath}`);
    }
    
    console.log('✅ cookies.json found at:', finalPath);
    
    const data = fs.readFileSync(finalPath, 'utf-8');
    const cookies = JSON.parse(data);
    
    let sessionToken = cookies.sessionToken || cookies['__Secure-next-auth.session-token'];
    if (!sessionToken) {
      console.error('❌ sessionToken not found in cookies.json');
      throw new Error('cookies.json must contain "sessionToken" or "__Secure-next-auth.session-token" field');
    }
    
    console.log('✅ Session token loaded successfully');
    console.log('🔑 Token preview:', sessionToken.substring(0, 20) + '...');
    console.log('=====================================\n');
    return { sessionToken };
  } catch (error) {
    console.error('❌ Failed to load cookies:', error.message);
    throw new Error(`Failed to load cookies: ${error.message}`);
  }
}

async function askChatGPTForRepoMetadata({ 
  keyword, 
  questionsWithAnswers = [], 
  projectName = 'github json repo generator',
  cookies = null // NEW: Accept cookies array
}, onProgress) {
  
  console.log('\n🤖 ===== STARTING CHATGPT SCRAPER =====');
  console.log('📝 Keyword:', keyword);
  console.log('❓ Questions with Answers:', questionsWithAnswers);
  console.log('📂 Project Name:', projectName);
  console.log('=======================================\n');
  
  const browser = await puppeteer.launch({ 
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
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });
  
  console.log('✅ Browser launched');
  
  const page = await browser.newPage();
  
  // Set a realistic user agent for headless mode
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  console.log('✅ New page created with user agent');
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Autofill') || text.includes("wasn't found")) {
      return;
    }
    if (msg.type() === 'error' && !text.includes('Autofill')) {
      console.log('Browser console error:', text);
    }
  });
  
  try {
    onProgress?.('Loading ChatGPT cookies...');
    console.log('🍪 Loading cookies...');
    const cookiesData = loadCookies(cookies); // Pass cookies parameter
    
    console.log('🍪 Setting session cookie...');
    await page.setCookie({ 
      name: '__Secure-next-auth.session-token', 
      value: cookiesData.sessionToken, 
      domain: '.chatgpt.com', 
      path: '/',
      secure: true,
      httpOnly: true
    });
    console.log('✅ Cookie set successfully');

    onProgress?.('Opening ChatGPT...');
    console.log('🌐 Navigating to ChatGPT...');
    await page.goto('https://chatgpt.com/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    console.log('✅ ChatGPT page loaded');
    
    onProgress?.('Waiting for page to fully load...');
    await waitForPageReady(page);
    console.log('✅ Page fully loaded and interactive');

    onProgress?.(`Looking for project: ${projectName}...`);
    console.log(`🔍 Looking for project: ${projectName}...`);
    
    try {
      console.log('⏳ Waiting for sidebar...');
      await page.waitForSelector('nav', { timeout: 15000 });
      console.log('✅ Sidebar loaded');
      
      await wait(2000);
      
      // FIXED: Use strict project name matching (avoid partial matches)
      const projectFound = await page.evaluate((projName) => {
        const selectors = [
          'nav a',
          'nav button', 
          '[role="navigation"] a',
          '[role="navigation"] button',
          'aside a',
          'aside button',
          'div[class*="sidebar"] a',
          'div[class*="sidebar"] button'
        ];
        // Use regex for exact word boundary match
        const exactMatch = (text, name) => {
          // Remove extra whitespace and compare
          return text.trim().toLowerCase() === name.trim().toLowerCase();
        };
        for (const selector of selectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          const projectElement = elements.find(el => {
            const text = (el.innerText || el.textContent || '').trim();
            return exactMatch(text, projName);
          });
          if (projectElement) {
            console.log('Project found with selector:', selector);
            console.log('Project text:', projectElement.innerText || projectElement.textContent);
            projectElement.click();
            return true;
          }
        }
        // If not found, try to avoid partial matches (e.g., 'github repo generator' when looking for 'github json repo generator')
        // Do not click any project if not exact match
        console.log('Project not found in any location');
        return false;
      }, projectName);

      if (projectFound) {
        onProgress?.(`Navigated to project: ${projectName}`);
        console.log(`✅ Navigated to project: ${projectName}`);
        await wait(3000);
        await waitForPageReady(page);
      } else {
        console.log('⚠️ Trying to find Projects tab first...');
        
        const projectsTabClicked = await page.evaluate(() => {
          const projectsTab = Array.from(document.querySelectorAll('button, a')).find(el => 
            el.innerText?.toLowerCase().includes('projects') || 
            el.textContent?.toLowerCase().includes('projects')
          );
          if (projectsTab) {
            projectsTab.click();
            return true;
          }
          return false;
        });
        
        if (projectsTabClicked) {
          await wait(2000);
          
          const projectFoundAfterTab = await page.evaluate((projName) => {
            const elements = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
            const projectElement = elements.find(el => {
              const text = (el.innerText || el.textContent || '').trim();
              // Use exact match here too
              return text.toLowerCase() === projName.toLowerCase();
            });
            
            if (projectElement) {
              console.log('Found project:', projectElement.innerText || projectElement.textContent);
              projectElement.click();
              return true;
            }
            return false;
          }, projectName);
          
          if (projectFoundAfterTab) {
            onProgress?.(`Navigated to project: ${projectName}`);
            console.log(`✅ Found and navigated to project: ${projectName}`);
            await wait(3000);
            await waitForPageReady(page);
          } else {
            onProgress?.(`Project not found, continuing anyway...`);
            console.log(`⚠️ Project not found, will create a new chat`);
          }
        } else {
          onProgress?.(`Could not find project, proceeding with current chat...`);
          console.log(`⚠️ Could not find project tab or project`);
        }
      }
    } catch (e) {
      onProgress?.(`Could not find project, proceeding...`);
      console.log(`⚠️ Could not navigate to project: ${e.message}`);
    }

    console.log('\n📝 ===== CONSTRUCTING PROMPT =====');
    let prompt = `Keyword: ${keyword}`;
    
    if (questionsWithAnswers && questionsWithAnswers.length > 0) {
      prompt += `\n\nQuestions and Answers:\n`;
      questionsWithAnswers.forEach(({ question, answer }, idx) => {
        prompt += `\nQ${idx + 1}: ${question}`;
        prompt += `\nA${idx + 1}: ${answer}`;
      });
    }

    console.log('📝 Prompt constructed:');
    console.log(prompt);
    console.log('📏 Prompt length:', prompt.length, 'characters');
    console.log('================================\n');

    onProgress?.('Sending prompt to ChatGPT...');
    console.log('⌨️ Preparing to send prompt...');
    
    const inputInfo = await findInputField(page);
    await typeIntoInput(page, inputInfo, prompt);
    
    console.log('📤 Sending prompt...');
    onProgress?.('Prompt sent, waiting for response...');
    await wait(1000);
    
    const sendButtonClicked = await clickSendButton(page);
    
    if (!sendButtonClicked) {
      console.log('⌨️ Send button not found, using Enter key...');
      await page.keyboard.press('Enter');
      console.log('✅ Enter key pressed');
    }
    
    console.log('✅ Prompt sent');
    await wait(3000);
    
    onProgress?.('Waiting for ChatGPT response...');
    console.log('⏳ Waiting for ChatGPT to complete response...');

    // Use the new robust waiting function
    const responseComplete = await waitForResponseComplete(page);
    
    if (!responseComplete) {
      console.warn('⚠️ Response may not be complete, but proceeding with extraction...');
    }

    console.log('✅ ChatGPT response received');
    await wait(2000);

    // Extract the response using the new robust extraction
    onProgress?.('Extracting response...');
    const responseText = await extractChatGPTResponse(page);

    console.log('📝 Response extracted, length:', responseText.length, 'characters');

    // Parse and clean the JSON
    console.log('🔍 Parsing JSON...');
    const parsed = parseAndCleanJSON(responseText);

    onProgress?.('Successfully extracted repository metadata!');
    console.log('\n✅ ===== SUCCESS =====');
    console.log('📦 Repository:', parsed.repo_name);
    console.log('📝 Description:', parsed.description.substring(0, 100) + '...');
    console.log('🏷️ Topics:', parsed.topics?.length || 0);
    console.log('📄 README length:', parsed.readme?.length || 0, 'characters');
    console.log('🐛 Issues:', parsed.issues?.length || 0);
    console.log('=====================================\n');
    
    return parsed;
    
  } catch (error) {
    console.error('\n❌ ===== ERROR =====');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('====================\n');
    onProgress?.(`Error: ${error.message}`);
    throw error;
  } finally {
    console.log('🧹 Cleaning up...');
    await wait(1000);
    await page.close().catch(e => console.log('Error closing page:', e.message));
    await browser.close().catch(e => console.log('Error closing browser:', e.message));
    console.log('✅ Browser closed');
  }
}

export { askChatGPTForRepoMetadata };