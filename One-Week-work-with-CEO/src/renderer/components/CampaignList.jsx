import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Eye, Trash2, Clock, CheckCircle, XCircle, Loader, Hash, Link, Search, X, FileText, Download, Briefcase, Bot, Globe } from 'lucide-react';
import CampaignResultsModal from './CampaignResultsModal';
import RepoStatusModal from './RepoStatusModal';

const statusConfig = {
  Idle: { icon: Clock, color: 'text-neutral-400', bg: 'bg-neutral-800' },
  Running: { icon: Loader, color: 'text-blue-400', bg: 'bg-blue-500/10', animate: true },
  Completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  Failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  Stopped: { icon: Square, color: 'text-yellow-400', bg: 'bg-yellow-500/10' }
};

export default function CampaignList({ campaigns, onStart, onStop, onDelete }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [repoStatusCampaign, setRepoStatusCampaign] = useState(null);

  const handleExportLogs = async (campaignId, campaignName) => {
    if (window.api && window.api.getCampaignLogs) {
      const logs = await window.api.getCampaignLogs(campaignId);
      const logText = logs.map(log => {
        const time = new Date(log.timestamp).toISOString();
        return `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
      }).join('\n');

      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaignName}-logs.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Helper function to count items in a campaign
  const getItemCount = (campaign) => {
    if (campaign.category === 'apify' && campaign.apifyUrls) {
      return campaign.apifyUrls.split('\n').filter(line => line.trim()).length;
    } else if (campaign.category === 'upwork') {
      return (campaign.upworkSearchInput || campaign.upwork_search_input) ? 1 : 0;
    } else if (campaign.category === 'scrape-jobs') {
      const jobData = campaign.scrapeJobUrls || campaign.scrape_job_urls || '';
      return jobData ? jobData.split('---').filter(job => job.trim().length > 0).length : 0;
    } else if (campaign.category === 'va') {
      if (campaign.vaRepoType === 'multiple' && campaign.vaMultipleRepoDescriptions) {
        return campaign.vaMultipleRepoDescriptions.split('\n').filter(line => line.trim()).length;
      }
      return campaign.vaSingleRepoDescriptions ? 1 : 0;
    } else if (campaign.keywords) {
      if (typeof campaign.keywords === 'string') {
        return campaign.keywords.split('\n').filter(line => line.trim()).length;
      } else if (Array.isArray(campaign.keywords)) {
        return campaign.keywords.length;
      }
    }
    return 0;
  };

  // Helper function to count questions
  const getQuestionCount = (campaign) => {
    if (!campaign.questions) return 0;
    
    if (typeof campaign.questions === 'string') {
      const lines = campaign.questions.split('\n').filter(line => line.trim());
      return Math.floor(lines.length / 2);
    } else if (Array.isArray(campaign.questions)) {
      return campaign.questions.length;
    }
    return 0;
  };

  // Sort campaigns by most recent
  const sortedCampaigns = campaigns ? [...campaigns].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (typeof a.id === 'number' && typeof b.id === 'number') {
      return b.id - a.id;
    }
    return 0;
  }) : [];

  // Filter campaigns based on search query
  const filteredCampaigns = sortedCampaigns.filter(campaign => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const name = campaign.name?.toLowerCase() || '';
    
    return name.includes(query);
  });

  const handleRepoDeleted = (repoUrl) => {
    // Refresh the campaign list or update the selected campaign
    // You might want to emit an event or trigger a refresh here
    console.log('Repo deleted:', repoUrl);
  };

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 flex items-center justify-center">
          <Clock className="w-8 h-8 text-neutral-600" />
        </div>
        <h3 className="text-lg font-medium text-neutral-300 mb-2">No campaigns yet</h3>
        <p className="text-neutral-500">Create your first campaign to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            type="text"
            placeholder="Search campaigns by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-all"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>
              {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'campaign' : 'campaigns'} found
            </span>
            {filteredCampaigns.length === 0 && (
              <span className="text-neutral-500">Try a different search term</span>
            )}
          </div>
        )}

        {/* Campaign List */}
        {filteredCampaigns.length === 0 && searchQuery ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 flex items-center justify-center">
              <Search className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-300 mb-2">No campaigns found</h3>
            <p className="text-neutral-500">No campaigns match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredCampaigns.map((campaign) => {
                const config = statusConfig[campaign.status] || statusConfig.Idle;
                const Icon = config.icon;
                const isRunning = campaign.status === 'Running';
                const itemCount = getItemCount(campaign);
                const questionCount = getQuestionCount(campaign);
                const progress = campaign.progress || { processed: 0, total: itemCount };
                const progressPercent = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
                const successCount = campaign.results?.filter(r => r.status === 'success').length || 0;
                const failCount = campaign.results?.filter(r => r.status === 'failed').length || 0;
                const readmeOnlyCount = campaign.results?.filter(r => r.status === 'success' && !r.codeGenerated).length || 0;
                const hasResults = campaign.results && campaign.results.length > 0;
                const isCompleted = campaign.status === 'Completed' || campaign.status === 'Failed';

                return (
                  <motion.div
                    key={campaign.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Name & Info - Make clickable if has results OR is running */}
                      <div 
                        className={`flex-1 min-w-0 ${(hasResults && isCompleted) || isRunning ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (isRunning) {
                            setRepoStatusCampaign(campaign);
                          } else if (hasResults && isCompleted) {
                            setSelectedCampaign(campaign);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`text-base font-semibold text-white truncate ${(hasResults && isCompleted) || isRunning ? 'hover:text-purple-400 transition-colors' : ''}`}>
                            {campaign.name}
                          </h3>
                          {campaign.category && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800 text-xs text-neutral-400">
                              {campaign.category === 'apify' ? (
                                <>
                                  <Link className="w-3 h-3" />
                                  Apify
                                </>
                              ) : campaign.category === 'upwork' ? (
                                <>
                                  <Briefcase className="w-3 h-3" />
                                  Upwork
                                </>
                              ) : campaign.category === 'scrape-jobs' ? (
                                <>
                                  <Globe className="w-3 h-3" />
                                  Scrape Jobs
                                </>
                              ) : campaign.category === 'va' ? (
                                <>
                                  <Bot className="w-3 h-3" />
                                  VA
                                </>
                              ) : campaign.keywordsInputType === 'url' ? (
                                <>
                                  <Link className="w-3 h-3" />
                                  URLs
                                </>
                              ) : (
                                <>
                                  <Hash className="w-3 h-3" />
                                  Keywords
                                </>
                              )}
                            </span>
                          )}
                        </div>
                        {campaign.status === 'Failed' && (campaign.failure_reason || campaign.failureReason) && (
                          <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs" title={campaign.failure_reason || campaign.failureReason}>
                            ⚠ {campaign.failure_reason || campaign.failureReason}
                          </p>
                        )}
                        <p className="text-xs text-neutral-500">
                          {campaign.category === 'upwork'
                            ? (() => { const q = campaign.upworkSearchInput || campaign.upwork_search_input; return q ? `Search: "${q}"` : 'No search query'; })()
                            : campaign.category === 'scrape-jobs'
                            ? `${itemCount} job${itemCount !== 1 ? 's' : ''}`
                            : campaign.category === 'va'
                            ? (campaign.vaRepoType === 'multiple' ? `${itemCount} description${itemCount !== 1 ? 's' : ''}` : 'Single repo')
                            : campaign.category === 'apify'
                            ? `${itemCount} URL${itemCount !== 1 ? 's' : ''}`
                            : campaign.keywordsInputType === 'url'
                            ? `${itemCount} URL${itemCount !== 1 ? 's' : ''}`
                            : `${itemCount} keyword${itemCount !== 1 ? 's' : ''}`}
                          {questionCount > 0 && ` • ${questionCount} question${questionCount !== 1 ? 's' : ''}`}
                          {isRunning && ' • Click to view status'}
                          {hasResults && isCompleted && ' • Click to view results'}
                        </p>
                      </div>

                      {/* Status */}
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bg} whitespace-nowrap`}>
                        <Icon className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`} />
                        <span className={`text-sm font-medium ${config.color}`}>{campaign.status}</span>
                      </div>

                      {/* Progress/Results */}
                      {isRunning ? (
                        <div className="flex items-center gap-2 text-sm text-neutral-400 min-w-[100px]">
                          <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${progressPercent}%` }} 
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500" 
                            />
                          </div>
                          <span className="text-xs whitespace-nowrap">{progress.processed}/{progress.total}</span>
                        </div>
                      ) : hasResults && isCompleted ? (
                        <div className="flex items-center gap-3 text-sm min-w-[120px] justify-end">
                          {successCount > 0 && (
                            <span className="text-green-400 font-medium flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {successCount}
                            </span>
                          )}
                          {readmeOnlyCount > 0 && (
                            <span className="text-yellow-400 font-medium flex items-center gap-1" title={`${readmeOnlyCount} repo(s) with README only`}>
                              <FileText className="w-3.5 h-3.5" />
                              {readmeOnlyCount}
                            </span>
                          )}
                          {failCount > 0 && (
                            <span className="text-red-400 font-medium flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              {failCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-[120px]" />
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!isRunning ? (
                          <button 
                            onClick={() => onStart(campaign.id)} 
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
                          >
                            <Play className="w-4 h-4" /> Start
                          </button>
                        ) : (
                          <button 
                            onClick={() => onStop(campaign.id)} 
                            className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500 text-red-400 text-sm font-medium flex items-center gap-2 transition-all"
                          >
                            <Square className="w-4 h-4" /> Stop
                          </button>
                        )}
                        <button 
                          onClick={() => handleExportLogs(campaign.id, campaign.name)} 
                          className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-400 hover:text-white transition-all"
                          title="Export Logs"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {!isRunning && onDelete && (
                          <button 
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
                                onDelete(campaign.id);
                              }
                            }} 
                            className="p-2 rounded-lg bg-neutral-800 hover:bg-red-500/10 border border-neutral-700 hover:border-red-500 text-neutral-400 hover:text-red-400 transition-all"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Results Modal */}
      <AnimatePresence>
        {selectedCampaign && (
          <CampaignResultsModal
            campaign={selectedCampaign}
            onClose={() => setSelectedCampaign(null)}
            onRepoDeleted={handleRepoDeleted}
          />
        )}
      </AnimatePresence>

      {/* Repo Status Modal */}
      <AnimatePresence>
        {repoStatusCampaign && (
          <RepoStatusModal
            campaign={repoStatusCampaign}
            onClose={() => setRepoStatusCampaign(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}