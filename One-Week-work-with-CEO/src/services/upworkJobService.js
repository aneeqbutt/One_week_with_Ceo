import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cached resolved Python executable path
let _pythonExe = null;

async function resolvePython() {
  if (_pythonExe) return _pythonExe;
  const candidates = process.platform === 'win32'
    ? [
        'py',
        'python',
        'python3',
        // hardcoded fallback for this machine
        'C:\\Users\\aneeq\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe',
      ]
    : ['python3', 'python'];
  for (const cmd of candidates) {
    const found = await new Promise(resolve => {
      const p = spawn(cmd, ['--version'], { stdio: 'pipe', shell: false });
      p.on('close', code => resolve(code === 0 ? cmd : null));
      p.on('error', () => resolve(null));
    });
    if (found) {
      console.log(`[Python] resolved executable: ${found}`);
      _pythonExe = found;
      return found;
    }
  }
  throw new Error('Python not found. Install Python and ensure it is in your system PATH.');
}

/**
 * Service to interact with the Upwork Discord Bot's scraper
 * This integrates with the Python upwork_scraper.py
 */
class UpworkJobService {
  constructor() {
    this.pythonProcess = null;
    this.botPath = path.join(__dirname, '..', '..', 'upwork-discord-bot');
    this.lastAuthRefreshAt = 0; // epoch ms
    this.AUTH_REFRESH_COOLDOWN_MS = 1000 * 60 * 5; // 5 minutes
    this.authRefreshInProgress = false;
    this._authRefreshWaiters = [];
  }

  /**
   * Fetch jobs from Upwork using the Python scraper
   * @param {string} query - Keyword or URL to filter jobs
   * @param {number} limit - Maximum number of jobs to fetch
   * @returns {Promise<Array>} Array of job objects
   */
  async fetchJobs(query, limit = 10) {
    console.log(`🔍 Fetching Upwork jobs for query: "${query}"`);
    
    // Detect URL mode and extract parameters
    let urlParams = null;
    let isUrl = false;
    try {
      if (typeof query === 'string' && (query.startsWith('http://') || query.startsWith('https://'))) {
        const u = new URL(query);
        // Only handle Upwork nx/search/jobs URLs – otherwise fall back to keyword
        if (u.hostname.includes('upwork.com') && u.pathname.includes('/nx/search/jobs')) {
          isUrl = true;
          urlParams = {
            q: decodeURIComponent(u.searchParams.get('q') || '').trim(),
            paymentVerified: ['1', 'true', 'yes'].includes((u.searchParams.get('payment_verified') || '').toLowerCase()),
            perPage: parseInt(u.searchParams.get('per_page') || '', 10) || undefined,
            page: parseInt(u.searchParams.get('page') || '', 10) || undefined,
            sort: (u.searchParams.get('sort') || '').toLowerCase()
          };
          if (urlParams.perPage) {
            limit = urlParams.perPage; // honor per_page as limit
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse potential URL query, treating as keyword. Error:', e?.message);
    }

    return new Promise((resolve, reject) => {
      resolvePython().then(pythonExe => {
        // When URL is provided, use its q parameter (advanced expression supported)
        const effectiveQuery = isUrl ? (urlParams?.q || '') : query;

        // Prepare Python script execution
        const scriptPath = path.join(this.botPath, 'scraper', 'job_fetch.py');

        // Arguments to pass to Python script
        const args = [
          scriptPath,
          '--query', effectiveQuery,
          '--limit', limit.toString(),
          '--filter-only' // Only filter, don't post to Discord
        ];

        console.log('📦 Running Python scraper:', pythonExe, args.join(' '));
        
        // Spawn Python process
        const pythonProcess = spawn(pythonExe, args, {
          cwd: this.botPath,
          env: { ...process.env }
        });
        
        let dataBuffer = '';
        let errorBuffer = '';
        
        // Collect stdout data silently
        pythonProcess.stdout.on('data', (data) => {
          dataBuffer += data.toString();
        });

        // Collect stderr data silently (Python debug output)
        pythonProcess.stderr.on('data', (data) => {
          errorBuffer += data.toString();
        });
        
        // Handle process completion
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              // Parse JSON response from Python script
              let jobs = JSON.parse(dataBuffer);
              console.log(`✅ Successfully fetched ${jobs.length} jobs`);

              // If a URL required payment verification, validate using job details
              const needsPaymentVerify = Boolean(isUrl && urlParams?.paymentVerified);
              if (!needsPaymentVerify || jobs.length === 0) {
                return resolve(jobs);
              }

              console.log('🔎 URL requires payment_verified=1 – verifying via job details...');

              this._filterJobsByPaymentVerification(jobs)
                .then(filtered => {
                  console.log(`✅ Payment verification filter: ${filtered.length}/${jobs.length} jobs remain`);
                  resolve(filtered);
                })
                .catch(err => {
                  console.error('❌ Error during payment verification filtering:', err);
                  // As a fallback, return the unfiltered list rather than failing entire request
                  resolve(jobs);
                });
            } catch (parseError) {
              console.error('❌ Failed to parse Python output:', parseError);
              console.error('Raw output:', dataBuffer);
              reject(new Error('Failed to parse job data from scraper'));
            }
          } else {
            console.error(`❌ Python scraper exited with code ${code}`);
            console.error('Error output:', errorBuffer);
            reject(new Error(`Scraper failed with code ${code}: ${errorBuffer}`));
          }
        });
        
        // Handle process errors
        pythonProcess.on('error', (error) => {
          console.error('❌ Failed to start Python scraper:', error);
          reject(new Error(`Failed to start scraper: ${error.message}`));
        });

      }).catch(err => {
        console.error('❌ Python resolution failed:', err.message);
        reject(err);
      });
    });
  }

  /**
   * Fetch detailed information about a specific job
   * @param {string} jobId - The Upwork job ID
   * @returns {Promise<Object>} Detailed job object
   */
  async fetchJobDetails(jobId) {
    console.log(`📋 Fetching details for job: ${jobId}`);
    
    const attemptFetch = (attempt = 1) => new Promise((resolve, reject) => {
      resolvePython().then(pythonExe => {
        const scriptPath = path.join(this.botPath, 'scraper', 'job_details.py');

        const args = [
          scriptPath,
          '--job-id', jobId
        ];

        console.log('📦 Running Python scraper for job details:', pythonExe, args.join(' '));

        const pythonProcess = spawn(pythonExe, args, {
          cwd: this.botPath,
          env: { ...process.env }
        });
        
        let dataBuffer = '';
        let errorBuffer = '';
        
        pythonProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          dataBuffer += chunk;
          console.log('[Python Output]:', chunk);
        });
        
        pythonProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          errorBuffer += chunk;
          console.error('[Python Error]:', chunk);
        });
        
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            try {
              // Try direct parse first
              let jobDetails;
              try {
                jobDetails = JSON.parse(dataBuffer);
              } catch (e) {
                // Attempt to extract a JSON block from noisy stdout (logs + JSON)
                const tryExtractJSON = (text) => {
                  if (!text || typeof text !== 'string') return null;
                  // Try to find the last JSON object or array in the text using greedy regex
                  const objMatches = text.match(/\{[\s\S]*\}/g);
                  const arrMatches = text.match(/\[[\s\S]*\]/g);
                  // Prefer a match that appears last in the output
                  const candidates = [];
                  if (objMatches) candidates.push(...objMatches);
                  if (arrMatches) candidates.push(...arrMatches);
                  if (candidates.length === 0) return null;
                  // Try parsing candidates from last to first
                  for (let i = candidates.length - 1; i >= 0; i--) {
                    try {
                      return JSON.parse(candidates[i]);
                    } catch (err) {
                      continue;
                    }
                  }
                  return null;
                };

                jobDetails = tryExtractJSON(dataBuffer);
                if (!jobDetails) throw e; // rethrow original parse error
              }
              console.log(`✅ Successfully fetched job details for: ${jobId}`);
              resolve(jobDetails);
            } catch (parseError) {
              console.error('❌ Failed to parse job details:', parseError);
              // Dump raw output to a debug file for inspection
              try {
                const dbgPath = path.join(__dirname, '..', '..', 'debug-job-details-output.txt');
                const entry = `\n--- ${new Date().toISOString()} JOB ${jobId} ---\nSTDOUT:\n${dataBuffer}\nSTDERR:\n${errorBuffer}\n`;
                fs.appendFileSync(dbgPath, entry, 'utf-8');
                console.warn(`⚠️ Raw job-details output appended to ${dbgPath}`);
              } catch (dbgErr) {
                console.warn('⚠️ Could not write debug job details file:', dbgErr?.message);
              }
              // Retry once after auth refresh if first attempt (wrapped in async IIFE)
              if (attempt === 1) {
                (async () => {
                  const refreshed = await this._ensureAuthFresh();
                  if (refreshed) {
                    console.log('🔄 Retrying job details after auth refresh...');
                    try {
                      const retryResult = await attemptFetch(2);
                      resolve(retryResult);
                      return;
                    } catch (e) {
                      reject(e);
                      return;
                    }
                  } else {
                    reject(new Error('Failed to parse job details'));
                  }
                })();
                return;
              }
              reject(new Error('Failed to parse job details'));
            }
          } else {
            console.error(`❌ Job details scraper exited with code ${code}`);
            // Retry once after auth refresh on 401/403-like outputs or first failure
            const shouldRetry = attempt === 1 && /401|403|unauthoriz|forbidden|expired|token/i.test(errorBuffer || '');
            if (shouldRetry) {
              (async () => {
                const refreshed = await this._ensureAuthFresh();
                if (refreshed) {
                  console.log('🔄 Retrying job details after auth refresh...');
                  try {
                    const result = await attemptFetch(2);
                    resolve(result);
                  } catch (e) {
                    reject(e);
                  }
                } else {
                  reject(new Error(`Job details scraper failed: ${errorBuffer}`));
                }
              })();
              return;
            }
            reject(new Error(`Job details scraper failed: ${errorBuffer}`));
          }
        });
        
        pythonProcess.on('error', (error) => {
          console.error('❌ Failed to start job details scraper:', error);
          reject(new Error(`Failed to start scraper: ${error.message}`));
        });

      }).catch(err => {
        console.error('❌ Python resolution failed:', err.message);
        reject(err);
      });
    });
    return attemptFetch(1);
  }

  /**
   * Use the existing UpworkScraper class methods directly via import
   * This is the fallback if Python integration doesn't work
   */
  async fetchJobsDirectly(query = '', limit = 10) {
    console.log(`🔍 [Fallback] Fetching jobs directly using UpworkScraper class`);
    
    try {
      // Import the Python module's functionality
      // Note: This would require the Python code to be refactored or use a Node-Python bridge
      console.warn('⚠️ Direct import not implemented. Use Python subprocess instead.');
      return [];
    } catch (error) {
      console.error('❌ Direct fetch failed:', error);
      throw error;
    }
  }

  /**
   * Build job description for GPT processing
   * @param {Object} jobDetails - Detailed job object
   * @returns {string} Formatted job description
   */
  buildJobDescription(jobDetails) {
    const sections = [];
    
    sections.push(`Job Title: ${jobDetails.title || 'N/A'}`);
    sections.push(`\nJob Description:\n${jobDetails.description || 'No description provided'}`);
    
    if (jobDetails.skills && jobDetails.skills.length > 0) {
      sections.push(`\nRequired Skills: ${jobDetails.skills.join(', ')}`);
    }
    
    if (jobDetails.budget) {
      sections.push(`\nBudget: ${jobDetails.budget}`);
    }
    
    if (jobDetails.duration_label) {
      sections.push(`\nDuration: ${jobDetails.duration_label}`);
    }
    
    if (jobDetails.experience_level) {
      sections.push(`\nExperience Level: ${jobDetails.experience_level}`);
    }
    
    if (jobDetails.job_type) {
      sections.push(`\nJob Type: ${jobDetails.job_type}`);
    }
    
    return sections.join('\n');
  }

  /**
   * Clean up any running processes
   */
  cleanup() {
    if (this.pythonProcess && !this.pythonProcess.killed) {
      console.log('🧹 Cleaning up Python scraper process');
      this.pythonProcess.kill();
    }
  }

  /**
   * Internal: Filter jobs to those with verified payments by fetching details.
   * Limits concurrency to avoid excessive parallel requests.
   * @param {Array} jobs
   * @returns {Promise<Array>} filtered jobs
   */
  async _filterJobsByPaymentVerification(jobs) {
    // Reduce concurrency to 1 to avoid multiple simultaneous auth refresh attempts
    const concurrency = 1;
    const queue = jobs.slice();
    const picked = [];
    // debug counters
    let cntListTrue = 0, cntDetailsTrue = 0, cntUnknownPass = 0, cntExplicitFalse = 0;

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const job = queue.shift();
        const jobId = job?.id || job?.ciphertext || job?.openingId || job?.opening_id || job?.job_id;
        // If the listing already indicates payment verified, accept without details
        if (job?.client?.paymentVerified === true || job?.payment_verified === true) {
          picked.push(job);
          cntListTrue++;
          continue;
        }
        if (!jobId) continue;
        try {
          const details = await this.fetchJobDetails(jobId);
          const dFlag = (details && (details.payment_verified === true || details.payment_verified === false))
            ? details.payment_verified
            : (details?.client?.paymentVerified);

          if (dFlag === true) {
            picked.push(job);
            cntDetailsTrue++;
          } else if (dFlag === false) {
            cntExplicitFalse++;
            // exclude
          } else {
            // Unknown/Restricted/No details => do NOT drop the job; allow it to pass through
            picked.push(job);
            cntUnknownPass++;
          }
        } catch (e) {
          // On any error fetching details, do not drop – allow through to avoid skipping valid jobs
          console.warn('⚠️ Details fetch error; allowing job through:', e.message);
          picked.push(job);
          cntUnknownPass++;
        }
      }
    });

    await Promise.all(workers);
    console.log(`🔎 Payment verify summary -> from list:true=${cntListTrue}, from details:true=${cntDetailsTrue}, unknown-pass=${cntUnknownPass}, explicit-false-excluded=${cntExplicitFalse}`);
    return picked;
  }

  /**
   * Ensure auth headers/cookies are fresh by running the Selenium-based authbot.
   * Debounced by a cooldown to avoid spamming browser automation.
   * @returns {Promise<boolean>} true if refresh likely succeeded
   */
  async _ensureAuthFresh() {
    const now = Date.now();
    if (now - this.lastAuthRefreshAt < this.AUTH_REFRESH_COOLDOWN_MS) {
      console.log('⏱️ Skipping auth refresh (cooldown active)');
      return false;
    }

    // If a refresh is already in progress, wait for it
    if (this.authRefreshInProgress) {
      console.log('⏳ Auth refresh already in progress – waiting...');
      return new Promise(resolve => {
        this._authRefreshWaiters.push(resolve);
      });
    }

    console.log('🔐 Refreshing Upwork auth headers/cookies via authbot...');
    this.lastAuthRefreshAt = now;
    this.authRefreshInProgress = true;

    return new Promise((resolve) => {
      try {
        const scriptPath = path.join(this.botPath, 'scraper', 'authbot.py');
        // Workaround: SeleniumBase expects an 'archived_files' folder at project root
        try {
          const archivedDir = path.join(this.botPath, 'archived_files');
          if (!fs.existsSync(archivedDir)) {
            fs.mkdirSync(archivedDir, { recursive: true });
            console.log('[Authbot Prep] Created folder:', archivedDir);
          }
        } catch (prepErr) {
          console.warn('[Authbot Prep] Could not ensure archived_files folder:', prepErr?.message);
        }
        const args = [scriptPath];
        resolvePython().then(pythonExe => {
        const python = spawn(pythonExe, args, { cwd: this.botPath, env: { ...process.env } });

        let hadError = false;
        let stderr = '';
        python.stdout.on('data', (d) => console.log('[Authbot]', d.toString()));
        python.stderr.on('data', (d) => { hadError = true; stderr += d.toString(); console.error('[Authbot ERR]', d.toString()); });
        python.on('close', (code) => {
          if (code === 0 && !hadError) {
            console.log('🔐 Auth refresh completed successfully');
            this.authRefreshInProgress = false;
            resolve(true);
            this._authRefreshWaiters.splice(0).forEach(r => r(true));
          } else {
            console.error(`❌ Authbot exited with code ${code}. Output: ${stderr}`);
            this.authRefreshInProgress = false;
            resolve(false);
            this._authRefreshWaiters.splice(0).forEach(r => r(false));
          }
        });
        python.on('error', (err) => {
          console.error('❌ Failed to start authbot:', err);
          this.authRefreshInProgress = false;
          resolve(false);
          this._authRefreshWaiters.splice(0).forEach(r => r(false));
        });
        }).catch(err => {
          console.error('❌ Python resolution failed for authbot:', err.message);
          this.authRefreshInProgress = false;
          resolve(false);
          this._authRefreshWaiters.splice(0).forEach(r => r(false));
        });
      } catch (e) {
        console.error('❌ Error launching authbot:', e);
        this.authRefreshInProgress = false;
        resolve(false);
        this._authRefreshWaiters.splice(0).forEach(r => r(false));
      }
    });
  }
}

// Export singleton instance
export const upworkJobService = new UpworkJobService();

// Cleanup on process exit
process.on('exit', () => {
  upworkJobService.cleanup();
});
