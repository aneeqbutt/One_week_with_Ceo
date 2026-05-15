import { EventEmitter } from 'events';
import { storage } from './storage.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StarsCampaignManager extends EventEmitter {
  constructor() {
    super();
    this.runningCampaigns = new Map();
  }

  async startCampaign(campaignId) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Starting Stars Campaign: ${campaignId}`);
      console.log('='.repeat(60));

      // Get campaign details
      const campaign = await storage.getStarsCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check if already running
      if (this.runningCampaigns.has(campaignId)) {
        throw new Error('Campaign is already running');
      }

      // Update status to running
      await storage.updateStarsCampaign(campaignId, {
        status: 'Running',
        startedAt: new Date().toISOString(),
        progress: 0
      });

      this.emit('status', { campaignId, status: 'Running' });
      this.log(campaignId, 'info', 'Campaign started');

      // Start the automation script
      await this.runStarringScript(campaignId, campaign);

    } catch (error) {
      console.error('❌ Error starting stars campaign:', error);
      await storage.updateStarsCampaign(campaignId, {
        status: 'Failed',
        error: error.message
      });
      this.emit('status', { campaignId, status: 'Failed' });
      throw error;
    }
  }

  async runStarringScript(campaignId, campaign) {
    return new Promise((resolve, reject) => {
      // Resolve script path with fallbacks so it works in dev (src/) and packaged (dist/) modes
      const candidatePaths = [
        path.join(__dirname, '../scripts/starRepositories.js'), // near services folder
        path.join(__dirname, '../../scripts/starRepositories.js'), // alternative relative
        path.join(process.cwd(), 'scripts', 'starRepositories.js'), // project root scripts/
      ];

      let scriptPath = candidatePaths.find(p => existsSync(p));
      if (!scriptPath) {
        // Last attempt: maybe script lives in a dist parallel folder
        const alt = path.join(__dirname, '../scripts/starRepositories.js');
        if (existsSync(alt)) scriptPath = alt;
      }

      if (!scriptPath) {
        const err = new Error('starRepositories.js not found in expected locations: ' + JSON.stringify(candidatePaths, null, 2));
        console.error(err);
        throw err;
      }

      console.log('Using star script at:', scriptPath);
      
      this.log(campaignId, 'info', `Keyword: ${campaign.keyword}`);
      this.log(campaignId, 'info', `Target URL: ${campaign.targetUrl}`);
      this.log(campaignId, 'info', `Folder: ${campaign.folderName}`);
      
      // Spawn the Node.js process to run the starring script
      const child = spawn('node', [
        scriptPath,
        campaign.keyword,
        campaign.targetUrl,
        campaign.folderName
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CAMPAIGN_ID: campaignId
        }
      });

  // Store the process metadata (so we can mark stopped-by-user)
  this.runningCampaigns.set(campaignId, { child, stoppedByUser: false });

      // Handle stdout
      child.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);
        
        // Parse and log the output
        const lines = output.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          this.log(campaignId, 'info', line);
          
          // Parse progress if available
          const progressMatch = line.match(/Processing profile (\d+)\/(\d+)/);
          if (progressMatch) {
            const current = parseInt(progressMatch[1]);
            const total = parseInt(progressMatch[2]);
            const progress = Math.round((current / total) * 100);
            
            storage.updateStarsCampaign(campaignId, {
              progress,
              currentProfile: current,
              totalProfiles: total
            });
            
            this.emit('progress', { campaignId, progress, current, total });
          }
        });
      });

      // Handle stderr
      child.stderr.on('data', (data) => {
        const error = data.toString();
        console.error(error);
        this.log(campaignId, 'error', error);
      });

      // Handle process completion
      // Handle process completion
      child.on('close', async (code) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Campaign process exited with code: ${code}`);
        console.log('='.repeat(60));

        const meta = this.runningCampaigns.get(campaignId);
        if (meta) {
          // remove from running map
          this.runningCampaigns.delete(campaignId);
        }

        // If user requested stop, treat as stopped (don't mark as Failed)
        if (meta && meta.stoppedByUser) {
          console.log('Campaign was stopped by user, marking as stopped');
          // Ensure DB already updated by stopCampaign; just resolve
          resolve();
          return;
        }

        if (code === 0) {
          await storage.updateStarsCampaign(campaignId, {
            status: 'Completed',
            completedAt: new Date().toISOString(),
            progress: 100
          });
          
          this.emit('status', { campaignId, status: 'Completed' });
          this.log(campaignId, 'success', 'Campaign completed successfully');
          resolve();
        } else {
          await storage.updateStarsCampaign(campaignId, {
            status: 'Failed',
            error: `Process exited with code ${code}`
          });
          
          this.emit('status', { campaignId, status: 'Failed' });
          this.log(campaignId, 'error', `Campaign failed with exit code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      // Handle process errors
      child.on('error', async (error) => {
        console.error('❌ Process error:', error);
        const meta = this.runningCampaigns.get(campaignId);
        if (meta) this.runningCampaigns.delete(campaignId);

        if (meta && meta.stoppedByUser) {
          // If user stopped, resolve quietly
          resolve();
          return;
        }

        await storage.updateStarsCampaign(campaignId, {
          status: 'Failed',
          error: error.message
        });
        
        this.emit('status', { campaignId, status: 'Failed' });
        this.log(campaignId, 'error', `Process error: ${error.message}`);
        reject(error);
      });
    });
  }

  async stopCampaign(campaignId) {
    try {
      console.log(`⏹️ Stopping Stars Campaign: ${campaignId}`);

      const meta = this.runningCampaigns.get(campaignId);
      if (meta) {
        // mark as stoppedByUser so close handler treats it as stopped
        meta.stoppedByUser = true;
        // kill the child process
        try {
          meta.child.kill('SIGTERM');
        } catch (e) {
          console.warn('Failed to kill child process:', e.message);
        }
      }

      await storage.updateStarsCampaign(campaignId, {
        status: 'Stopped',
        stoppedAt: new Date().toISOString()
      });

      this.emit('status', { campaignId, status: 'Stopped' });
      this.log(campaignId, 'warning', 'Campaign stopped by user');

    } catch (error) {
      console.error('❌ Error stopping stars campaign:', error);
      throw error;
    }
  }

  log(campaignId, level, message) {
    const logEntry = {
      campaignId,
      level,
      message,
      timestamp: new Date().toISOString()
    };
    // storage.appendLog is the actual storage method for appending logs
    // call it without awaiting so logging doesn't block campaign flow
    storage.appendLog(campaignId, logEntry);
    this.emit('log', logEntry);
  }
}

export const starsCampaignManager = new StarsCampaignManager();