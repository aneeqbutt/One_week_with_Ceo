import { EventEmitter } from 'events';
import { storage } from './storage.js';
import { runViewBot } from './viewBotRunner.js';

class ViewCampaignManager extends EventEmitter {
  constructor() {
    super();
    this.running = new Map();
    console.log('ViewCampaignManager initialized');
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

  setStatus(campaignId, status) {
    console.log(`Setting view campaign ${campaignId} status to: ${status}`);
    storage.updateViewCampaign(campaignId, { status });
    this.emit('status', { campaignId, status });
  }

  updateProgress(campaignId, completed, total) {
    const progress = { completed, total };
    console.log(`Progress update: ${completed}/${total}`);
    storage.updateViewCampaign(campaignId, { progress });
    this.emit('progress', { campaignId, ...progress });
  }

  async startCampaign(id) {
    console.log('\n===== STARTING VIEW CAMPAIGN =====');
    console.log('Campaign ID:', id);
    
    if (this.running.get(id)) {
      console.log('View campaign is already running');
      this.log(id, 'warning', 'Campaign is already running');
      return;
    }

    this.running.set(id, true);
    this.setStatus(id, 'Running');

    const campaign = await storage.getViewCampaign(id);

    if (!campaign) {
      console.error('View campaign not found:', id);
      this.log(id, 'error', 'Campaign not found');
      this.setStatus(id, 'Failed');
      this.running.delete(id);
      return;
    }

    console.log('View campaign found:', campaign.name);
    console.log('Search Type:', campaign.searchType);
    console.log('Search Query:', campaign.searchQuery);
    console.log('Repo URL:', campaign.repoUrl);
    console.log('Number of Views:', campaign.numViews);

    try {
      this.log(id, 'info', `Starting ${campaign.numViews} view(s) for repo: ${campaign.repoUrl}`);
      this.updateProgress(id, 0, campaign.numViews);

      const results = [];

      // Run the view bot for the specified number of views
      for (let i = 0; i < campaign.numViews; i++) {
        if (!this.running.get(id)) {
          this.log(id, 'info', 'Campaign stopped by user');
          break;
        }

        this.log(id, 'info', `View ${i + 1}/${campaign.numViews}: Starting...`);

        try {
          const result = await runViewBot({
            viewNumber: i + 1,
            totalViews: campaign.numViews,
            searchType: campaign.searchType,
            searchQuery: campaign.searchQuery,
            repoUrl: campaign.repoUrl,
            logFn: (msg) => this.log(id, 'info', msg)
          });

          results.push({
            viewNumber: i + 1,
            status: 'success',
            timestamp: new Date().toISOString(),
            ...result
          });

          this.log(id, 'success', `View ${i + 1}/${campaign.numViews}: Completed successfully`);
        } catch (error) {
          console.error(`View ${i + 1} failed:`, error.message);
          this.log(id, 'error', `View ${i + 1}/${campaign.numViews}: Failed - ${error.message}`);
          
          results.push({
            viewNumber: i + 1,
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }

        // Update progress
        this.updateProgress(id, i + 1, campaign.numViews);

        // Add delay between views (except for the last one)
        if (i < campaign.numViews - 1 && this.running.get(id)) {
          this.log(id, 'info', 'Waiting before next view...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // Save results
      await storage.updateViewCampaign(id, { results });

      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'failed').length;

      console.log('\n===== VIEW CAMPAIGN COMPLETED =====');
      console.log('Successful:', successCount);
      console.log('Failed:', failCount);

      if (successCount === 0) {
        this.log(id, 'error', `Campaign failed: All ${failCount} view(s) failed`);
        this.setStatus(id, 'Failed');
      } else {
        this.log(id, 'success', `Campaign completed: ${successCount} succeeded, ${failCount} failed`);
        this.setStatus(id, 'Completed');
      }

    } catch (error) {
      console.error('View campaign failed:', error.message);
      this.log(id, 'error', `Campaign failed: ${error.message}`);
      this.setStatus(id, 'Failed');
    } finally {
      this.running.delete(id);
      console.log('View campaign execution finished');
    }
  }

  async stopCampaign(id) {
    console.log(`Stopping view campaign: ${id}`);
    
    if (!this.running.get(id)) {
      console.log('View campaign is not running');
      this.log(id, 'warning', 'Campaign is not running');
      return;
    }
    
    this.log(id, 'info', 'Stopping campaign...');
    this.running.delete(id);
    this.setStatus(id, 'Stopped');
    console.log('View campaign stopped');
  }
}

export const viewCampaignManager = new ViewCampaignManager();
