import EventEmitter from 'node:events';
import { storage } from './storage.js';
import { askChatGPTForRepoMetadata } from './chatgptScraper.js';
import { scrapeMultipleApifyActors } from './ApifyScraper.js';
import { completeWorkflow } from './completeworkflow.js'; // ⭐ FIXED: Import from correct file
import { processVACampaign } from './vaPromptGenerator.js';
import { sendPromptInSeparateChat, cleanupReadme } from './apifyToGPTProcessor.js';

// GitHub flows were removed per project rules.
const removedGitHubFlow = async () => {
  throw new Error('GitHub functionality has been removed from this module.');
};
const createRepository = removedGitHubFlow;
const updateReadme = removedGitHubFlow;
const addTopics = removedGitHubFlow;
const createIssues = removedGitHubFlow;

class CampaignManager extends EventEmitter {
  constructor() {
    super();
    this.running = new Map();
    console.log('CampaignManager initialized');
  }

  log(campaignId, level, message) {
    const evt = { campaignId, level, message, timestamp: Date.now() };
    storage.appendLog(campaignId, evt);
    this.emit('log', evt);
    
    const emoji = {
      info: '[info]',
      success: '[success]',
      error: '[error]',
      warning: '[warning]'
    }[level] || '[log]';

    console.log(`${emoji} [${campaignId}] ${message}`);
  }

  setStatus(campaignId, status, failureReason = null) {
    console.log(`Setting campaign ${campaignId} status to: ${status}`);
    const update = { status };
    if (failureReason) update.failure_reason = failureReason;
    storage.updateCampaign(campaignId, update);
    this.emit('status', { campaignId, status, failureReason });
  }

  updateProgress(campaignId, processed, total) {
    const progress = { processed, total };
    console.log(`Progress update: ${processed}/${total}`);
    storage.updateCampaign(campaignId, { progress });
    this.emit('progress', { campaignId, ...progress });
  }

  parseKeywords(keywordsText) {
    if (!keywordsText) return [];
    return keywordsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  parseUrls(urlsText) {
    if (!urlsText) return [];
    return urlsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
  }

  parseQuestionsAndAnswers(questionsText) {
    if (!questionsText) return [];
    
    const lines = questionsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const questionsWithAnswers = [];
    for (let i = 0; i < lines.length; i += 2) {
      if (lines[i]) {
        questionsWithAnswers.push({
          question: lines[i],
          answer: lines[i + 1] || ''
        });
      }
    }
    
    return questionsWithAnswers;
  }

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

  parseVAResponse(gptResponse, fallbackName = 'va-automation-repo') {
    console.log('🔍 Parsing VA response from ChatGPT...');
    console.log(`Response length: ${gptResponse.length} characters`);
    
    let repoName = '';
    let description = '';
    let topics = [];
    let readme = '';
    
    try {
      // ===== STEP 1: Extract metadata block (similar to Apify flow) =====
      console.log('\n🔍 Step 1: Extracting metadata...');
      
      // Multiple patterns to catch metadata robustly
      const metadataPatterns = [
        // Pattern 1: Code block with pgsql/sql identifier
        /```(?:pgsql|sql|text|yaml|yml|json)?\s*\n((?:Repo Name|Description|Related Topics):[\s\S]*?)\n```/i,
        
        // Pattern 2: Plain text metadata at start (no code block)
        /^((?:Repo Name|Description|Related Topics):[\s\S]*?)(?=\n\n|```|#)/im,
        
        // Pattern 3: Metadata after language identifier
        /^(?:pgsql|sql|text|yaml|yml|json)\s*\n((?:Repo Name|Description|Related Topics):[\s\S]*?)(?=\n\n|```|#)/im,
      ];
      
      let metadataBlock = null;
      let metadataEndIndex = 0;
      
      for (const pattern of metadataPatterns) {
        const match = gptResponse.match(pattern);
        if (match) {
          metadataBlock = match[1] || match[0];
          metadataEndIndex = match.index + match[0].length;
          console.log('✅ Found metadata block');
          console.log('Metadata preview:', metadataBlock.substring(0, 200));
          break;
        }
      }
      
      if (metadataBlock) {
        // Extract individual fields with better patterns
        const repoMatch = metadataBlock.match(/Repo Name:\s*([^\n]+)/i);
        const descMatch = metadataBlock.match(/Description:\s*([^\n]+)/i);
        
        // Use comprehensive topic extraction
        topics = this.extractTopicsFromMetadata(metadataBlock);
        
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
        }
      } else {
        console.log('⚠️  No metadata block found, will use fallbacks');
      }
      
      // ===== STEP 2: Extract README =====
      console.log('\n📄 Step 2: Extracting README...');
      
      // Get everything after metadata
      let remainingContent = metadataEndIndex > 0 
        ? gptResponse.substring(metadataEndIndex)
        : gptResponse;
      
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
      
      // ===== STEP 3: Clean README (same as Apify flow) =====
      console.log('\n🧹 Step 3: Cleaning README...');
      readme = cleanupReadme(readme);
      console.log(`✅ README cleaned (${readme.length} chars)`);
      
      // ===== STEP 4: Validate and use fallbacks =====
      console.log('\n✓ Step 4: Validating data...');
      
      // Try additional robust extraction methods for repo name before falling back
      if (!repoName) {
        // Try to find an inline "Repo Name:" anywhere in the response
        const inlineRepo = gptResponse.match(/Repo Name:\s*([^\n]+)/i);
        if (inlineRepo) {
          repoName = inlineRepo[1].trim();
          console.log(`  📦 Repo Name (inline match): "${repoName}"`);
        }
      }
      
      if (!repoName) {
        // Try to extract from directory structure (e.g., "upcheck-monitor-scraper/")
        const dirMatch = gptResponse.match(/^\s*([a-z0-9._-]{3,})\/\s*$/im);
        if (dirMatch && !/^(src|data|docs|tests|lib|app|dist|build)$/i.test(dirMatch[1])) {
          repoName = dirMatch[1];
          console.log(`  📦 Repo Name (from directory): "${repoName}"`);
        }
      }
      
      if (!repoName) {
        // Try to extract from # Title in README
        const titleMatch = readme.match(/^#\s+(.+)/m);
        if (titleMatch) {
          repoName = titleMatch[1].trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-');
          console.log(`  📦 Repo Name (from README title): "${repoName}"`);
        }
      }
      
      // Final fallback
      if (!repoName) {
        repoName = fallbackName;
        console.log(`  📦 Repo Name (using fallback): "${repoName}"`);
      }
      
      // Sanitize repo name (GitHub requirements)
      repoName = repoName
        .toLowerCase()
        .replace(/[^a-z0-9-_.]/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '')
        .replace(/[-_.]{2,}/g, '-')
        .substring(0, 100);
      
      // Use fallback for description if empty
      if (!description) {
        description = 'Android automation repository';
        console.log(`  📝 Description (using fallback): "${description}"`);
      }
      
      console.log('\n✅ Parsed VA response:');
      console.log(`  - Repo Name: ${repoName}`);
      console.log(`  - Description: ${description}`);
      console.log(`  - Topics: ${topics.length}`);
      console.log(`  - README length: ${readme.length} chars`);
      
      return {
        repo_name: repoName,
        description,
        topics,
        readme,
        about: description
      };
      
    } catch (error) {
      console.error('❌ Error parsing VA response:', error);
      // Return fallback values
      return {
        repo_name: fallbackName,
        description: 'Android automation repository',
        topics: [],
        readme: gptResponse,
        about: 'Android automation repository'
      };
    }
  }

  async getBestAccountFromGroup(accountGroupId, campaignId) {
  this.log(campaignId, 'info', `Selecting account from group: ${accountGroupId}`);
  
  console.log('🔍 DEBUG: Querying accounts with groupId:', accountGroupId);
  console.log('🔍 DEBUG: Type of accountGroupId:', typeof accountGroupId);
  
  const accounts = await storage.getGithubAccounts(accountGroupId);
  
  console.log('🔍 DEBUG: Accounts returned:', accounts ? accounts.length : 0);
  
  if (!accounts || accounts.length === 0) {
    throw new Error(`No accounts found in the selected group (Group ID: ${accountGroupId})`);
  }
  
  // Filter accounts that have less than 15 repos
  const activeAccounts = accounts.filter(acc => (acc.repoCount || 0) < 15);
  
  if (activeAccounts.length === 0) {
    const totalAccounts = accounts.length;
    const fullAccounts = accounts.filter(acc => (acc.repoCount || 0) >= 15).length;
    
    this.log(campaignId, 'error', `⚠️ All accounts exhausted! ${fullAccounts}/${totalAccounts} accounts have reached the 15 repo limit.`);
    this.log(campaignId, 'error', '⏸️ Campaign paused. Please add more accounts to the group to continue.');
    
    // Pause the campaign
    this.setStatus(campaignId, 'Paused');
    this.running.delete(campaignId);
    
    throw new Error(`All ${totalAccounts} accounts in the group have reached the 15 repo limit. Campaign paused. Please add more accounts to continue.`);
  }
  
  // Sort by least recently used
  activeAccounts.sort((a, b) => {
    if (!a.lastUsed) return -1;
    if (!b.lastUsed) return 1;
    return new Date(a.lastUsed) - new Date(b.lastUsed);
  });
  
  const selectedAccount = activeAccounts[0];
  const availableSlots = 15 - (selectedAccount.repoCount || 0);
  
  this.log(campaignId, 'info', `✅ Selected account: ${selectedAccount.username} (${selectedAccount.repoCount || 0}/15 repos, ${availableSlots} slots remaining)`);
  this.log(campaignId, 'info', `   Available accounts: ${activeAccounts.length}/${accounts.length}`);
  
  // Log proxy info if assigned
  if (selectedAccount.assignedProxy) {
    this.log(campaignId, 'info', `  🔒 Account has assigned proxy (session: ${selectedAccount.proxySessionId?.substring(0, 12)}...)`);
  }
  
  return selectedAccount;
}
async getAccountProxyInfo(accountId) {
  const account = await storage.getGithubAccountWithProxy(accountId);
  
  return {
    proxyUrl: account.assignedProxy || null,
    sessionId: account.proxySessionId || null
  };
}

  async updateAccountUsage(accountId) {
    const account = await storage.getGithubAccountById(accountId);
    if (!account) return;
    
    await storage.updateGithubAccount(accountId, {
      lastUsed: new Date().toISOString(),
      repoCount: (account.repoCount || 0) + 1,
      status: (account.repoCount || 0) + 1 >= 15 ? 'disabled' : 'active'
    });
  }

  async startCampaign(id) {
    console.log('\n===== STARTING CAMPAIGN =====');
    console.log('Campaign ID:', id);
    
    if (this.running.get(id)) {
      console.log('Campaign is already running');
      this.log(id, 'warning', 'Campaign is already running');
      return;
    }

    this.running.set(id, true);
    this.setStatus(id, 'Running');

    const campaign = await storage.getCampaign(id);

    if (!campaign) {
      console.error('Campaign not found:', id);
      this.log(id, 'error', 'Campaign not found');
      this.setStatus(id, 'Failed');
      this.running.delete(id);
      return;
    }

    console.log('Campaign found:', campaign.name);
    console.log('Category:', campaign.category);
    console.log('Account Group:', campaign.accountGroupId);

    try {
      // Validate account group
      if (!campaign.accountGroupId) {
        throw new Error('No account group selected for this campaign');
      }
      
      let items = [];
      let metadataList = [];
      
      // Process based on category
      if (campaign.category === 'apify') {
        // ========== APIFY FLOW: USE INTEGRATED WORKFLOW ==========
        const urls = this.parseUrls(campaign.apifyUrls);
        
        if (!urls || urls.length === 0) {
          throw new Error('No valid Apify URLs provided');
        }
        
        this.log(id, 'info', `Starting Apify campaign for ${urls.length} URL(s)`);
        this.updateProgress(id, 0, urls.length);
        
        const results = [];
        
        // ⭐ NEW: Process each URL with complete integrated workflow
        for (let i = 0; i < urls.length; i++) {
          if (!this.running.get(id)) {
            this.log(id, 'info', 'Campaign stopped by user');
            break;
          }
          
          const url = urls[i];
          this.log(id, 'info', `\n📍 Processing URL ${i + 1}/${urls.length}: ${url}`);
          
          try {
            // Step 1: Scrape this URL
            this.log(id, 'info', '📥 Scraping Apify actor page...');
            const { results: scrapeResults } = await scrapeMultipleApifyActors(
              [url],
              (msg) => this.log(id, 'info', msg)
            );
            
            if (scrapeResults[0].status !== 'success' || !scrapeResults[0].data) {
              throw new Error('Failed to scrape URL');
            }
            
            const scrapedData = scrapeResults[0].data;
            this.log(id, 'success', '✅ Scraping successful');
            
            // ⭐ Step 2: Get account for this repo
            const account = await this.getBestAccountFromGroup(campaign.accountGroupId, id);
            const token = await storage.getGithubAccountToken(account.id);
            
            
            // ⭐ Step 3: Run COMPLETE workflow (README + Code Generation + Push)
            this.log(id, 'info', `🚀 Running complete workflow (using ${account.username})`);
            this.log(id, 'info', '   This includes: README generation, repo creation, and code generation');
            
            // Get GPT account cookies
            let gptCookies = null;
            if (campaign.gptAccountId) {
              const gptAccount = await storage.getGPTAccount(campaign.gptAccountId);
              if (gptAccount && gptAccount.cookies) {
                gptCookies = gptAccount.cookies;
                this.log(id, 'info', `Using GPT account: ${gptAccount.name}`);
              }
            }
            
            const workflowResult = await completeWorkflow({
              scrapedData,
              githubToken: token,
              cookies: gptCookies, // Pass GPT account cookies
              logFn: (msg) => this.log(id, 'info', msg),
              vaPlatform: 'bitbash' // Apify campaigns always use BitBash branding

            });
            
            // Update account usage
            await this.updateAccountUsage(account.id);
            
            results.push({
              item: url,
              status: 'success',
              repoUrl: workflowResult.url,
              repoName: workflowResult.repoData.repo_name,
              repoDescription: workflowResult.repoData.description || workflowResult.repoData.about || '',
              account: account.username,
              filesGenerated: workflowResult.filesGenerated || 0,
              filesPushed: workflowResult.filesPushed || 0,
              codeGenerated: workflowResult.codeGenerated || false
            });
            
            this.log(id, 'success', `✅ Successfully created: ${workflowResult.url}`);
            if (workflowResult.filesPushed > 0) {
              this.log(id, 'success', `   💻 Code files pushed: ${workflowResult.filesPushed}`);
            }
            
          } catch (error) {
            console.error('Failed to process URL:', error.message);
            this.log(id, 'error', `Failed to process "${url}": ${error.message}`);
            
            results.push({
              item: url,
              status: 'failed',
              error: error.message
            });
          }
          
          // Update progress
          this.updateProgress(id, i + 1, urls.length);
          
          // Add delay between iterations
          if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // Save results
        await storage.updateCampaign(id, { results });
        
        const successCount = results.filter(r => r.status === 'success').length;
        const failCount = results.filter(r => r.status === 'failed').length;
        
        console.log('\n===== CAMPAIGN COMPLETED =====');
        console.log('Successful:', successCount);
        console.log('Failed:', failCount);
        
        if (successCount === 0) {
          this.log(id, 'error', `Campaign failed: All ${failCount} attempt(s) failed`);
          this.setStatus(id, 'Failed');
        } else {
          this.log(id, 'success', `Campaign completed: ${successCount} succeeded, ${failCount} failed`);
          this.setStatus(id, 'Completed');
        }
        
        this.running.delete(id);
        console.log('Campaign execution finished');
        return;
        
      } else if (campaign.category === 'va') {
        // ========== VA CAMPAIGN FLOW: Android Automation Repositories ==========
        this.log(id, 'info', '🤖 Starting VA Campaign...');
        
        // Get platform first
        const vaPlatform = campaign.vaPlatform || 'bitbash';
        
        this.log(id, 'info', `Platform: ${vaPlatform}`);
        this.log(id, 'info', `Repo Type: ${campaign.vaRepoType}`);
        
        // Validate VA campaign data
        const descriptions = campaign.vaRepoType === 'single' 
          ? campaign.vaSingleRepoDescriptions 
          : campaign.vaMultipleRepoDescriptions;
        
        if (!descriptions || !descriptions.trim()) {
          throw new Error(`VA campaign descriptions are required for ${campaign.vaRepoType} repo type`);
        }
        
        this.log(id, 'info', `Descriptions length: ${descriptions.length} characters`);
        
        // Generate prompts based on VA repo type
        const vaPrompts = processVACampaign(
          campaign.vaRepoType,
          descriptions,
          vaPlatform
        );
        
        this.log(id, 'info', `Generated ${vaPrompts.length} prompt(s) for VA campaign`);
        this.updateProgress(id, 0, vaPrompts.length);
        
        const results = [];
        
        // Get selected account and token
        const selectedAccount = await this.getBestAccountFromGroup(campaign.accountGroupId, id);
        const githubToken = await storage.getGithubAccountToken(selectedAccount.id);
        
        if (!githubToken) {
          throw new Error(`No GitHub token found for account: ${selectedAccount.username}`);
        }
        
        this.log(id, 'info', `Using GitHub account: ${selectedAccount.username}`);
        
        // Process each VA prompt
        for (let i = 0; i < vaPrompts.length; i++) {
          if (!this.running.get(id)) {
            this.log(id, 'info', 'Campaign stopped by user');
            break;
          }
          
          const vaPrompt = vaPrompts[i];
          const keyword = vaPrompt.keyword || 'android-automation';
          const fallbackRepoName = keyword
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 100) + '-repo';
          
          this.log(id, 'info', `\n📍 Processing VA item ${i + 1}/${vaPrompts.length}: ${keyword}`);
          
          try {
            // Send prompt to ChatGPT in separate chat
            this.log(id, 'info', '💬 Sending prompt to ChatGPT...');
            const gptResponse = await sendPromptInSeparateChat(
              vaPrompt.prompt,
              (msg) => this.log(id, 'info', msg)
            );
            
            if (!gptResponse || gptResponse.length < 100) {
              throw new Error('ChatGPT response too short or empty');
            }
            
            this.log(id, 'success', `✅ Received response from ChatGPT (${gptResponse.length} chars)`);
            
            // Parse the response (similar to Apify flow)
            // The response should contain repo metadata in pgsql fence and README in markdown fence
            const repoData = this.parseVAResponse(gptResponse, fallbackRepoName);
            
            this.log(id, 'info', `📦 Parsed repo name: ${repoData.repo_name}`);
            
            // Create the repository using the workflow
            this.log(id, 'info', '🚀 Creating GitHub repository...');
            
            // Create a dummy scraped data object for the workflow
            const scrapedData = {
              title: repoData.repo_name,
              description: repoData.description,
              url: `https://github.com/${selectedAccount.username}/${repoData.repo_name}`,
              keyword: keyword
            };
            
            const workflowResult = await completeWorkflow({
              scrapedData,
              githubToken,
              gptReadmeResponse: repoData, // Pass the parsed repo data
              cookies: null, // Cookies are loaded automatically by sendPromptInSeparateChat
              logFn: (msg) => this.log(id, 'info', msg),
              vaPlatform // Pass the platform to determine branding
            });
            
            if (workflowResult && workflowResult.success && workflowResult.url) {
              results.push({
                item: keyword,
                status: 'success',
                repoName: repoData.repo_name,
                repoDescription: repoData.description || repoData.about || '',
                repoUrl: workflowResult.url,
                account: selectedAccount.username,
                filesGenerated: workflowResult.filesGenerated || 0,
                filesPushed: workflowResult.filesPushed || 0,
                codeGenerated: workflowResult.codeGenerated || false
              });
              
              this.log(id, 'success', `✅ Repository created: ${workflowResult.url}`);
              
              // Store README in campaign database
              if (workflowResult.readme) {
                await storage.updateCampaign(id, {
                  lastGeneratedReadme: workflowResult.readme,
                  lastReadmeTimestamp: new Date().toISOString()
                });
                this.log(id, 'info', '💾 README stored in campaign database');
              }
              
              // Update account usage
              await this.updateAccountUsage(selectedAccount.id);
            } else {
              throw new Error('Workflow did not return repository URL');
            }
            
          } catch (error) {
            console.error(`Failed to process VA item ${i + 1}:`, error);
            this.log(id, 'error', `Failed to process ${keyword}: ${error.message}`);
            
            results.push({
              item: keyword,
              status: 'failed',
              error: error.message
            });
          }
          
          // Update progress
          this.updateProgress(id, i + 1, vaPrompts.length);
          
          // Delay between repos
          if (i < vaPrompts.length - 1 && this.running.get(id)) {
            const delayMs = campaign.delayBetweenRepos || 900000; // Default 15 minutes
            this.log(id, 'info', `⏳ Waiting ${Math.round(delayMs / 60000)} minutes before next repo...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
        
        // Save results
        await storage.updateCampaign(id, { results });
        
        const successCount = results.filter(r => r.status === 'success').length;
        const failCount = results.filter(r => r.status === 'failed').length;
        
        console.log('\n===== VA CAMPAIGN COMPLETED =====');
        console.log('Successful:', successCount);
        console.log('Failed:', failCount);
        
        if (successCount === 0) {
          this.log(id, 'error', `Campaign failed: All ${failCount} attempt(s) failed`);
          this.setStatus(id, 'Failed');
        } else {
          this.log(id, 'success', `Campaign completed: ${successCount} succeeded, ${failCount} failed`);
          this.setStatus(id, 'Completed');
        }
        
        this.running.delete(id);
        console.log('VA Campaign execution finished');
        return;
        
      } else {
        // ========== KEYWORDS FLOW: Parse keywords and use ChatGPT ==========
        const keywords = this.parseKeywords(campaign.keywords);
        let questionsWithAnswers = [];

        if (typeof campaign.questions === 'string') {
          questionsWithAnswers = this.parseQuestionsAndAnswers(campaign.questions);
        } else if (Array.isArray(campaign.questions)) {
          questionsWithAnswers = campaign.questions.map(q => ({
            question: q,
            answer: ''
          }));
        }

        if (!keywords || keywords.length === 0) {
          throw new Error('No keywords provided');
        }

        this.log(id, 'info', `Starting keyword processing for ${keywords.length} keyword(s) and ${questionsWithAnswers.length} Q&A pair(s)`);
        this.updateProgress(id, 0, keywords.length);

        items = keywords;
        
        // Generate metadata for each keyword using ChatGPT
        for (let i = 0; i < keywords.length; i++) {
          if (!this.running.get(id)) break;
          
          const keyword = keywords[i];
          this.log(id, 'info', `Asking ChatGPT for metadata: "${keyword}"`);
          
          try {
            // Get GPT account cookies
            let gptCookies = null;
            if (campaign.gptAccountId) {
              const gptAccount = await storage.getGPTAccount(campaign.gptAccountId);
              if (gptAccount && gptAccount.cookies) {
                gptCookies = gptAccount.cookies;
                this.log(id, 'info', `Using GPT account: ${gptAccount.name}`);
              }
            }
            
            const meta = await askChatGPTForRepoMetadata(
              { 
                keyword, 
                questionsWithAnswers,
                projectName: 'github repo generator',
                cookies: gptCookies // Pass GPT account cookies
              }, 
              (msg) => this.log(id, 'info', msg)
            );
            
            metadataList.push(meta);
            this.log(id, 'success', `Generated metadata for: ${meta.repo_name}`);
          } catch (error) {
            this.log(id, 'error', `Failed to generate metadata for "${keyword}": ${error.message}`);
            metadataList.push(null);
          }
        }
        
        // Filter out null metadata
        const validMetadata = metadataList.filter(m => m !== null);
        
        // Check if all metadata generation failed
        if (validMetadata.length === 0) {
          throw new Error('All metadata generation attempts failed. No repositories can be created.');
        }
      }

      // ========== PHASE 3: CREATE GITHUB REPOSITORIES (Keywords flow only) ==========
      this.log(id, 'info', '🚀 Phase 3: Creating GitHub repositories...');
      
      const results = [];
      const totalRepos = metadataList.filter(m => m !== null).length;
      let processedCount = 0;

      this.updateProgress(id, 0, totalRepos);

      for (let i = 0; i < metadataList.length; i++) {
        if (!this.running.get(id)) {
          this.log(id, 'info', 'Campaign stopped by user');
          break;
        }

        const meta = metadataList[i];
        const item = items[i];

        if (!meta) {
          results.push({
            item,
            status: 'failed',
            error: 'Metadata generation failed'
          });
          continue;
        }

        try {
          // Get the best account from the group
          const account = await this.getBestAccountFromGroup(campaign.accountGroupId, id);
          const token = await storage.getGithubAccountToken(account.id);
          
          this.log(id, 'info', `Creating repository: ${meta.repo_name} (using ${account.username})`);

          // Create repository
          const repo = await createRepository({ 
            name: meta.repo_name, 
            description: meta.description,
            token
          });

          // Update README
          this.log(id, 'info', `Adding README to ${repo.name}`);
          await updateReadme({
                  owner: githubUsername,
                  repo: repoData.repo_name,
                  content: repoData.readme,
                  token,
                  // push local media folder (if present) into the repo under 'media/'
                  mediaFolderPath: path.resolve(process.cwd(), 'src', 'services', 'media'),
                  mediaRepoPath: 'media'
                });

          // Add topics
          if (meta.topics && meta.topics.length > 0) {
            this.log(id, 'info', `Adding ${meta.topics.length} topic(s) to ${repo.name}`);
            await addTopics({ 
              owner: repo.owner.login, 
              repo: repo.name, 
              topics: meta.topics,
              token
            });
          }

          // Create issues
          if (meta.issues && meta.issues.length > 0) {
            this.log(id, 'info', `Creating ${meta.issues.length} issue(s) in ${repo.name}`);
            await createIssues({ 
              owner: repo.owner.login, 
              repo: repo.name, 
              issues: meta.issues,
              token
            });
          }

          // Update account usage
          await this.updateAccountUsage(account.id);

          results.push({
            item,
            status: 'success',
            repoUrl: repo.html_url,
            repoName: repo.name,
            repoDescription: meta.description || '',
            account: account.username,
            filesGenerated: 0,
            filesPushed: 0,
            codeGenerated: false
          });

          this.log(id, 'success', `✅ Successfully created: ${repo.html_url}`);
          
        } catch (error) {
          console.error('Failed to create repository:', error.message);
          this.log(id, 'error', `Failed to create repository for "${item}": ${error.message}`);
          
          results.push({
            item,
            status: 'failed',
            error: error.message
          });
        }

        processedCount++;
        this.updateProgress(id, processedCount, totalRepos);
        
        // Add delay between iterations
        if (processedCount < totalRepos) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Save results
      await storage.updateCampaign(id, { results });

      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'failed').length;
      
      console.log('\n===== CAMPAIGN COMPLETED =====');
      console.log('Successful:', successCount);
      console.log('Failed:', failCount);
      
      // Mark as Failed if no repositories were created successfully
      if (successCount === 0) {
        this.log(id, 'error', `Campaign failed: All ${failCount} attempt(s) failed`);
        this.setStatus(id, 'Failed');
      } else {
        this.log(id, 'success', `Campaign completed: ${successCount} succeeded, ${failCount} failed`);
        this.setStatus(id, 'Completed');
      }
      
    } catch (error) {
      console.error('Campaign failed:', error.message);
      this.log(id, 'error', `Campaign failed: ${error.message}`);
      this.setStatus(id, 'Failed', error.message);
    } finally {
      this.running.delete(id);
      console.log('Campaign execution finished');
    }
  }

  async stopCampaign(id) {
    console.log(`Stopping campaign: ${id}`);
    
    if (!this.running.get(id)) {
      console.log('Campaign is not running');
      this.log(id, 'warning', 'Campaign is not running');
      return;
    }
    
    this.log(id, 'info', 'Stopping campaign...');
    this.running.delete(id);
    this.setStatus(id, 'Stopped');
    console.log('Campaign stopped');
  }

  getCampaignLogs(id) {
    console.log(`Getting logs for campaign: ${id}`);
    return storage.getLogs(id);
  }

  getCampaignResults(id) {
    console.log(`Getting results for campaign: ${id}`);
    const campaign = storage.getCampaign(id);
    return campaign?.results || [];
  }
}

export const campaignManager = new CampaignManager();