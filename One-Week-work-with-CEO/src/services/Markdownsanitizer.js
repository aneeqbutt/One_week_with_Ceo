/**
 * ENHANCED Markdown Sanitizer - Handles Nested Backticks
 * Fixes the issue where README content gets stripped
 */

/**
 * Extract repo info block from GPT response
 * Handles nested backticks and various formats
 */
function extractRepoInfo(markdown) {
  console.log('\n🔍 ===== EXTRACTING REPO INFO =====');
  
  // Validate input first
  if (!markdown || typeof markdown !== 'string') {
    console.error('❌ Invalid markdown input:', typeof markdown);
    throw new Error('Markdown input is empty or invalid. Received: ' + typeof markdown);
  }
  
  if (markdown.trim().length === 0) {
    throw new Error('Markdown input is empty string');
  }
  
  try {
    // Remove outer markdown code block wrappers ONLY
    let cleaned = markdown.trim();
    
    // Remove ONLY the outermost ```markdown and closing ```
    if (cleaned.startsWith('```markdown')) {
      cleaned = cleaned.replace(/^```markdown\n?/, '');
      // Remove the LAST ``` only if it's at the end
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n?/, '');
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
    }
    
    cleaned = cleaned.trim();
    
    // Look for repo info in first section
    const lines = cleaned.split('\n');
    let repoInfoLines = [];
    let foundRepoName = false;
    
    // Extract first few lines that contain repo info
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim();
      
      if (line.includes('Repo Name:')) {
        foundRepoName = true;
        repoInfoLines.push(line);
      } else if (line.includes('Description:')) {
        repoInfoLines.push(line);
      } else if (line.includes('Topics:') || line.includes('Related Topics:')) {
        repoInfoLines.push(line);
        break; // Stop after topics
      } else if (foundRepoName && line.length > 0 && !line.startsWith('#')) {
        // Continue collecting if we found repo name
        repoInfoLines.push(line);
      } else if (line.startsWith('#')) {
        // Stop at first heading
        break;
      }
    }
    
    if (repoInfoLines.length > 0) {
      console.log('✅ Found Repo Info in first section');
      return parseRepoInfoContent(repoInfoLines.join('\n'));
    }
    
    // Fallback patterns
    const repoBlockPattern = /##\s*Repo\s*Info\s*Block\s*\n([\s\S]*?)(?=\n#{1,2}\s|\n---|\Z)/i;
    let match = cleaned.match(repoBlockPattern);
    
    if (match) {
      console.log('✅ Found Repo Info Block with ## header');
      return parseRepoInfoContent(match[1]);
    }
    
    const directPattern = /(?:^|\n)(Repo\s*Name:[\s\S]*?(?:Related\s*)?Topics:.*?)(?=\n#{1,2}|\n\n\n|\Z)/im;
    match = cleaned.match(directPattern);
    
    if (match) {
      console.log('✅ Found direct Repo Info format');
      return parseRepoInfoContent(match[1]);
    }
    
    console.warn('⚠️ No Repo Info Block found, using fallback extraction');
    return extractRepoInfoFallback(cleaned);
    
  } catch (error) {
    console.error('❌ Error extracting repo info:', error.message);
    throw new Error(`Failed to extract repo info: ${error.message}`);
  }
}

/**
 * Parse repo info content block into structured data
 */
function parseRepoInfoContent(content) {
  const info = {
    repo_name: '',
    description: '',
    topics: []
  };
  
  // Extract Repo Name
  const nameMatch = content.match(/Repo\s*Name:\s*(.+?)(?=\n|$)/i);
  if (nameMatch) {
    info.repo_name = nameMatch[1].trim();
  }
  
  // Extract Description
  const descMatch = content.match(/Description:\s*(.+?)(?=\n|$)/i);
  if (descMatch) {
    info.description = descMatch[1].trim();
  }
  
  // Extract Topics (handles multiple formats)
  const topicsMatch = content.match(/(?:Related\s*)?Topics:\s*(.+?)(?=\n|$)/i);
  if (topicsMatch) {
    const topicsString = topicsMatch[1].trim();
    info.topics = topicsString
      .split(/[,;]\s*/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }
  
  console.log('📋 Parsed Info:');
  console.log('  Repo Name:', info.repo_name);
  console.log('  Description:', info.description);
  console.log('  Topics:', info.topics.length);
  console.log('==================================\n');
  
  return info;
}

/**
 * Fallback extraction when standard patterns fail
 */
function extractRepoInfoFallback(markdown) {
  console.log('🔄 Using fallback repo info extraction...');
  
  const info = {
    repo_name: '',
    description: '',
    topics: []
  };
  
  // Try to extract first H1 as repo name
  const h1Match = markdown.match(/^#\s+(.+?)$/m);
  if (h1Match) {
    info.repo_name = h1Match[1]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Try to extract first paragraph as description
  const paraMatch = markdown.match(/\n\n(.+?)(?=\n\n|\n#)/s);
  if (paraMatch) {
    info.description = paraMatch[1]
      .replace(/\n/g, ' ')
      .trim()
      .substring(0, 200);
  }
  
  console.log('✅ Fallback extraction complete');
  return info;
}

/**
 * Remove repo info block from markdown to get clean README content
 * CRITICAL FIX: Only remove the repo info lines, keep everything else
 */
function removeRepoInfoBlock(markdown) {
  console.log('\n🧹 ===== CLEANING MARKDOWN =====');
  
  if (!markdown || typeof markdown !== 'string') {
    console.error('❌ Invalid markdown input for cleaning');
    return '';
  }
  
  let cleaned = markdown.trim();
  
  // Remove ONLY the outermost code block wrapper if present
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\n?/, '');
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '');
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
  }
  
  cleaned = cleaned.trim();
  
  // Remove ONLY the repo info lines at the start
  const lines = cleaned.split('\n');
  let startIndex = 0;
  
  // Skip repo info lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('Repo Name:') || 
        line.includes('Description:') || 
        line.includes('Topics:') || 
        line.includes('Related Topics:')) {
      startIndex = i + 1;
    } else if (line.startsWith('#') && startIndex > 0) {
      // Found first heading after repo info
      break;
    } else if (line.length > 0 && !line.startsWith('#') && startIndex > 0) {
      // Continue skipping if we're in repo info section
      continue;
    } else if (line.startsWith('#')) {
      // Found heading, stop here
      break;
    }
  }
  
  // Join remaining lines
  cleaned = lines.slice(startIndex).join('\n').trim();
  
  // Remove any "## Repo Info Block" header if present
  cleaned = cleaned.replace(/##\s*Repo\s*Info\s*Block\s*\n/i, '');
  
  // Clean up multiple consecutive newlines
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  
  console.log('✅ Markdown cleaned');
  console.log(`📏 Final length: ${cleaned.length} characters`);
  console.log('==============================\n');
  
  return cleaned.trim();
}

/**
 * Sanitize markdown content - fix common GPT syntax issues
 */
function sanitizeMarkdown(markdown) {
  console.log('\n🔧 ===== SANITIZING MARKDOWN =====');
  
  if (!markdown || typeof markdown !== 'string') {
    console.error('❌ Invalid markdown input for sanitization');
    return '';
  }
  
  let sanitized = markdown;
  
  // 1. Fix unclosed code blocks
  const codeBlockCount = (sanitized.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    console.log('🔧 Fixing unclosed code block');
    sanitized += '\n```';
  }
  
  // 2. Fix broken headers (# without space)
  sanitized = sanitized.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
  
  // 3. Fix broken lists (- without space)
  sanitized = sanitized.replace(/^([-*+])([^\s])/gm, '$1 $2');
  
  // 4. Fix broken numbered lists
  sanitized = sanitized.replace(/^(\d+\.)([^\s])/gm, '$1 $2');
  
  // 5. Remove excessive blank lines (more than 3)
  sanitized = sanitized.replace(/\n{4,}/g, '\n\n\n');
  
  // 6. Fix broken horizontal rules
  sanitized = sanitized.replace(/^-{2}$/gm, '---');
  sanitized = sanitized.replace(/^={2}$/gm, '---');
  
  // 7. Fix broken image syntax
  sanitized = sanitized.replace(/!\[([^\]]*)\]\s*\(([^)]+)\)/g, '![$1]($2)');
  
  // 8. Fix broken link syntax
  sanitized = sanitized.replace(/\[([^\]]+)\]\s*\(([^)]+)\)/g, '[$1]($2)');
  
  // 9. Escape special characters in inline code
  sanitized = sanitized.replace(/`([^`]*)`/g, (match, code) => {
    return '`' + code.trim() + '`';
  });
  
  // 10. Fix table formatting issues
  sanitized = sanitized.replace(/\|([^|\n]+)\|/g, (match, content) => {
    return '| ' + content.trim() + ' |';
  });
  
  console.log('✅ Markdown sanitized');
  console.log('==============================\n');
  
  return sanitized.trim();
}

/**
 * Validate markdown structure
 */
function validateMarkdown(markdown) {
  console.log('\n✓ ===== VALIDATING MARKDOWN =====');
  
  if (!markdown || typeof markdown !== 'string') {
    console.error('❌ Invalid markdown input for validation');
    return { valid: false, issues: ['Invalid markdown input'] };
  }
  
  const issues = [];
  
  // Check for title (H1)
  if (!/^#\s+.+/m.test(markdown)) {
    issues.push('Missing main title (H1)');
  }
  
  // Check for minimum content
  if (markdown.length < 100) {
    issues.push('Content too short (< 100 characters)');
  }
  
  // Check for balanced code blocks
  const codeBlockCount = (markdown.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    issues.push('Unbalanced code blocks');
  }
  
  // Check for broken links
  const brokenLinks = markdown.match(/\[([^\]]+)\]\s+\(/g);
  if (brokenLinks) {
    issues.push(`Found ${brokenLinks.length} broken link(s)`);
  }
  
  if (issues.length > 0) {
    console.warn('⚠️ Validation issues found:');
    issues.forEach(issue => console.warn(`  - ${issue}`));
  } else {
    console.log('✅ Markdown is valid');
  }
  
  console.log('==================================\n');
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Complete markdown processing pipeline
 */
function processMarkdownResponse(rawResponse) {
  console.log('\n🚀 ===== PROCESSING MARKDOWN RESPONSE =====\n');
  
  // Validate input
  if (!rawResponse) {
    const errorMsg = 'GPT README response is null or undefined';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }
  
  if (typeof rawResponse !== 'string') {
    const errorMsg = `GPT README response must be a string, received: ${typeof rawResponse}`;
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }
  
  if (rawResponse.trim().length === 0) {
    const errorMsg = 'GPT README response is an empty string';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }
  
  console.log(`✅ Input validation passed (${rawResponse.length} characters)\n`);
  
  try {
    // Step 1: Extract repo info
    const repoInfo = extractRepoInfo(rawResponse);
    
    // Step 2: Remove repo info block
    let readmeContent = removeRepoInfoBlock(rawResponse);
    
    // Step 3: Sanitize markdown
    readmeContent = sanitizeMarkdown(readmeContent);
    
    // Step 4: Validate
    const validation = validateMarkdown(readmeContent);
    
    if (!validation.valid) {
      console.warn('⚠️ Markdown has validation issues but proceeding...');
    }
    
    // Step 5: Ensure repo_name is valid
    if (!repoInfo.repo_name || repoInfo.repo_name.length === 0) {
      throw new Error('Repo name could not be extracted from response');
    }
    
    // Step 6: Ensure description exists
    if (!repoInfo.description || repoInfo.description.length === 0) {
      console.warn('⚠️ No description found, using first paragraph from README');
      const firstPara = readmeContent.match(/\n\n(.+?)(?=\n\n|\n#)/s);
      if (firstPara) {
        repoInfo.description = firstPara[1]
          .replace(/\n/g, ' ')
          .trim()
          .substring(0, 200);
      }
    }
    
    console.log('✅ ===== MARKDOWN PROCESSING COMPLETE =====\n');
    
    return {
      repo_name: repoInfo.repo_name,
      description: repoInfo.description,
      topics: repoInfo.topics,
      readme: readmeContent,
      about: repoInfo.description
    };
    
  } catch (error) {
    console.error('\n❌ ===== MARKDOWN PROCESSING FAILED =====');
    console.error('Error:', error.message);
    console.error('==========================================\n');
    throw error;
  }
}

export {
  extractRepoInfo,
  removeRepoInfoBlock,
  sanitizeMarkdown,
  validateMarkdown,
  processMarkdownResponse
};