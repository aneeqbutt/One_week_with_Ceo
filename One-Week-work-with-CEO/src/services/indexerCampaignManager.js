import EventEmitter from 'events';
import { storage } from './storage.js';
import { indexerCheckerService } from './indexerCheckerService.js';

class IndexerCampaignManager extends EventEmitter {
  constructor() {
    super();
    this.runningCampaigns = new Map();
  }

  /**
   * Start an indexer campaign
   */
  async startCampaign(campaignId) {
    try {
      console.log(`\n▶️ Starting indexer campaign: ${campaignId}`);

      // Check if already running
      if (this.runningCampaigns.has(campaignId)) {
        console.log('⚠️ Campaign already running');
        return;
      }

      // Get campaign from storage
      const campaign = await storage.getIndexerCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      console.log('📋 Campaign details:', {
        name: campaign.name,
        totalItems: campaign.items ? campaign.items.length : 1
      });

      // Mark as running
      this.runningCampaigns.set(campaignId, true);

      // Update status to Running
      await storage.updateIndexerCampaign(campaignId, {
        status: 'Running',
        startedAt: new Date(),
        progress: {
          processed: 0,
          total: campaign.items ? campaign.items.length : 1
        }
      });

      this.emitStatus(campaignId, 'Running');
      this.emitLog(campaignId, 'info', '🚀 Starting index check campaign...');

      const results = [];
      const items = campaign.items || [];

      // Process each item sequentially
      for (let i = 0; i < items.length; i++) {
        // Check if campaign was stopped
        if (!this.runningCampaigns.has(campaignId)) {
          console.log('⚠️ Campaign was stopped by user');
          this.emitLog(campaignId, 'info', '⏹️ Campaign stopped by user');
          
          await storage.updateIndexerCampaign(campaignId, {
            status: 'Stopped',
            results: results,
            progress: {
              processed: i,
              total: items.length
            }
          });
          
          return;
        }

        const item = items[i];
        
        try {
          this.emitLog(campaignId, 'info', `\n� Processing item ${i + 1}/${items.length}`);
          this.emitLog(campaignId, 'info', `🔍 Keyword: "${item.searchQuery}"`);
          this.emitLog(campaignId, 'info', `🔗 Repository: ${item.repoUrl}`);
          
          const result = await indexerCheckerService.checkIndexing(
            item.searchQuery,
            item.repoUrl,
            item.searchType || 'keyword'
          );

          // Add item info to result
          result.searchQuery = item.searchQuery;
          result.repoUrl = item.repoUrl;
          result.status = 'success';

          results.push(result);

          if (result.indexed) {
            this.emitLog(campaignId, 'success', `✅ Repository is INDEXED on Google!`);
            this.emitLog(campaignId, 'success', `📍 Found at position: ${result.position}`);
          } else {
            this.emitLog(campaignId, 'info', `❌ Repository NOT FOUND in search results`);
          }

          // Update progress
          await storage.updateIndexerCampaign(campaignId, {
            results: results,
            progress: {
              processed: i + 1,
              total: items.length
            }
          });

          this.emitStatus(campaignId, 'Running', { 
            results, 
            progress: { processed: i + 1, total: items.length } 
          });

        } catch (error) {
          console.error('❌ Error checking item:', error);
          
          this.emitLog(campaignId, 'error', `❌ Error: ${error.message}`);
          
          results.push({
            searchQuery: item.searchQuery,
            repoUrl: item.repoUrl,
            status: 'failed',
            indexed: false,
            error: error.message
          });

          // Update progress even on error
          await storage.updateIndexerCampaign(campaignId, {
            results: results,
            progress: {
              processed: i + 1,
              total: items.length
            }
          });
        }

        // Add delay between items if not the last one
        if (i < items.length - 1 && this.runningCampaigns.has(campaignId)) {
          const delay = 5000; // 5 seconds between items
          this.emitLog(campaignId, 'info', `⏱️ Waiting ${delay / 1000}s before next item...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Campaign completed
      this.emitLog(campaignId, 'info', '\n✅ Campaign completed!');
      
      const successCount = results.filter(r => r.indexed).length;
      const failCount = results.filter(r => !r.indexed && r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'failed').length;
      
      this.emitLog(campaignId, 'info', `📊 Results: ${successCount} indexed, ${failCount} not found, ${errorCount} errors`);

      await storage.updateIndexerCampaign(campaignId, {
        status: 'Completed',
        results: results,
        completedAt: new Date(),
        progress: {
          processed: items.length,
          total: items.length
        }
      });

      this.emitStatus(campaignId, 'Completed', { results });

      // Remove from running campaigns
      this.runningCampaigns.delete(campaignId);

    } catch (error) {
      console.error('❌ Error starting campaign:', error);
      
      this.emitLog(campaignId, 'error', `❌ Campaign error: ${error.message}`);
      
      await storage.updateIndexerCampaign(campaignId, {
        status: 'Failed',
        error: error.message,
        completedAt: new Date()
      });

      this.emitStatus(campaignId, 'Failed');
      this.runningCampaigns.delete(campaignId);
      throw error;
    }
  }

  /**
   * Stop a running campaign
   */
  async stopCampaign(campaignId) {
    try {
      console.log(`⏹️ Stopping indexer campaign: ${campaignId}`);

      if (!this.runningCampaigns.has(campaignId)) {
        console.log('⚠️ Campaign is not running');
        return;
      }

      // Remove from running campaigns
      this.runningCampaigns.delete(campaignId);

      // Update status
      await storage.updateIndexerCampaign(campaignId, {
        status: 'Stopped'
      });

      this.emitStatus(campaignId, 'Stopped');
      this.emitLog(campaignId, 'info', '⏹️ Campaign stopped by user');

      console.log('✅ Campaign stopped');
    } catch (error) {
      console.error('❌ Error stopping campaign:', error);
      throw error;
    }
  }

  /**
   * Emit log message
   */
  emitLog(campaignId, level, message) {
    const logEntry = {
      campaignId,
      level,
      message,
      timestamp: Date.now()
    };

    console.log(`[${level.toUpperCase()}] ${message}`);
    this.emit('log', logEntry);

    // Store log in database
    storage.appendLog(campaignId, logEntry).catch(err => {
      console.error('Error storing log:', err);
    });
  }

  /**
   * Emit status update
   */
  emitStatus(campaignId, status, result = null) {
    const statusData = {
      campaignId,
      status,
      result,
      timestamp: Date.now()
    };

    console.log(`📊 Status Update - Campaign: ${campaignId}, Status: ${status}`);
    this.emit('status', statusData);
  }
}

// Create singleton instance
const indexerCampaignManager = new IndexerCampaignManager();

export { indexerCampaignManager };
