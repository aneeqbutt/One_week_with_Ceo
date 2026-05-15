/**
 * ENHANCED CODE PARSER & GITHUB PUSHER
 * Handles multiple GPT response formats and pushes to GitHub with directory creation
 */

import axios from 'axios';

/**
 * Parse GPT's code response - handles multiple formats
 */
function parseCodeResponse(gptResponse) {
  console.log('\n🔍 ===== PARSING CODE RESPONSE =====');
  console.log(`📏 Response length: ${gptResponse.length} characters\n`);
  
  const files = [];
  
  // Method 1: ### filepath format (primary format)
  console.log('📋 Method 1: Parsing ### filepath format...');
  const method1Files = extractTripleHashFormat(gptResponse);
  files.push(...method1Files);
  console.log(`  ✅ Found ${method1Files.length} files`);
  
  // Method 2: Code blocks with paths
  console.log('📋 Method 2: Parsing code blocks with paths...');
  const method2Files = extractCodeBlocksWithPaths(gptResponse);
  files.push(...method2Files);
  console.log(`  ✅ Found ${method2Files.length} files`);
  
  // Method 3: Structured file blocks
  console.log('📋 Method 3: Parsing structured blocks...');
  const method3Files = extractStructuredFileBlocks(gptResponse);
  files.push(...method3Files);
  console.log(`  ✅ Found ${method3Files.length} files`);
  
  // Remove duplicates and validate
  const uniqueFiles = deduplicateFiles(files);
  const validFiles = validateFiles(uniqueFiles);
  
  console.log(`\n✅ Total unique files: ${uniqueFiles.length}`);
  console.log(`✅ Valid files: ${validFiles.length}`);
  console.log('===================================\n');
  
  if (validFiles.length === 0) {
    console.error('❌ NO VALID FILES EXTRACTED!');
    console.log('\n📄 Response preview (first 2000 chars):');
    console.log(gptResponse.substring(0, 2000));
    throw new Error('No valid files could be extracted from GPT response');
  }
  
  return validFiles;
}

/**
 * Method 1: Extract ### filepath format
 * Example:
 * ### package.json
 * { "name": "test" }
 */
function extractTripleHashFormat(response) {
  const files = [];
  const sections = response.split(/^###\s+/gm);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split('\n');
    const filepath = lines[0].trim();
    
    // Get code (everything after the first line)
    let code = lines.slice(1).join('\n').trim();
    
    // Remove markdown code blocks if present
    code = code.replace(/^```[\w]*\n?/gm, '');
    code = code.replace(/\n?```$/gm, '');
    code = code.trim();
    
    if (filepath && code && code.length > 10) {
      files.push({ filepath, code });
    }
  }
  
  return files;
}

/**
 * Method 2: Extract code blocks with file paths
 */
function extractCodeBlocksWithPaths(response) {
  const files = [];
  
  // Pattern 1: ```language:filepath
  const pattern1 = /```[\w]*:([^\n]+)\n([\s\S]*?)```/g;
  let match;
  
  while ((match = pattern1.exec(response)) !== null) {
    const filepath = match[1].trim();
    const code = match[2].trim();
    if (filepath && code) {
      files.push({ filepath, code });
    }
  }
  
  // Pattern 2: Comment before code block
  const pattern2 = /(?:\/\/|#)\s*(?:File|Path):\s*([^\n]+)\n```[\w]*\n([\s\S]*?)```/gi;
  while ((match = pattern2.exec(response)) !== null) {
    const filepath = match[1].trim();
    const code = match[2].trim();
    if (filepath && code) {
      files.push({ filepath, code });
    }
  }
  
  // Pattern 3: Header before code block
  const pattern3 = /#{1,6}\s+([^\n]+\.[a-zA-Z0-9]+)\s*\n```[\w]*\n([\s\S]*?)```/g;
  while ((match = pattern3.exec(response)) !== null) {
    const filepath = match[1].trim();
    const code = match[2].trim();
    if (filepath && code && (filepath.includes('/') || filepath.includes('.'))) {
      files.push({ filepath, code });
    }
  }
  
  return files;
}

/**
 * Method 3: Extract structured file blocks
 */
function extractStructuredFileBlocks(response) {
  const files = [];
  const pattern = /\*\*(?:File|Path):\s*`?([^`\n*]+?)`?\*\*\s*\n```[\w]*\n([\s\S]*?)```/gi;
  let match;
  
  while ((match = pattern.exec(response)) !== null) {
    const filepath = match[1].trim();
    const code = match[2].trim();
    if (filepath && code) {
      files.push({ filepath, code });
    }
  }
  
  return files;
}

/**
 * Remove duplicate files (keep longest code)
 */
function deduplicateFiles(files) {
  const fileMap = new Map();
  
  for (const file of files) {
    const normalizedPath = file.filepath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .toLowerCase();
    
    if (!fileMap.has(normalizedPath)) {
      fileMap.set(normalizedPath, file);
    } else {
      const existing = fileMap.get(normalizedPath);
      if (file.code.length > existing.code.length) {
        fileMap.set(normalizedPath, file);
      }
    }
  }
  
  return Array.from(fileMap.values());
}

/**
 * Validate files
 */
function validateFiles(files) {
  return files.filter(file => {
    // Must have filepath
    if (!file.filepath || typeof file.filepath !== 'string') {
      console.warn('  ⚠️ Skipping: missing filepath');
      return false;
    }
    
    // Must have code
    if (!file.code || typeof file.code !== 'string' || file.code.length < 10) {
      console.warn(`  ⚠️ Skipping ${file.filepath}: no valid content`);
      return false;
    }
    
    // Must have file extension
    if (!/\.[a-zA-Z0-9]{1,10}$/.test(file.filepath)) {
      console.warn(`  ⚠️ Skipping ${file.filepath}: no file extension`);
      return false;
    }
    
    return true;
  });
}

/**
 * Clean and normalize file paths
 */
function cleanFilePath(filepath, repoName = '') {
  let cleaned = filepath.trim();
  
  // Remove quotes
  cleaned = cleaned.replace(/['"]/g, '');
  
  // Convert backslashes to forward slashes
  cleaned = cleaned.replace(/\\/g, '/');
  
  // Remove repo name prefix if present
  if (repoName) {
    const repoPrefix = new RegExp(`^${repoName}/`, 'i');
    cleaned = cleaned.replace(repoPrefix, '');
  }
  
  // Remove leading slashes
  cleaned = cleaned.replace(/^\/+/, '');
  
  return cleaned;
}

/**
 * Push a single file to GitHub (creates directories automatically)
 */
async function pushFileToGitHub({ owner, repo, filepath, content, token, logFn = console.log }) {
  try {
    const b64Content = Buffer.from(content, 'utf-8').toString('base64');
    
    const data = JSON.stringify({
      message: `feat: add ${filepath}`,
      content: b64Content
    });
    
    const config = {
      method: 'put',
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`,
      headers: { 
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: data
    };
    
    await axios.request(config);
    return { success: true, filepath };
    
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    return { success: false, filepath, error: errorMsg };
  }
}

/**
 * Push all files to GitHub with retry and progress tracking
 */
async function pushAllFilesToGitHub({ 
  owner, 
  repo, 
  files, 
  token, 
  logFn = console.log,
  maxRetries = 3 
}) {
  logFn(`\n📦 ===== PUSHING ${files.length} FILES TO GITHUB =====`);
  logFn(`👤 Owner: ${owner}`);
  logFn(`📦 Repository: ${repo}`);
  logFn(`📁 Total files: ${files.length}\n`);
  
  const results = {
    total: files.length,
    successful: 0,
    failed: 0,
    details: []
  };
  
  // Sort files by depth (shallow first)
  const sortedFiles = [...files].sort((a, b) => {
    const depthA = (a.filepath.match(/\//g) || []).length;
    const depthB = (b.filepath.match(/\//g) || []).length;
    return depthA - depthB;
  });
  
  const delayMs = 1200; // Rate limiting delay
  
  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    
    logFn(`\n[${i + 1}/${sortedFiles.length}] ${file.filepath}`);
    logFn(`  📏 Size: ${file.code.length} chars`);
    
    let success = false;
    let lastError = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
      if (attempt > 1) {
        logFn(`  🔄 Retry ${attempt}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
      
      const result = await pushFileToGitHub({
        owner,
        repo,
        filepath: file.filepath,
        content: file.code,
        token,
        logFn
      });
      
      if (result.success) {
        logFn(`  ✅ Pushed successfully`);
        results.successful++;
        results.details.push(result);
        success = true;
      } else {
        lastError = result.error;
        if (attempt === maxRetries) {
          logFn(`  ❌ Failed: ${lastError}`);
          results.failed++;
          results.details.push(result);
        }
      }
    }
    
    // Delay between files (except last)
    if (i < sortedFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  logFn(`\n📊 ===== PUSH SUMMARY =====`);
  logFn(`✅ Successful: ${results.successful}/${results.total}`);
  logFn(`❌ Failed: ${results.failed}/${results.total}`);
  
  if (results.failed > 0) {
    logFn('\n❌ Failed files:');
    results.details
      .filter(r => !r.success)
      .forEach(r => logFn(`  - ${r.filepath}: ${r.error}`));
  } else {
    logFn('🎉 All files pushed successfully!');
  }
  
  logFn(`==========================\n`);
  
  return results;
}

/**
 * Display file structure as a tree
 */
function logFileStructure(files, logFn = console.log) {
  logFn('\n📂 ===== FILE STRUCTURE =====');
  
  const tree = {};
  files.forEach(file => {
    const parts = file.filepath.split('/');
    let current = tree;
    
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        if (!current._files) current._files = [];
        current._files.push(part);
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });
  
  function printTree(node, prefix = '', isLast = true) {
    const dirs = Object.keys(node).filter(k => k !== '_files');
    const files = node._files || [];
    
    dirs.forEach((dir, index) => {
      const isLastDir = index === dirs.length - 1 && files.length === 0;
      const connector = isLastDir ? '└── ' : '├── ';
      const newPrefix = prefix + (isLastDir ? '    ' : '│   ');
      
      logFn(`${prefix}${connector}📁 ${dir}/`);
      printTree(node[dir], newPrefix, isLastDir);
    });
    
    files.forEach((file, index) => {
      const isLastFile = index === files.length - 1;
      const connector = isLastFile ? '└── ' : '├── ';
      logFn(`${prefix}${connector}📄 ${file}`);
    });
  }
  
  printTree(tree);
  logFn('============================\n');
}

export {
  parseCodeResponse,
  cleanFilePath,
  pushFileToGitHub,
  pushAllFilesToGitHub,
  logFileStructure,
  validateFiles
};