import { processApifyDataWithChatGPT, sendPromptInSeparateChat } from './apifyToGPTProcessor.js';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

/**
 * Extract directory structure from README content
 */
function extractDirectoryStructure(readme) {
  console.log('📂 Extracting directory structure from README...');
  
  // Look for directory structure in code blocks
  // Patterns: "Directory Structure", "Project Structure", "File Structure", etc.
  const patterns = [
    /##\s*(?:Directory|Project|File)\s+Structure(?:\s+Tree)?\s*\n```[^\n]*\n([\s\S]*?)```/i,
    /###\s*(?:Directory|Project|File)\s+Structure(?:\s+Tree)?\s*\n```[^\n]*\n([\s\S]*?)```/i,
    /(?:Directory|Project|File)\s+Structure(?:\s+Tree)?[:\s]*\n```[^\n]*\n([\s\S]*?)```/i,
    /```(?:tree|bash|text)?\s*\n([\s\S]*?)```/i  // More generic pattern
  ];
  
  for (const pattern of patterns) {
    const match = readme.match(pattern);
    if (match && match[1]) {
      const structure = match[1].trim();
      
      // Verify it looks like a directory structure (has file/folder indicators)
      if (structure.includes('/') || structure.includes('.') || 
          structure.includes('├') || structure.includes('│')) {
        console.log('✅ Found directory structure');
        console.log('📏 Length:', structure.length, 'characters');
        return structure;
      }
    }
  }
  
  console.warn('⚠️ No directory structure found in README');
  return null;
}

/**
 * Build the code generation prompt using full README
 */
function buildCodeGenerationPrompt(readme) {
  // Escape backticks in the prompt to avoid template literal issues
  const promptText = `You are a **senior full-stack software engineer**.
Your task is to generate **complete, runnable code** for **every file listed in the directory structure** extracted from the target repository's **README**.

---

## INPUT

* The repository's README contains a **Directory Structure** section (a fenced code block or tree listing).

---

## WHAT YOU MUST DO

### 1) Discover the Directory Structure
* Open the provided repository URL.
* Locate the **README** (root README.md unless otherwise stated).
* **Parse the "Directory Structure" section** from the README:
  * If multiple trees exist, use the **primary** one (the most complete / top-level project tree).
  * Treat the tree as the **source of truth** for file names and folder paths.
* If the README's structure block includes comments like (file), (dir), or placeholders, **resolve them into concrete files**.
* Ignore binary assets (images, fonts, etc.). If the tree lists them, create a **.keep** or **README.txt** placeholder to keep folder integrity.

### 2) Generate Real, Runnable Source Code
For **every file** in the parsed directory tree:
* Produce **complete, production-grade code** (no stubs, no TODOs).
* Use the **language implied by the file extension** (.js, .ts, .tsx, .jsx, .py, .go, .rb, .java, .cs, .php, .rs, .sh, .yml, etc.).
* Ensure the entire project is **runnable end-to-end** with standard commands (e.g., npm start, npm run dev, node src/index.js, python main.py, etc.).
* **Wire all imports/exports** so the app runs **without modification**.
* Create and fill **manifest files** where appropriate:
  * JavaScript/TypeScript: package.json with scripts and dependencies/devDependencies.
  * Python: requirements.txt (and pyproject.toml if needed), plus an entry point (e.g., main.py).
  * Other ecosystems: provide the standard manifest/build files (e.g., go.mod, Cargo.toml, composer.json, pom.xml, build.gradle, Gemfile, etc.).
* If a **tests** directory (or any *.test.* / *_test.*) is present in the tree, include **at least one unit test** for critical functionality and a way to run tests (e.g., npm test, pytest, etc.).
* Add minimal but effective **error handling and logging**.
* Provide **sensible defaults** and lightweight **config stubs** (e.g., .env.example, config.sample.json) if the structure suggests configuration.
* **Do not** generate any README.md (explicitly forbidden).

### 3) Quality & Consistency Rules
* All code must be **syntactically valid** and **executable**.
* Keep architecture **modular** with clear single responsibility per file.
* Handle **async**/await or concurrency correctly.
* Keep comments **concise and useful** only where necessary.
* Ensure **imports resolve** across the entire project.
* Use **realistic implementations** (no "placeholder function" behavior).

---

## OUTPUT FORMAT (STRICT)

Output **only** a sequence of file blocks in this exact pattern for **every file** in the parsed directory tree:

### path/to/filename.ext
${'```'}<language>
<complete code here>
${'```'}

### path/to/nextfile.ext
${'```'}<language>
<complete code here>
${'```'}

Rules:
- path/to/ must reflect repo-name/ (top-level folder using the repository name) followed by directories and the exact file name from the tree.
- Use the **correct language tag** after the opening backticks (e.g., js, ts, tsx, jsx, json, py, go, rb, php, java, cs, rs, sh, yaml, etc.).
- **No extra text** anywhere outside these blocks. **No notes, no commentary, no explanations.**
- Do **not** output any README.md.

---

## FAILURE HANDLING
- If the README's directory structure block is **missing or ambiguous**, infer it from the repository's top-level layout (common folders like src/, app/, lib/, tests/, etc.) and proceed. Still **do not** include README.md.
- If a listed file is **binary or non-code**, place a minimal placeholder (e.g., .keep) with a single-line comment explaining its purpose (inside a code fence labeled text).

---

## FINAL TASK
After I give you the repository link, **fetch the directory structure from its README**, then **generate complete, runnable source code for every file**, following the **exact output format** above and **without any commentary**.

---

## PROJECT README

${readme}

`;
  
  console.log('✅ Prompt built successfully');
  console.log('📏 Prompt length:', promptText.length, 'characters');
  
  return promptText;
}
async function generateCodeWithGPT(prompt, logFn = console.log) {
  logFn('🤖 Sending code generation prompt to ChatGPT...');
  logFn('📏 Prompt length:', prompt.length, 'characters');
  logFn('⏳ Waiting for response...\n');
  
  try {
    // Send the code-generation prompt in a separate/fresh chat to avoid mixing contexts
    const codeResponse = await sendPromptInSeparateChat(prompt, logFn);
    
    logFn('✅ ChatGPT response received');
    logFn('📏 Response length:', codeResponse.length, 'characters\n');
    
    return codeResponse;
    
  } catch (error) {
    logFn('❌ Failed to generate code with ChatGPT');
    logFn('Error:', error.message);
    throw new Error(`Code generation failed: ${error.message}`);
  }
}

/**
 * Check if a string looks like a valid file path
 */
function isValidFilePath(filepath) {
  if (!filepath || typeof filepath !== 'string') return false;
  
  filepath = filepath.trim();
  
  // Must not be empty
  if (filepath.length === 0) return false;
  
  // Allow either files with extensions OR common no-extension filenames (LICENSE, Makefile, etc.)
  // Extract last path segment
  const lastSeg = filepath.split('/').pop();
  if (!lastSeg) return false;

  // Forbidden characters anywhere in path
  if (/[<>:\"|?*\r\n]/.test(filepath)) return false;

  // If it has an extension, accept (limit extension length)
  if (/\.[a-zA-Z0-9]{1,10}$/.test(lastSeg)) return true;

  // Otherwise accept common bare filenames (LICENSE, Makefile, Dockerfile, etc.)
  // Allow letters, numbers, dash, underscore and no spaces in the filename
  if (/^[A-Za-z0-9_\-]+$/.test(lastSeg)) return true;

  return false;
  
}

/**
 * Parse GPT's code response and extract files with their paths and code
 * IMPROVED with better error handling and multiple parsing strategies
 */
function parseCodeResponse(gptResponse, repoName = '') {
  console.log('\n🔍 ===== PARSING CODE RESPONSE =====');
  // Normalize line endings and prepare a working copy for recovery attempts
  let normalized = String(gptResponse || '');
  // Convert CRLF to LF
  normalized = normalized.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/\r/g, '\n');
  console.log(`📏 Response length: ${normalized.length || 0} characters`);
  
  // Validate input
  if (!gptResponse || typeof gptResponse !== 'string') {
    console.error('❌ GPT response is null or not a string!');
    throw new Error('Invalid GPT response: null or not a string');
  }
  
  if (gptResponse.length < 100) {
    console.error('❌ GPT response is too short (< 100 chars)!');
    console.log('Response:', gptResponse);
    throw new Error('GPT response too short - likely an error or empty response');
  }
  
  // Save full response to debug file
  try {
    const debugPath = './gpt-response-debug.txt';
    fs.writeFileSync(debugPath, gptResponse, 'utf8');
    console.log(`💾 Full response saved to: ${debugPath}`);
  } catch (err) {
    console.warn('⚠️ Could not save debug file:', err.message);
  }
  
  // Show preview
  console.log('\n📄 Response preview (first 800 chars):');
  console.log('─'.repeat(80));
  console.log(gptResponse.substring(0, 800));
  console.log('─'.repeat(80));
  console.log();

  // Immediately sanitize the GPT response to remove any HTML and normalize
  // into the expected markdown-style file blocks. This improves downstream
  // parsing robustness and guarantees blocks like:
  //
  // ### repo-name/path/to/file.ext
  // ```lang
  // <code>
  // ```
  /**
 * Extract plain text from HTML while preserving line breaks
 */
function extractTextFromHTML(html) {
  // Create a temporary DOM-like structure (works in Node.js)
  const text = html
    // First, convert <br> tags to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert closing tags of block elements to newlines
    .replace(/<\/(div|p|li|tr|h[1-6]|pre|code)>/gi, '\n')
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#96;|&grave;/g, '`')
    // Normalize excessive whitespace but preserve single newlines
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
  
  return text;
}

/**
 * Improved HTML to markdown conversion for ChatGPT responses
 */
function sanitizeAndNormalizeResponse(text, repoName) {
  let s = String(text || '');
  
  // Normalize newlines first
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  console.log('🔧 Starting HTML sanitization...');

  // Extract file blocks from ChatGPT's HTML structure
  // FIXED: Allow nested divs between <pre> and <code> tags using [\s\S]*? instead of .*?
  const fileBlockPattern = /<h3[^>]*>(.*?)<\/h3>\s*<pre[^>]*>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi;
  
  let match;
  const extractedBlocks = [];
  
  while ((match = fileBlockPattern.exec(s)) !== null) {
    const rawPath = match[1].trim();
    const rawCode = match[2];
    
    // Extract language from code tag class attribute
    const codeTagMatch = match[0].match(/<code[^>]*class="[^"]*language-(\w+)[^"]*"/i);
    const language = codeTagMatch?.[1] || '';
    
    // Extract clean path (remove HTML entities and tags)
    const cleanPath = extractTextFromHTML(rawPath);
    
    // Extract code content - remove button and UI elements first
    let codeContent = rawCode
      .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')  // Remove copy button
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');       // Remove SVG icons
    
    // Extract text while preserving structure
    codeContent = extractTextFromHTML(codeContent);
    
    if (cleanPath && codeContent && codeContent.length > 10) {
      extractedBlocks.push({
        path: cleanPath,
        code: codeContent,
        language: language || detectLanguage(cleanPath)
      });
      console.log(`  ✓ Extracted: ${cleanPath} (${codeContent.length} chars, lang: ${language || detectLanguage(cleanPath)})`);
    }
  }

  // If we successfully extracted blocks, convert to markdown format
  if (extractedBlocks.length > 0) {
    console.log(`✅ Extracted ${extractedBlocks.length} file blocks from HTML`);
    
    let markdown = '';
    for (const block of extractedBlocks) {
      // Ensure repo name prefix
      let path = block.path;
      if (repoName && !path.toLowerCase().startsWith(repoName.toLowerCase())) {
        path = `${repoName}/${path}`;
      }
      
      // Create proper markdown with proper backticks
      markdown += `### ${path}\n\`\`\`${block.language}\n${block.code}\n\`\`\`\n\n`;
    }
    
    return markdown.trim();
  }

  console.log('⚠️ No file blocks extracted from primary pattern, trying fallback...');
  
  // Fallback: Try to extract h3 + any code block structure
  const fallbackPattern = /<h3[^>]*>(.*?)<\/h3>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>/gi;
  let fallbackMatch;
  const fallbackBlocks = [];
  
  while ((fallbackMatch = fallbackPattern.exec(s)) !== null) {
    const rawPath = fallbackMatch[1].trim();
    const rawCode = fallbackMatch[2];
    
    const cleanPath = extractTextFromHTML(rawPath);
    let codeContent = rawCode
      .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
    codeContent = extractTextFromHTML(codeContent);
    
    if (cleanPath && codeContent && codeContent.length > 10) {
      fallbackBlocks.push({
        path: cleanPath,
        code: codeContent,
        language: detectLanguage(cleanPath)
      });
      console.log(`  ✓ Fallback extracted: ${cleanPath} (${codeContent.length} chars)`);
    }
  }
  
  if (fallbackBlocks.length > 0) {
    console.log(`✅ Fallback extracted ${fallbackBlocks.length} file blocks`);
    
    let markdown = '';
    for (const block of fallbackBlocks) {
      let path = block.path;
      if (repoName && !path.toLowerCase().startsWith(repoName.toLowerCase())) {
        path = `${repoName}/${path}`;
      }
      markdown += `### ${path}\n\`\`\`${block.language}\n${block.code}\n\`\`\`\n\n`;
    }
    
    return markdown.trim();
  }
  
  console.log('⚠️ All extraction methods failed, falling back to generic HTML cleanup...');
  
  // Last resort: Generic HTML cleanup
  s = s.replace(/<pre[^>]*>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/gi, (_, code) => {
    return '\n```\n' + extractTextFromHTML(code) + '\n```\n';
  });
  
  s = s.replace(/<h3[^>]*>(.*?)<\/h3>/gi, (_, heading) => {
    return '\n### ' + extractTextFromHTML(heading) + '\n';
  });
  
  // Remove remaining HTML
  s = extractTextFromHTML(s);
  
  // Normalize multiple blank lines
  s = s.replace(/\n{3,}/g, '\n\n');
  
  return s.trim();
}

/**
 * Detect language from file extension
 */
function detectLanguage(filepath) {
  const ext = filepath.split('.').pop().toLowerCase();
  const langMap = {
    'py': 'python',
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'jsx',
    'tsx': 'tsx',
    'json': 'json',
    'md': 'markdown',
    'txt': 'text',
    'sh': 'bash',
    'yml': 'yaml',
    'yaml': 'yaml',
    'html': 'html',
    'css': 'css',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'cs': 'csharp'
  };
  
  return langMap[ext] || '';
}

  // Apply sanitization early to improve parsing of HTML-wrapped responses
  try {
    normalized = sanitizeAndNormalizeResponse(normalized, repoName);
    console.log('\n🔁 Response sanitized to markdown-style blocks (HTML removed)');
    console.log('📄 Sanitized preview (first 800 chars):\n' + normalized.substring(0, 800));

    // Also output the FULL sanitized response so callers can inspect the HTML-stripped content
    try {
      console.log('\nFULL SANITIZED GPT RESPONSE START');
      console.log(normalized);
      console.log('FULL SANITIZED GPT RESPONSE END\n');

      // Save sanitized version to disk for easier debugging/inspection
      try {
        const sanitizedPath = './gpt-response-sanitized.txt';
        fs.writeFileSync(sanitizedPath, normalized, 'utf8');
        console.log('💾 Sanitized response saved to:', sanitizedPath);
      } catch (e) {
        console.warn('⚠️ Could not save sanitized response to disk:', e.message);
      }
    } catch (e) {
      console.warn('⚠️ Failed to log full sanitized response:', e.message);
    }
  } catch (e) {
    console.warn('⚠️ Sanitization step failed:', e.message);
  }
  
  // Count patterns in response (use normalized copy)
  console.log('🔍 Pattern analysis:');
  let tripleHashes = (normalized.match(/^###\s+/gm) || []).length;
  let codeFences = (normalized.match(/```/g) || []).length / 2;
  let fileExtensions = (normalized.match(/\.[a-zA-Z0-9]{2,10}/g) || []).length;

  // If nothing recognizable found, try common HTML-encoded or wrapped variants
  if (tripleHashes === 0 && codeFences === 0) {
    console.log('⚠️ No markdown markers found — attempting to recover from HTML/encoded response...');

    // Simple HTML entity decode for common entities
    function htmlDecode(str) {
      return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#96;|&grave;/g, '`');
    }

    // 1) Replace <pre><code> blocks with their inner text (decode entities)
    try {
      normalized = normalized.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, inner) => htmlDecode(inner));
      // 2) Replace standalone <pre>...</pre>
      normalized = normalized.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => htmlDecode(inner));
      // 3) Convert HTML headers (h1-h6) that contain paths into markdown '### ' headers
      normalized = normalized.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, inner) => {
        const txt = htmlDecode(inner).replace(/<[^>]*>/g, '').trim();
        return txt.startsWith('package') || txt.includes('/') || txt.includes('.') ? `### ${txt}\n` : `\n${txt}\n`;
      });
      // 4) Decode HTML entities globally
      normalized = htmlDecode(normalized);
    } catch (e) {
      console.warn('⚠️ HTML recovery attempt failed:', e.message);
    }

    // 5) Replace common escaped fence tokens (e.g., &#96;&#96;&#96;) with real backticks
    normalized = normalized.replace(/(&#96;\s*){3,}/g, '```');

    // Recompute counters after recovery
    tripleHashes = (normalized.match(/^###\s+/gm) || []).length;
    codeFences = (normalized.match(/```/g) || []).length / 2;
    fileExtensions = (normalized.match(/\.[a-zA-Z0-9]{2,10}/g) || []).length;

    console.log('🔁 Pattern analysis after recovery:');
    console.log(`  - Lines starting with ###: ${tripleHashes}`);
    console.log(`  - Code fence pairs: ${codeFences}`);
    console.log(`  - File extensions found: ${fileExtensions}`);
    console.log();
  } else {
    console.log(`  - Lines starting with ###: ${tripleHashes}`);
    console.log(`  - Code fence pairs: ${codeFences}`);
    console.log(`  - File extensions found: ${fileExtensions}`);
    console.log();
  }
  
  console.log(`  - Lines starting with ###: ${tripleHashes}`);
  console.log(`  - Code fence pairs: ${codeFences}`);
  console.log(`  - File extensions found: ${fileExtensions}`);
  console.log();
  
  if (tripleHashes === 0 && codeFences === 0) {
  console.warn('⚠️ No markdown markers found after recovery — attempting plain text fallback...');
  
  // Attempt to extract from comments or filename indicators
  const plainFiles = [];
  const plainRegex = /(\/\/|#)\s*(?:File|Path|Filename):\s*([^\n]+)\n([\s\S]*?)(?=(?:\/\/|#)\s*(?:File|Path|Filename)|$)/gi;
  let m;
  
  while ((m = plainRegex.exec(normalized)) !== null) {
    const filepath = m[2].trim();
    const code = m[3].trim();
    if (isValidFilePath(filepath) && code.length > 10) {
      plainFiles.push({ filepath, code, strategy: 'plain-comment-fallback' });
    }
  }

  if (plainFiles.length > 0) {
    console.log(`✅ Fallback: extracted ${plainFiles.length} plain code blocks`);
    return plainFiles;
  }

  // As absolute last resort, attempt a simple split by plain filepath lines
  // Many GPT responses provide: "path/to/file.ext" on its own line followed by the file contents.
  console.warn('⚠️ Fallback: attempting plain "path then content" split before raw dump');

  const linesAll = normalized.split(/\r?\n/);
  const candidates = [];
  let currentPath = null;
  let buffer = [];

  function pushCurrent() {
    if (currentPath && buffer.length > 0) {
      const cleanedPath = cleanFilePath(currentPath, repoName);
      const codeText = buffer.join('\n').trim();
      if (isValidFilePath(cleanedPath) && codeText.length > 10) {
        candidates.push({ filepath: cleanedPath, code: codeText, strategy: 'plain-path-split' });
      }
    }
  }

  for (let i = 0; i < linesAll.length; i++) {
    const raw = linesAll[i];
    const trimmed = raw.trim();

  // Heuristic: detect file-path-like lines.
  // - Has a filename extension (e.g., dir/file.ext)
  // - OR is a known bare filename (LICENSE, README, Makefile, requirements.txt)
  // - OR contains a slash (repo/path/to/file) even if no extension (to catch LICENSE under a folder)
  const hasExt = /^[\w\-\.\/@\\]+\.[A-Za-z0-9]{1,10}$/.test(trimmed);


const lastSegment = trimmed.split('/').pop() || '';
const isKnownBare = /^(LICENSE|NOTICE|CONTRIBUTING|CHANGELOG|README|Makefile|Dockerfile|COPYING|AUTHORS|requirements(?:\.txt)?|setup\.py|Gemfile|Rakefile|Procfile|\.gitignore|\.dockerignore|\.env(?:\.example)?)$/i.test(lastSegment);
const containsSlash = trimmed.includes('/') && /^[\w\-\.\/@\\]+$/.test(trimmed);
const looksLikePath = hasExt || isKnownBare || containsSlash;

    if (looksLikePath) {
      // start a new file block
      pushCurrent();
      currentPath = trimmed;
      buffer = [];
    } else {
      if (currentPath) buffer.push(raw);
    }
  }

  // push the last buffered file
  pushCurrent();

  if (candidates.length > 0) {
    console.log(`✅ Plain-split fallback produced ${candidates.length} file(s)`);
    return candidates;
  }

  // Still nothing useful — fall back to single-file dump
  console.warn('⚠️ Plain-split fallback produced no valid files — saving entire GPT output as single file');
  return [{
    filepath: `${repoName || 'project'}/main.txt`,
    code: normalized.trim(),
    strategy: 'raw-dump'
  }];
}

  
  // Extract all code blocks
  console.log('🔎 Extracting code blocks using 6 different strategies...');
  const blocks = extractCodeBlocks(normalized);
  
  console.log(`✅ Extracted ${blocks.length} raw blocks\n`);
  
  if (blocks.length === 0) {
    console.error('❌ NO CODE BLOCKS EXTRACTED!');
    console.log('\n💡 This usually means:');
    console.log('   1. GPT returned an error or explanation instead of code');
    console.log('   2. GPT used a completely different format');
    console.log('   3. The response was truncated\n');
    console.log('📄 Check gpt-response-debug.txt for the actual content.\n');
    
    throw new Error('No code blocks found in GPT response');
  }
  
  // Log extraction strategies used
  const strategies = {};
  blocks.forEach(b => {
    strategies[b.strategy] = (strategies[b.strategy] || 0) + 1;
  });
  
  console.log('📊 Blocks by extraction strategy:');
  Object.entries(strategies).forEach(([strategy, count]) => {
    console.log(`  - ${strategy}: ${count} blocks`);
  });
  console.log();
  
  // Clean and validate files
  console.log('🧹 Cleaning and validating files...');
  
  const files = [];
  const rejected = [];
  
  for (const block of blocks) {
    const filepath = cleanFilePath(block.filepath, repoName);
    const code = block.code;
    
    // Validate filepath
    if (!isValidFilePath(filepath)) {
      rejected.push({ 
        reason: 'invalid-path', 
        original: block.filepath,
        cleaned: filepath 
      });
      continue;
    }
    
    // Validate code content
    if (!code || code.length < 10) {
      rejected.push({ 
        reason: 'insufficient-content', 
        filepath: filepath,
        codeLength: code?.length || 0
      });
      continue;
    }
    
    // Check for placeholder content
    if (/^\s*\/\/.*TODO|placeholder|implement|your code here/i.test(code)) {
      console.log(`  ⚠️ Warning: ${filepath} appears to be a placeholder`);
    }
    
    files.push({ 
      filepath, 
      code, 
      strategy: block.strategy 
    });
  }
  
  console.log(`✅ Valid files: ${files.length}`);
  console.log(`❌ Rejected: ${rejected.length}\n`);
  
  // Show rejected files (limit to 10)
  if (rejected.length > 0) {
    console.log('❌ Rejected items:');
    rejected.slice(0, 10).forEach(r => {
      if (r.reason === 'invalid-path') {
        console.log(`  - ${r.reason}: "${r.original}" → "${r.cleaned}"`);
      } else {
        console.log(`  - ${r.reason}: ${r.filepath} (${r.codeLength} chars)`);
      }
    });
    
    if (rejected.length > 10) {
      console.log(`  ... and ${rejected.length - 10} more`);
    }
    console.log();
  }
  
  if (files.length === 0) {
    console.error('❌ NO VALID FILES AFTER CLEANING!');
    console.log(`📊 Stats: ${blocks.length} extracted → ${files.length} valid`);
    console.log('\n💡 All files were rejected during validation.');
    console.log('This might mean the filepaths are malformed or code is too short.\n');
    throw new Error('No valid files could be extracted from GPT response');
  }
  
  // Deduplicate
  console.log('🔄 Removing duplicates...');
  const uniqueFiles = deduplicateFiles(files);
  console.log(`✅ Unique files: ${uniqueFiles.length}\n`);
  
  // Show final file list
  if (uniqueFiles.length > 0) {
    console.log('📁 Final file list:');
    uniqueFiles.slice(0, 20).forEach((f, i) => {
      const size = f.code.length;
      const sizeStr = size > 1000 ? `${(size / 1000).toFixed(1)}KB` : `${size}B`;
      console.log(`  ${(i + 1).toString().padStart(2)}. ${f.filepath.padEnd(50)} ${sizeStr.padStart(8)} [${f.strategy}]`);
    });
    
    if (uniqueFiles.length > 20) {
      console.log(`  ... and ${uniqueFiles.length - 20} more files`);
    }
  }
  
  console.log('\n===================================\n');
  
  return uniqueFiles;
}
function extractCodeBlocks(response) {
  const blocks = [];

  // NEW: Pattern for format without code fences: "filepath\nlanguage<code>"
  // Example: "vimeo-video-downloader-scraper/src/main.py\npy#!/usr/bin/env python3..."
  console.log('🔍 Trying pattern 1: filepath with language tag (no backticks)...');
  
  // Split by lines and look for file paths
  const lines = response.split('\n');
  let currentFile = null;
  let currentLang = null;
  let currentCode = [];
  let inFile = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Check if this line looks like a file path (has extension and forward slashes)
    // Must be on its own line and match common file patterns
    const filePathMatch = line.match(/^([a-zA-Z0-9][a-zA-Z0-9\-_]*\/[^\s]+\.(?:py|js|jsx|ts|tsx|json|md|txt|yml|yaml|xml|html|css|sh|go|rb|java|cs|php|rs|toml|cfg|ini|lock))$/);
    
    if (filePathMatch && trimmedLine === line) {
      // Save previous file if exists
      if (currentFile && currentCode.length > 0) {
        const code = currentCode.join('\n').trim();
        if (code.length > 10) {
          blocks.push({
            filepath: currentFile,
            code: code,
            strategy: 'no-fence-line-by-line',
            language: currentLang || 'text'
          });
          console.log(`  ✓ Found: ${currentFile} (${currentLang || 'text'}, ${code.length} chars)`);
        }
      }
      
      // Start new file
      currentFile = filePathMatch[1].trim();
      currentCode = [];
      currentLang = null;
      inFile = true;
      
      // Next line might be the language tag attached to code
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        // Check if it starts with a language code (2-6 lowercase letters)
        const langMatch = nextLine.match(/^([a-z]{2,6})([\s\S]*)$/);
        if (langMatch) {
          currentLang = langMatch[1];
          // The rest of the line is code
          const codeRest = langMatch[2];
          if (codeRest) {
            currentCode.push(codeRest);
          }
          i++; // Skip the next line since we processed it
          continue;
        }
      }
    } else if (inFile) {
      // Accumulate code for current file
      // Stop if we hit multiple blank lines (indicates file separation)
      if (trimmedLine === '' && i + 1 < lines.length && lines[i + 1].trim() === '') {
        // Two blank lines - might be end of file
        continue;
      }
      currentCode.push(line);
    }
  }
  
  // Don't forget the last file
  if (currentFile && currentCode.length > 0) {
    const code = currentCode.join('\n').trim();
    if (code.length > 10) {
      blocks.push({
        filepath: currentFile,
        code: code,
        strategy: 'no-fence-line-by-line',
        language: currentLang || 'text'
      });
      console.log(`  ✓ Found: ${currentFile} (${currentLang || 'text'}, ${code.length} chars)`);
    }
  }

  if (blocks.length > 0) {
    console.log(`✅ Extracted ${blocks.length} blocks using no-fence line-by-line pattern`);
    return deduplicateBlocks(blocks);
  }

  // Primary pattern: ### filepath followed by ```language code block
  console.log('🔍 Trying pattern 2: markdown ### filepath with backticks...');
  const primaryPattern = /###\s+([^\n]+?)\s*\n```([^\n]*)\n([\s\S]*?)```/gi;
  
  let match;
  while ((match = primaryPattern.exec(response)) !== null) {
    const filepath = match[1].trim();
    const language = match[2].trim();
    const code = match[3].trim();
    
    if (filepath && code && code.length > 10) {
      blocks.push({
        filepath: filepath,
        code: code,
        strategy: 'markdown-primary',
        language: language
      });
    }
  }

  // If primary pattern found blocks, use those
  if (blocks.length > 0) {
    console.log(`✅ Extracted ${blocks.length} blocks using markdown pattern`);
    return deduplicateBlocks(blocks);
  }

  console.log('⚠️ Primary patterns failed, trying alternative patterns...');

  // Fallback patterns (existing patterns from original code)
  const patterns = [
    { re: /###\s+([^\n]+?)\s*\n```[^\n]*\n([\s\S]*?)\n```/gmi, name: 'header-fence' },
    { re: /^([\w\-\.\/@\\]+\.[a-zA-Z0-9]{1,10})\s*\n```[^\n]*\n([\s\S]*?)\n```/gim, name: 'path-before-fence' },
    { re: /\*\*(?:File|Path|Filename):\s*`?([^`\n*]+?)`?\*\*\s*\n```[^\n]*\n([\s\S]*?)\n```/gmi, name: 'bold-file' },
    { re: /```[^\n]*\n(?:\/\/|#)\s*(?:File|Path|Filename):\s*([^\n]+)\n([\s\S]*?)\n```/gmi, name: 'fence-with-comment' },
  ];

  for (const p of patterns) {
    let m = null;
    while ((m = p.re.exec(response)) !== null) {
      const rawPath = (m[1] || '').trim();
      const code = (m[2] || '').replace(/\r/g, '').trim();
      if (!rawPath || !code || code.length < 10) continue;
      blocks.push({ filepath: rawPath, code, strategy: p.name });
    }
  }

  return deduplicateBlocks(blocks);
}

/**
 * Deduplicate blocks, keeping the longest code for each filepath
 */
function deduplicateBlocks(blocks) {
  const byPath = new Map();
  
  for (const b of blocks) {
    const key = (b.filepath || '').toString().trim().replace(/^\/+/, '').toLowerCase();
    if (!key) continue;
    
    const existing = byPath.get(key);
    if (!existing || b.code.length > existing.code.length) {
      byPath.set(key, b);
    }
  }

  const result = Array.from(byPath.values());
  
  console.log(`\n📊 Deduplication: ${blocks.length} → ${result.length} unique files`);
  
  return result;
}

/**
 * Clean and normalize filepath
 */
function cleanFilePath(filepath, repoName = '') {
  let cleaned = filepath.trim();
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/^["'`*]+|["'`*]+$/g, '');
  
  // Convert backslashes to forward slashes
  cleaned = cleaned.replace(/\\/g, '/');
  
  // Remove repo name prefix if present
  if (repoName) {
    const patterns = [
      new RegExp(`^${repoName}/`, 'i'),
      new RegExp(`^${repoName}\\\\`, 'i'),
      new RegExp(`^.*/${repoName}/`, 'i')
    ];
    
    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, '');
    }
  }
  
  // Remove leading slashes
  cleaned = cleaned.replace(/^\/+/, '');
  
  // Remove any remaining whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Method 1: Extract ### filepath format
 * IMPROVED with better validation
 */
function extractTripleHashFormat(response) {
  const files = [];
  const sections = response.split(/^###\s+/gm);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split('\n');
    let filepath = lines[0].trim();
    
    // Skip if not a valid file path
    if (!isValidFilePath(filepath)) {
      console.log(`  ⚠️ Skipping invalid path: "${filepath}"`);
      continue;
    }
    
    // Get code (everything after the first line)
    let code = lines.slice(1).join('\n').trim();
    
    // Remove markdown code blocks if present
    code = code.replace(/^```[\w]*\n?/gm, '');
    code = code.replace(/\n?```$/gm, '');
    code = code.trim();
    
    // Must have substantial code
    if (code && code.length > 10) {
      files.push({ filepath, code });
    }
  }
  
  return files;
}

/**
 * Method 2: Extract code blocks with file paths
 * IMPROVED patterns
 */
function extractCodeBlocksWithPaths(response) {
  const files = [];
  
  // Pattern 1: File path on line before code block
  const pattern1 = /^([^\n]+\.[a-zA-Z0-9]{2,10})\s*\n```[\w]*\n([\s\S]*?)```/gm;
  let match;
  
  while ((match = pattern1.exec(response)) !== null) {
    const filepath = match[1].trim();
    const code = match[2].trim();
    
    if (isValidFilePath(filepath) && code.length > 10) {
      files.push({ filepath, code });
    }
  }
  
  // Pattern 2: Comment inside code block with filename
  const pattern2 = /```[\w]*\n(?:\/\/|#)\s*(?:File|file|Path|path|Filename|filename):\s*([^\n]+)\n([\s\S]*?)```/gi;
  while ((match = pattern2.exec(response)) !== null) {
    const filepath = match[1].trim();
    const code = match[2].trim();
    
    if (isValidFilePath(filepath) && code.length > 10) {
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
    
    if (isValidFilePath(filepath) && code.length > 10) {
      files.push({ filepath, code });
    }
  }
  
  return files;
}

/**
 * Fallback parser - IMPROVED with better validation
 */
function fallbackExtractSections(response) {
  const files = [];
  if (!response || typeof response !== 'string') return files;

  // Look for ### followed by file path
  const sectionRegex = /###\s+([^\n]+)\n([\s\S]*?)(?=(?:\n###\s+)|$)/g;
  let m;
  
  while ((m = sectionRegex.exec(response)) !== null) {
    const filepath = m[1].trim();
    let code = m[2].trim();
    
    // Skip if not valid
    if (!isValidFilePath(filepath)) continue;
    
    // Strip code fences
    code = code.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
    
    if (code.length > 10) {
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
    const normalizedPath = file.filepath.toLowerCase().replace(/\\/g, '/');
    
    if (!fileMap.has(normalizedPath)) {
      fileMap.set(normalizedPath, file);
    } else {
      const existing = fileMap.get(normalizedPath);
      if (file.code.length > existing.code.length) {
        console.log(`  🔄 Replacing ${normalizedPath} with longer version (${existing.code.length} → ${file.code.length} chars)`);
        fileMap.set(normalizedPath, file);
      }
    }
  }
  
  return Array.from(fileMap.values());
}

/**
 * Validate files - STRENGTHENED
 */
function validateFiles(files) {
  return files.filter(file => {
    // Must have filepath
    if (!file.filepath || typeof file.filepath !== 'string') {
      console.warn('  ⚠️ Skipping: missing filepath');
      return false;
    }
    
    // Must pass validation
    if (!isValidFilePath(file.filepath)) {
      console.warn(`  ⚠️ Skipping invalid filepath: "${file.filepath}"`);
      return false;
    }
    
    // Must have code
    if (!file.code || typeof file.code !== 'string' || file.code.length < 10) {
      console.warn(`  ⚠️ Skipping ${file.filepath}: no valid content`);
      return false;
    }
    
    return true;
  });
}

/**
 * Parse directory structure to allowed paths - NULL SAFE
 */
function parseDirectoryStructureToPaths(directoryStructure, repoName) {
  console.log('📂 Parsing directory structure to paths...');
  
  // NULL SAFE: Handle null/undefined directory structure
  if (!directoryStructure || typeof directoryStructure !== 'string') {
    console.warn('⚠️ Directory structure is null or invalid, skipping filtering');
    return new Set();
  }
  
  const paths = new Set();
  const lines = directoryStructure.split('\n');
  
  for (const line of lines) {
    // Remove tree characters
    const cleaned = line
      .replace(/[│├└─\s]/g, '')
      .replace(/^[├└│─\s]+/, '')
      .trim();
    
    if (!cleaned || cleaned.length === 0) continue;
    
    // Check if it's a file (has extension)
    if (/\.[a-zA-Z0-9]{1,10}$/.test(cleaned)) {
      paths.add(cleaned.toLowerCase());
      paths.add(cleaned.toLowerCase().replace(/^\/+/, ''));
    }
  }
  
  console.log(`✅ Extracted ${paths.size} file paths from directory structure\n`);
  return paths;
}

/**
 * Clean file path - IMPROVED
 */


/**
 * Push a single file to GitHub (creates directories automatically)
 */
async function pushFileToGitHub({ owner, repo, filepath, content, token, logFn = console.log }) {
  logFn(`📤 Pushing: ${filepath}`);
  
  try {
    const authToken = token || process.env.GITHUB_TOKEN;
    
    if (!authToken) {
      throw new Error('GitHub token not provided');
    }
    
    // GitHub API automatically creates directories when pushing files with paths
    // Convert content to base64
    const b64Content = Buffer.from(content, 'utf-8').toString('base64');
    
    const data = {
      message: `feat: add ${filepath}`,
      content: b64Content
    };
    
    const config = {
      method: 'put',
      url: `https://api.github.com/repos/${owner}/${repo}/contents/${filepath}`,
      headers: { 
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(data)
    };
    
    await axios.request(config);
    logFn(`  ✅ Pushed successfully`);
    
    return { success: true, filepath };
    
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    logFn(`  ❌ Failed: ${errorMsg}`);
    
    return { 
      success: false, 
      filepath, 
      error: errorMsg 
    };
  }
}

/**
 * Push all files to GitHub with rate limiting and progress tracking
 */
async function pushAllFilesToGitHub({ owner, repo, files, token, logFn = console.log }) {
  logFn(`\n📦 ===== PUSHING ${files.length} FILES TO GITHUB =====`);
  logFn(`👤 Owner: ${owner}`);
  logFn(`📦 Repository: ${repo}`);
  logFn(`📁 Total files: ${files.length}\n`);
  
  const results = [];
  const delayMs = 1200; // 1.2 seconds delay to avoid rate limiting
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    logFn(`\n[${i + 1}/${files.length}] Processing: ${file.filepath}`);
    logFn(`  📏 Size: ${file.code.length} characters`);
    
    const result = await pushFileToGitHub({
      owner,
      repo,
      filepath: file.filepath,
      content: file.code,
      token,
      logFn
    });
    
    results.push(result);
    
    // Add delay between requests (except for last file)
    if (i < files.length - 1) {
      logFn(`  ⏳ Waiting ${delayMs}ms before next file...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  logFn(`\n📊 ===== PUSH SUMMARY =====`);
  logFn(`✅ Successful: ${successful}/${files.length}`);
  logFn(`❌ Failed: ${failed}/${files.length}`);
  
  if (failed > 0) {
    logFn('\n❌ Failed files:');
    results.filter(r => !r.success).forEach(r => {
      logFn(`  - ${r.filepath}: ${r.error}`);
    });
  } else {
    logFn('🎉 All files pushed successfully!');
  }
  
  logFn(`==========================\n`);
  
  return {
    total: files.length,
    successful,
    failed,
    results
  };
}

/**
 * Helper: Clean file path (remove repo name prefix and normalize)
 */
// function cleanFilePath(filepath, repoName) {
//   // Remove repo name prefix if it exists
//   const pattern = new RegExp(`^${repoName}/`, 'i');
//   let cleaned = filepath.replace(pattern, '');
  
//   // Remove leading slashes
//   cleaned = cleaned.replace(/^\/+/, '');
  
//   // Normalize path separators
//   cleaned = cleaned.replace(/\\/g, '/');
  
//   return cleaned;
// }

/**
 * Main function: Complete code generation and push workflow
 * This is kept for backward compatibility but the workflow should use individual functions
 */
async function generateAndPushCode({ repoData, owner, githubToken, logFn = console.log }) {
  logFn('\n🚀 ===== STARTING CODE GENERATION & PUSH =====');
  logFn(`📦 Repository: ${repoData.repo_name}`);
  logFn(`👤 Owner: ${owner}`);
  
  try {
    // Step 1: Build the prompt
    logFn('\n📝 Step 1: Building code generation prompt...');
    const prompt = buildCodeGenerationPrompt(repoData);
    
    // Step 2: Generate code with ChatGPT
    logFn('\n🤖 Step 2: Generating code with ChatGPT...');
    const gptResponse = await generateCodeWithGPT(prompt, logFn);
    
    // Step 3: Parse the response
    logFn('\n🔍 Step 3: Parsing code files from response...');
    const files = parseCodeResponse(gptResponse);
    
    if (files.length === 0) {
      throw new Error('No files extracted from GPT response');
    }
    
    // Step 4: Clean file paths
    logFn('\n🧹 Step 4: Cleaning file paths...');
    const cleanedFiles = files.map(file => ({
      ...file,
      filepath: cleanFilePath(file.filepath, repoData.repo_name)
    }));
    
    // Step 5: Push files to GitHub
    logFn('\n📤 Step 5: Pushing files to GitHub...');
    const pushResults = await pushAllFilesToGitHub({
      owner,
      repo: repoData.repo_name,
      files: cleanedFiles,
      token: githubToken,
      logFn
    });
    
    logFn('\n✅ ===== CODE GENERATION & PUSH COMPLETE =====');
    logFn(`📦 Repository: https://github.com/${owner}/${repoData.repo_name}`);
    logFn(`📁 Files pushed: ${pushResults.successful}/${pushResults.total}`);
    logFn('=============================================\n');
    
    return {
      success: true,
      filesGenerated: files.length,
      filesPushed: pushResults.successful,
      filesFailed: pushResults.failed,
      repository: `https://github.com/${owner}/${repoData.repo_name}`,
      results: pushResults.results
    };
    
  } catch (error) {
    logFn('\n❌ ===== CODE GENERATION & PUSH FAILED =====');
    logFn(`Error: ${error.message}`);
    logFn('===========================================\n');
    throw error;
  }
}

export {
  extractDirectoryStructure,
  buildCodeGenerationPrompt,
  generateCodeWithGPT,
  parseCodeResponse,
  pushFileToGitHub,
  pushAllFilesToGitHub,
  generateAndPushCode,
  cleanFilePath,
  isValidFilePath
};