import pkg from 'pg';
const { Pool } = pkg;
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import { log, success, warn, error as logError, db, section } from '../main/logger.js';

class Storage {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    const host = process.env.PG_HOST || 'localhost';
    const port = parseInt(process.env.PG_PORT) || 5432;
    const database = process.env.PG_DATABASE || 'upwork_jobs';
    const user = process.env.PG_USER || 'postgres';
    db('connect', `→ ${user}@${host}:${port}/${database}`);
    try {
      this.pool = new Pool({ host, port, database, user, password: process.env.PG_PASSWORD });
      await this.pool.query('SELECT 1');
      success(`DB connected → ${user}@${host}:${port}/${database}`);
      await this.setupTables();
      this.connected = true;
    } catch (err) {
      logError(`DB connect failed → ${user}@${host}:${port}/${database}`, err);
      throw err;
    }
  }

  async setupTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY, name TEXT, category TEXT, account_group_id TEXT, gpt_account_id TEXT,
        keywords TEXT, questions TEXT, apify_urls TEXT, va_repo_type TEXT, va_platform TEXT,
        va_single_repo_descriptions TEXT, va_multiple_repo_descriptions TEXT,
        time_coefficient TEXT, delay_between_repos INTEGER, repos_per_hour INTEGER,
        status TEXT DEFAULT 'Idle', progress JSONB DEFAULT '{}', results JSONB DEFAULT '[]',
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS stars_campaigns (
        id TEXT PRIMARY KEY, name TEXT, keyword TEXT, target_url TEXT, folder_id TEXT, folder_name TEXT,
        status TEXT DEFAULT 'Idle', progress INTEGER DEFAULT 0, current_profile INTEGER DEFAULT 0, total_profiles INTEGER DEFAULT 0,
        stats JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS indexer_campaigns (
        id TEXT PRIMARY KEY, name TEXT, status TEXT DEFAULT 'Idle', results JSONB DEFAULT '[]', progress JSONB DEFAULT '{}',
        error TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS view_campaigns (
        id TEXT PRIMARY KEY, name TEXT, search_type TEXT, search_query TEXT, repo_url TEXT, num_views INTEGER DEFAULT 1,
        status TEXT DEFAULT 'Idle', progress JSONB DEFAULT '{}', results JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS upwork_campaigns (
        id TEXT PRIMARY KEY, name TEXT, category TEXT DEFAULT 'upwork', upwork_search_input TEXT,
        account_group_id TEXT, gpt_account_id TEXT, scrape_job_urls JSONB DEFAULT '[]', scrape_job_niche TEXT,
        time_coefficient TEXT, delay_between_repos INTEGER, repos_per_hour INTEGER, status TEXT DEFAULT 'Idle',
        progress JSONB DEFAULT '{}', results JSONB DEFAULT '[]', last_generated_readme TEXT, last_readme_timestamp TEXT,
        failure_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS gpt_accounts (
        id TEXT PRIMARY KEY, name TEXT, cookies JSONB, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY, campaign_id TEXT, level TEXT, message TEXT, timestamp BIGINT, created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS processed_jobs (
        id TEXT PRIMARY KEY, title TEXT, normalized_title TEXT, description TEXT, campaign_id TEXT, niche TEXT, platform TEXT, tool TEXT,
        repo_url TEXT, upwork_job_url TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS data_to_export (
        id TEXT PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT, topics JSONB DEFAULT '[]',
        readme TEXT, category TEXT, platform_domain TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS jobs_selected (
        id SERIAL PRIMARY KEY, campaign_id TEXT, title TEXT, description TEXT, niche TEXT, platform TEXT, tool TEXT,
        upwork_url TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS product (
        id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs_selected(id), repo_name TEXT, description TEXT, readme TEXT,
        topics JSONB DEFAULT '[]', created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS blog (
        id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs_selected(id), title TEXT, content TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs_selected(id), title TEXT, content TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`
    ];

    const tableNames = tables.map(sql => sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || '?');
    db('setupTables', `→ ensuring ${tables.length} tables exist`);

    for (let i = 0; i < tables.length; i++) {
      const sql = tables[i];
      const name = tableNames[i];
      try {
        await this.pool.query(sql);
        log(`  DB table ready: ${name}`);
      } catch (err) {
        // 42P07 = table already exists, 23505 = duplicate key (type conflict)
        if (err.code === '42P07' || err.code === '23505') {
          log(`  DB table already exists (skipped): ${name}`);
          continue;
        }
        logError(`  DB table setup failed: ${name}`, err);
        throw err;
      }
    }
    success('DB setupTables complete — all tables ready');

    // Ensure failure_reason column exists on both campaign tables (added after initial schema)
    const alterStatements = [
      `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failure_reason TEXT`,
      `ALTER TABLE upwork_campaigns ADD COLUMN IF NOT EXISTS failure_reason TEXT`,
    ];
    for (const sql of alterStatements) {
      try {
        await this.pool.query(sql);
      } catch (err) {
        if (err.code !== '42701') throw err; // 42701 = column already exists
      }
    }

    // Add PRIMARY KEY to processed_jobs if missing (dedup first to avoid constraint errors)
    try {
      await this.pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'processed_jobs_pkey'
          ) THEN
            DELETE FROM processed_jobs p1 USING processed_jobs p2
              WHERE p1.ctid > p2.ctid AND p1.id = p2.id;
            ALTER TABLE processed_jobs ADD PRIMARY KEY (id);
          END IF;
        END $$
      `);
    } catch (err) {
      log(`  DB processed_jobs PK migration skipped: ${err.message}`);
    }

    // Index for fast exact-match duplicate checks
    try {
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_processed_jobs_norm_title ON processed_jobs (normalized_title)`);
    } catch (err) {
      log(`  DB processed_jobs index skipped: ${err.message}`);
    }

    // Reset any campaigns stuck in 'Running' from a previous crashed/closed session
    await this.pool.query(`UPDATE campaigns SET status = 'Idle' WHERE status = 'Running'`);
    await this.pool.query(`UPDATE upwork_campaigns SET status = 'Idle' WHERE status = 'Running'`);
    log('DB reset stale Running campaigns → Idle');

    // Add search_query column to jobs_selected if not present
    try {
      await this.pool.query(`ALTER TABLE jobs_selected ADD COLUMN IF NOT EXISTS search_query TEXT`);
    } catch (err) {
      if (err.code !== '42701') throw err;
    }
  }

  async ensureConnected() {
    if (!this.connected) {
      await this.connect();
    }
  }


  async getCampaigns() {
    await this.ensureConnected();
    try {
      const result = await this.pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
      return result.rows;
    } catch (err) {
      logError('DB getCampaigns query failed', err);
      throw err;
    }
  }
  async getCampaign(id) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM campaigns WHERE id = $1', [id]); return result.rows[0] || null; }
  async createCampaign(campaignData) {
    await this.ensureConnected();
    const id = uuidv4();
    try {
      await this.pool.query(`INSERT INTO campaigns (id,name,category,account_group_id,gpt_account_id,keywords,questions,apify_urls,va_repo_type,va_platform,va_single_repo_descriptions,va_multiple_repo_descriptions,time_coefficient,delay_between_repos,repos_per_hour,status,progress,results) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [id, campaignData.name, campaignData.category || 'keywords', campaignData.accountGroupId, campaignData.gptAccountId, campaignData.keywords || '', campaignData.questions || '', campaignData.apifyUrls || '', campaignData.vaRepoType || null, campaignData.vaPlatform || 'bitbash', campaignData.vaSingleRepoDescriptions || '', campaignData.vaMultipleRepoDescriptions || '', campaignData.timeCoefficient || 'balanced', campaignData.delayBetweenRepos || 900000, campaignData.reposPerHour || 4, 'Idle', JSON.stringify({ processed: 0, total: 0 }), JSON.stringify([])]);
      return { id, ...campaignData, status: 'Idle' };
    } catch (err) {
      logError(`DB createCampaign failed → name="${campaignData.name}"`, err);
      throw err;
    }
  }
  async updateCampaign(id, updates) { await this.ensureConnected(); if (updates.progress) updates.progress = JSON.stringify(updates.progress); if (updates.results) updates.results = JSON.stringify(updates.results); const keys = Object.keys(updates); if (keys.length === 0) return; const values = Object.values(updates); const fields = keys.map((k, i) => `${k} = $${i + 1}`).join(', '); await this.pool.query(`UPDATE campaigns SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, id]); }
  async deleteCampaign(id) { await this.ensureConnected(); await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]); await this.pool.query('DELETE FROM campaigns WHERE id = $1', [id]); return true; }

  async getStarsCampaigns() { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM stars_campaigns ORDER BY created_at DESC'); return result.rows; }
  async getStarsCampaign(id) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM stars_campaigns WHERE id = $1', [id]); return result.rows[0] || null; }
  async createStarsCampaign(campaignData) { await this.ensureConnected(); const id = uuidv4(); await this.pool.query(`INSERT INTO stars_campaigns (id,name,keyword,target_url,folder_id,folder_name,status,stats) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, campaignData.name, campaignData.keyword, campaignData.targetUrl, campaignData.folderId, campaignData.folderName || 'Unknown', 'Idle', JSON.stringify({ successful: 0, skipped: 0, failed: 0 })]); return { id, ...campaignData, status: 'Idle' }; }
  async updateStarsCampaign(id, updates) { await this.ensureConnected(); if (updates.stats) updates.stats = JSON.stringify(updates.stats); const keys = Object.keys(updates); if (keys.length === 0) return; const values = Object.values(updates); const fields = keys.map((k, i) => `${k} = $${i + 1}`).join(', '); await this.pool.query(`UPDATE stars_campaigns SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, id]); }
  async deleteStarsCampaign(id) { await this.ensureConnected(); await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]); await this.pool.query('DELETE FROM stars_campaigns WHERE id = $1', [id]); return true; }

  async getIndexerCampaigns() { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM indexer_campaigns ORDER BY created_at DESC'); return result.rows; }
  async getIndexerCampaign(id) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM indexer_campaigns WHERE id = $1', [id]); return result.rows[0] || null; }
  async createIndexerCampaign(campaignData) { await this.ensureConnected(); const id = nanoid(); await this.pool.query(`INSERT INTO indexer_campaigns (id,name,status,results,progress) VALUES ($1,$2,$3,$4,$5)`, [id, campaignData.name, 'Idle', JSON.stringify([]), JSON.stringify({ processed: 0, total: campaignData.items?.length || 1 })]); return { id, ...campaignData, status: 'Idle' }; }
  async updateIndexerCampaign(id, updates) { await this.ensureConnected(); if (updates.results) updates.results = JSON.stringify(updates.results); if (updates.progress) updates.progress = JSON.stringify(updates.progress); const keys = Object.keys(updates); if (keys.length === 0) return; const values = Object.values(updates); const fields = keys.map((k, i) => `${k} = $${i + 1}`).join(', '); await this.pool.query(`UPDATE indexer_campaigns SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, id]); }
  async deleteIndexerCampaign(id) { await this.ensureConnected(); await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]); await this.pool.query('DELETE FROM indexer_campaigns WHERE id = $1', [id]); return { ok: true }; }


  async appendLog(campaignId, logEntry) { await this.ensureConnected(); try { await this.pool.query(`INSERT INTO logs (id, campaign_id, level, message, timestamp) VALUES ($1,$2,$3,$4,$5)`, [uuidv4(), campaignId, logEntry.level, logEntry.message, logEntry.timestamp || Date.now()]); } catch (error) { console.error('Error appending log:', error); } }
  async getLogs(campaignId, since = 0) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM logs WHERE campaign_id = $1 AND timestamp > $2 ORDER BY timestamp ASC', [campaignId, since]); return result.rows; }
  async clearLogs(campaignId) { await this.ensureConnected(); await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [campaignId]); return true; }

  async getGPTAccounts() { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM gpt_accounts ORDER BY created_at DESC'); return result.rows; }
  async getGPTAccount(id) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM gpt_accounts WHERE id = $1', [id]); return result.rows[0] || null; }
  async createGPTAccount(data) { await this.ensureConnected(); const id = nanoid(); await this.pool.query('INSERT INTO gpt_accounts (id, name, cookies) VALUES ($1,$2,$3)', [id, data.name, JSON.stringify(data.cookies)]); return { id, name: data.name, cookies: data.cookies }; }
  async updateGPTAccount(id, updates) { await this.ensureConnected(); if (updates.cookies) updates.cookies = JSON.stringify(updates.cookies); await this.pool.query('UPDATE gpt_accounts SET name = $1, cookies = $2, updated_at = NOW() WHERE id = $3', [updates.name, updates.cookies, id]); return true; }
  async deleteGPTAccount(id) { await this.ensureConnected(); await this.pool.query('DELETE FROM gpt_accounts WHERE id = $1', [id]); return true; }

  async getViewCampaigns() { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM view_campaigns ORDER BY created_at DESC'); return result.rows; }
  async getViewCampaign(id) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM view_campaigns WHERE id = $1', [id]); if (!result.rows[0]) throw new Error('View campaign not found'); return result.rows[0]; }
  async createViewCampaign(campaignData) { await this.ensureConnected(); const id = uuidv4(); await this.pool.query(`INSERT INTO view_campaigns (id, name, search_type, search_query, repo_url, num_views, status, progress, results) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, campaignData.name, campaignData.searchType, campaignData.searchQuery, campaignData.repoUrl, campaignData.numViews || 1, 'Idle', JSON.stringify({ completed: 0, total: campaignData.numViews || 1 }), JSON.stringify([])]); return { id, ...campaignData, status: 'Idle' }; }
  async updateViewCampaign(id, updates) { await this.ensureConnected(); if (updates.progress) updates.progress = JSON.stringify(updates.progress); if (updates.results) updates.results = JSON.stringify(updates.results); const keys = Object.keys(updates); if (keys.length === 0) return await this.getViewCampaign(id); const values = Object.values(updates); const fields = keys.map((k, i) => `${k} = $${i + 1}`).join(', '); await this.pool.query(`UPDATE view_campaigns SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, id]); return await this.getViewCampaign(id); }
  async deleteViewCampaign(id) { await this.ensureConnected(); await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]); await this.pool.query('DELETE FROM view_campaigns WHERE id = $1', [id]); }

  async getUpworkCampaigns() { await this.ensureConnected(); const result = await this.pool.query(`SELECT * FROM upwork_campaigns WHERE category = 'upwork' ORDER BY created_at DESC`); return result.rows; }
  async getUpworkCampaign(id) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM upwork_campaigns WHERE id = $1', [id]); if (!result.rows[0]) throw new Error('Upwork campaign not found'); return result.rows[0]; }
  async createUpworkCampaign(campaignData) { await this.ensureConnected(); const id = nanoid(); await this.pool.query(`INSERT INTO upwork_campaigns (id, name, category, upwork_search_input, account_group_id, gpt_account_id, time_coefficient, delay_between_repos, repos_per_hour, status, progress, results) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [id, campaignData.name, 'upwork', campaignData.upworkSearchInput, campaignData.accountGroupId, campaignData.gptAccountId, campaignData.timeCoefficient || 'balanced', campaignData.delayBetweenRepos || 900000, campaignData.reposPerHour || 4, 'Idle', JSON.stringify({ processed: 0, total: 0, viable: 0, nonViable: 0 }), JSON.stringify([])]); return { id, ...campaignData, status: 'Idle' }; }
  async updateUpworkCampaign(id, updates) { await this.ensureConnected(); if (updates.progress) updates.progress = JSON.stringify(updates.progress); if (updates.results) updates.results = JSON.stringify(updates.results); const keys = Object.keys(updates); if (keys.length === 0) return; const values = Object.values(updates); const fields = keys.map((k, i) => `${k} = $${i + 1}`).join(', '); await this.pool.query(`UPDATE upwork_campaigns SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, id]); }
  async deleteUpworkCampaign(id) { await this.ensureConnected(); await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]); await this.pool.query('DELETE FROM upwork_campaigns WHERE id = $1', [id]); }

  async getScrapeJobsCampaigns() { await this.ensureConnected(); const result = await this.pool.query(`SELECT * FROM upwork_campaigns WHERE category = 'scrape-jobs' ORDER BY created_at DESC`); return result.rows; }
  async getScrapeJobsCampaign(id) { await this.ensureConnected(); const result = await this.pool.query(`SELECT * FROM upwork_campaigns WHERE id = $1 AND category = 'scrape-jobs'`, [id]); if (!result.rows[0]) throw new Error('Scrape-jobs campaign not found'); return result.rows[0]; }
  async createScrapeJobsCampaign(campaignData) { await this.ensureConnected(); const id = nanoid(); const jobEntries = campaignData.scrapeJobUrls.split('---').map(j => j.trim()).filter(j => j.length > 0); await this.pool.query(`INSERT INTO upwork_campaigns (id, name, category, scrape_job_urls, scrape_job_niche, account_group_id, gpt_account_id, time_coefficient, delay_between_repos, repos_per_hour, status, progress, results) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id, campaignData.name, 'scrape-jobs', JSON.stringify(jobEntries), campaignData.scrapeJobNiche, campaignData.accountGroupId, campaignData.gptAccountId, campaignData.timeCoefficient || 'balanced', campaignData.delayBetweenRepos || 900000, campaignData.reposPerHour || 4, 'Idle', JSON.stringify({ processed: 0, total: jobEntries.length, duplicates: 0, errors: 0 }), JSON.stringify([])]); return { id, ...campaignData, status: 'Idle' }; }
  async updateScrapeJobsCampaign(id, updates) { await this.ensureConnected(); if (updates.progress) updates.progress = JSON.stringify(updates.progress); if (updates.results) updates.results = JSON.stringify(updates.results); const keys = Object.keys(updates); if (keys.length === 0) return; const values = Object.values(updates); const fields = keys.map((k, i) => `${k} = $${i + 1}`).join(', '); await this.pool.query(`UPDATE upwork_campaigns SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1}`, [...values, id]); }
  async deleteScrapeJobsCampaign(id) { await this.ensureConnected(); await this.pool.query('DELETE FROM logs WHERE campaign_id = $1', [id]); await this.pool.query(`DELETE FROM upwork_campaigns WHERE id = $1 AND category = 'scrape-jobs'`, [id]); }

  normalizeJobTitle(title) {
    if (!title) return '';
    return title.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  }
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
        else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[str2.length][str1.length];
  }

  async checkJobDuplicate(title, description, similarityThreshold = 0.85) {
    await this.ensureConnected();
    try {
      const normalizedTitle = this.normalizeJobTitle(title);
      if (!normalizedTitle) return null;
      const exact = await this.pool.query('SELECT * FROM processed_jobs WHERE normalized_title = $1 LIMIT 1', [normalizedTitle]);
      if (exact.rows[0]) return exact.rows[0];
      const all = await this.pool.query('SELECT * FROM processed_jobs ORDER BY created_at DESC LIMIT 1000');
      for (const job of all.rows) {
        const similarity = this.calculateSimilarity(normalizedTitle, job.normalized_title);
        if (similarity >= similarityThreshold) return job;
        if (description && job.description) {
          const d1 = this.normalizeJobTitle(description.substring(0, 200));
          const d2 = this.normalizeJobTitle(job.description.substring(0, 200));
          const descSim = this.calculateSimilarity(d1, d2);
          if (similarity >= 0.7 && descSim >= 0.8) return job;
        }
      }
      return null;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return null;
    }
  }

  async storeProcessedJob(jobData) {
    await this.ensureConnected();
    const normalizedTitle = this.normalizeJobTitle(jobData.title);
    try {
      await this.pool.query(`INSERT INTO processed_jobs (id, title, normalized_title, description, campaign_id, niche, platform, tool, repo_url, upwork_job_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [jobData.id || nanoid(), jobData.title, normalizedTitle, jobData.description, jobData.campaignId, jobData.niche, jobData.platform, jobData.tool, jobData.repoUrl, jobData.upworkJobUrl]);
    } catch (error) {
      if (error.code === '23505') return null;
      throw error;
    }
  }

  async getProcessedJobsForCampaign(campaignId) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM processed_jobs WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]); return result.rows; }
  async getProcessedJobsStats() { await this.ensureConnected(); const total = await this.pool.query('SELECT COUNT(*) FROM processed_jobs'); const byNiche = await this.pool.query('SELECT niche, COUNT(*) as count FROM processed_jobs GROUP BY niche ORDER BY count DESC'); return { totalProcessed: parseInt(total.rows[0].count, 10), byNiche: byNiche.rows.reduce((acc, r) => { acc[r.niche] = parseInt(r.count, 10); return acc; }, {}) }; }
  async clearOldProcessedJobs(daysOld = 30) { await this.ensureConnected(); const result = await this.pool.query(`DELETE FROM processed_jobs WHERE created_at < NOW() - INTERVAL '${daysOld} days'`); return result.rowCount; }


  async storeDataToExport(exportData) { await this.ensureConnected(); const id = nanoid(); await this.pool.query(`INSERT INTO data_to_export (id, campaign_id, title, description, topics, readme, category, platform_domain) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, exportData.campaignId, exportData.title, exportData.description, JSON.stringify(exportData.topics || []), exportData.readme, exportData.category, exportData.platformDomain || 'None']); return { id, ...exportData }; }
  async getExportDataByCampaign(campaignId) { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM data_to_export WHERE campaign_id = $1 ORDER BY created_at DESC', [campaignId]); return result.rows; }
  async getAllExportData() { await this.ensureConnected(); const result = await this.pool.query('SELECT * FROM data_to_export ORDER BY created_at DESC'); return result.rows; }
  async deleteExportDataByCampaign(campaignId) { await this.ensureConnected(); await this.pool.query('DELETE FROM data_to_export WHERE campaign_id = $1', [campaignId]); }

  async saveJobSelected(job, filterResult, campaignId, searchQuery = null) { await this.ensureConnected(); const result = await this.pool.query(`INSERT INTO jobs_selected (campaign_id, title, description, niche, platform, tool, upwork_url, search_query) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [campaignId, job.title, job.description, filterResult.niche, filterResult.platform, filterResult.tool, job.url || '', searchQuery]); return result.rows[0].id; }
  async saveProduct(jobId, productData) { await this.ensureConnected(); await this.pool.query(`INSERT INTO product (job_id, repo_name, description, readme, topics) VALUES ($1,$2,$3,$4,$5)`, [jobId, productData.repo_name, productData.description, productData.readme, JSON.stringify(productData.topics || [])]); }
  async saveBlog(jobId, blogData) { await this.ensureConnected(); await this.pool.query('INSERT INTO blog (job_id, title, content) VALUES ($1,$2,$3)', [jobId, blogData.title, blogData.content]); }
  async saveService(jobId, serviceData) { await this.ensureConnected(); await this.pool.query('INSERT INTO services (job_id, title, content) VALUES ($1,$2,$3)', [jobId, serviceData.title, serviceData.content]); }

  /**
   * Saves a job AND all its generated content (product/blog/service) in a single
   * atomic transaction. This ensures the sync-service always sees complete data —
   * the job only appears in jobs_selected once everything is already attached.
   */
  async saveJobWithRelations(job, filterResult, campaignId, searchQuery, content = {}) {
    await this.ensureConnected();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert job
      const jobResult = await client.query(
        `INSERT INTO jobs_selected (campaign_id, description, niche, platform, tool, upwork_url, search_query, title)
         VALUES ($1,$3,$4,$5,$6,$7,$8,$2) RETURNING id`,
        [campaignId, job.title, job.description, filterResult.niche, filterResult.platform,
         filterResult.tool, job.url || '', searchQuery]
      );
      const savedJobId = jobResult.rows[0].id;

      // 2. Insert product (if generated)
      if (content.repoData?.repo_name) {
        await client.query(
          `INSERT INTO product (job_id, repo_name, description, readme, topics) VALUES ($1,$2,$3,$4,$5)`,
          [savedJobId, content.repoData.repo_name, content.repoData.description,
           content.repoData.readme, JSON.stringify(content.repoData.topics || [])]
        );
      }

      // 3. Insert blog (if generated)
      if (content.blogData?.title && content.blogData?.content) {
        await client.query(
          `INSERT INTO blog (job_id, title, content) VALUES ($1,$2,$3)`,
          [savedJobId, content.blogData.title, content.blogData.content]
        );
      }

      // 4. Insert service (if generated)
      if (content.serviceData?.title && content.serviceData?.content) {
        await client.query(
          `INSERT INTO services (job_id, title, content) VALUES ($1,$2,$3)`,
          [savedJobId, content.serviceData.title, content.serviceData.content]
        );
      }

      await client.query('COMMIT');
      return savedJobId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      console.log('✅ PostgreSQL connection closed');
    }
  }
}

const storage = new Storage();
storage.connect().catch(error => {
  console.error('❌ Failed to initialize storage:', error);
  process.exit(1);
});
process.on('SIGINT', async () => {
  await storage.close();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await storage.close();
  process.exit(0);
});
export { storage };
