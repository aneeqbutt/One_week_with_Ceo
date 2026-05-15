import { jsonrepair } from 'jsonrepair';

/**
 * Extract and repair JSON from GPT response text
 * Handles malformed JSON, missing quotes, trailing commas, etc.
 * 
 * @param {string} text - Raw GPT response text
 * @param {string} logPrefix - Prefix for log messages (optional)
 * @returns {Object} Parsed JSON object
 * @throws {Error} If JSON cannot be extracted or repaired
 */
export function extractAndRepairJSON(text, logPrefix = '') {
  const log = (msg) => console.log(`${logPrefix}${msg}`);
  
  log('🔍 Attempting to extract JSON from response...');
  
  // Strategy 1: Try multiple JSON extraction patterns
  const patterns = [
    // Standard code block with json marker
    /```json\s*\n?([\s\S]*?)```/i,
    // Code block without marker
    /```\s*\n?([\s\S]*?)```/,
    // Bare JSON object (greedy, last resort)
    /\{[\s\S]*\}/,
    // JSON object on single line
    /\{[^{}]*\}/,
  ];
  
  let extracted = null;
  let patternUsed = '';
  
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) {
      extracted = match[1] || match[0];
      patternUsed = `Pattern ${i + 1}`;
      log(`✓ Extracted JSON using ${patternUsed}`);
      break;
    }
  }
  
  if (!extracted) {
    log('❌ No JSON pattern matched in response');
    throw new Error('No JSON found in response text');
  }
  
  // Clean common GPT formatting artifacts
  extracted = extracted
    .trim()
    .replace(/^```json?\s*/i, '')  // Remove opening fence
    .replace(/```\s*$/, '')         // Remove closing fence
    .replace(/^\s*json\s*/i, '');   // Remove stray 'json' label
  
  log(`📄 Extracted text (first 200 chars): ${extracted.substring(0, 200)}...`);
  
  // Strategy 2: Try direct parse first (fast path)
  try {
    const parsed = JSON.parse(extracted);
    log('✅ JSON parsed successfully (no repair needed)');
    return parsed;
  } catch (directError) {
    log(`⚠️ Direct parse failed: ${directError.message}`);
  }
  
  // Strategy 3: Use jsonrepair library to fix common issues
  try {
    log('🔧 Attempting to repair JSON...');
    const repaired = jsonrepair(extracted);
    log(`✓ JSON repaired, length: ${repaired.length}`);
    
    // Parse the repaired JSON
    const parsed = JSON.parse(repaired);
    log('✅ Repaired JSON parsed successfully');
    
    // Log what was repaired (if different)
    if (repaired !== extracted) {
      log('📝 JSON was modified during repair');
      log(`   Original: ${extracted.substring(0, 100)}...`);
      log(`   Repaired: ${repaired.substring(0, 100)}...`);
    }
    
    return parsed;
    
  } catch (repairError) {
    log(`❌ JSON repair failed: ${repairError.message}`);
    
    // Strategy 4: Try aggressive cleaning and repair
    try {
      log('🔧 Attempting aggressive JSON cleaning...');
      
      // Remove comments (// and /* */)
      let cleaned = extracted
        .replace(/\/\/.*$/gm, '')           // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, '');  // Remove block comments
      
      // Fix common GPT mistakes
      cleaned = cleaned
        .replace(/,\s*([}\]])/g, '$1')      // Remove trailing commas
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
        .replace(/:\s*'([^']*)'/g, ':"$1"') // Replace single quotes with double
        .replace(/\n/g, ' ')                // Remove newlines
        .replace(/\s+/g, ' ')               // Collapse whitespace
        .trim();
      
      log(`   Cleaned: ${cleaned.substring(0, 100)}...`);
      
      // Try repair again
      const repairedAgain = jsonrepair(cleaned);
      const parsed = JSON.parse(repairedAgain);
      
      log('✅ Aggressive cleaning successful!');
      return parsed;
      
    } catch (aggressiveError) {
      log(`❌ Aggressive cleaning failed: ${aggressiveError.message}`);
      
      // Strategy 5: Try to extract just key-value pairs with regex
      try {
        log('🔧 Attempting regex extraction as last resort...');
        
        const kvPairs = {};
        const kvPattern = /"?(\w+)"?\s*:\s*"?([^",}\]]+)"?/g;
        let match;
        
        while ((match = kvPattern.exec(extracted)) !== null) {
          const key = match[1];
          let value = match[2].trim();
          
          // Try to infer type
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (value === 'null') value = null;
          else if (!isNaN(value) && value !== '') value = Number(value);
          
          kvPairs[key] = value;
        }
        
        if (Object.keys(kvPairs).length > 0) {
          log(`✅ Extracted ${Object.keys(kvPairs).length} key-value pairs via regex`);
          return kvPairs;
        }
        
      } catch (regexError) {
        log(`❌ Regex extraction failed: ${regexError.message}`);
      }
    }
  }
  
  // All strategies failed
  throw new Error('Failed to extract or repair JSON from response. All strategies exhausted.');
}

/**
 * Validate and normalize job filter response
 * Handles NEW prompt structure with platform and tool
 * 
 * @param {Object} parsed - Parsed JSON object
 * @returns {Object} Normalized response with { open_source_viable, niche, platform, tool }
 */
export function normalizeJobFilterResponse(parsed) {
  const result = {
    open_source_viable: 'No',
    niche: 'None',
    platform: 'None',
    tool: 'None'
  };
  
  // Handle various field name variations for open_source_viable
  const viableFields = ['open_source_viable', 'viable', 'is_viable', 'saasViable', 'isViable'];
  
  // Find viable field
  for (const field of viableFields) {
    if (field in parsed) {
      const value = parsed[field];
      
      // Normalize to 'Yes' or 'No'
      if (typeof value === 'boolean') {
        result.open_source_viable = value ? 'Yes' : 'No';
      } else if (typeof value === 'string') {
        const normalized = value.toLowerCase().trim();
        if (normalized === 'yes' || normalized === 'true' || normalized === '1') {
          result.open_source_viable = 'Yes';
        } else {
          result.open_source_viable = 'No';
        }
      }
      break;
    }
  }
  
  // Handle niche field
  const nicheFields = ['niche', 'category', 'type', 'job_niche', 'jobNiche'];
  
  for (const field of nicheFields) {
    if (field in parsed) {
      const value = parsed[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        result.niche = value.trim();
      }
      break;
    }
  }
  
  // Validate niche value (should be Scraping, Automation, or None)
  const validNiches = ['Scraping', 'Automation', 'None', 'Other'];
  if (!validNiches.includes(result.niche)) {
    // Try to map common variations
    const nicheLower = result.niche.toLowerCase();
    if (nicheLower.includes('scrap') || nicheLower.includes('crawl') || nicheLower.includes('extract')) {
      result.niche = 'Scraping';
    } else if (nicheLower.includes('automat') || nicheLower.includes('bot') || nicheLower.includes('workflow')) {
      result.niche = 'Automation';
    } else {
      result.niche = 'Other';
    }
  }
  
  // NEW: Handle platform field
  const platformFields = ['platform', 'target_platform', 'website', 'site'];
  
  for (const field of platformFields) {
    if (field in parsed) {
      const value = parsed[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        const normalized = value.trim();
        // Don't accept "None" as a valid platform
        if (normalized.toLowerCase() !== 'none') {
          result.platform = normalized;
        }
      }
      break;
    }
  }
  
  // NEW: Handle tool field
  const toolFields = ['tool', 'technology', 'framework', 'library'];
  
  for (const field of toolFields) {
    if (field in parsed) {
      const value = parsed[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        const normalized = value.trim();
        // Don't accept "None" as a valid tool
        if (normalized.toLowerCase() !== 'none') {
          result.tool = normalized;
        }
      }
      break;
    }
  }
  
  return result;
}