import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Trash2, Clock, CheckCircle, XCircle, Loader, Search, Globe, X } from 'lucide-react';

export default function ViewCampaignList({ campaigns, onStart, onStop, onDelete, onRefresh }) {
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Running':
        return <Loader className="w-4 h-4 animate-spin text-blue-400" />;
      case 'Completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'Failed':
      case 'Stopped':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Running':
        return 'text-blue-400 bg-blue-500/20';
      case 'Completed':
        return 'text-green-400 bg-green-500/20';
      case 'Failed':
        return 'text-red-400 bg-red-500/20';
      case 'Stopped':
        return 'text-orange-400 bg-orange-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getProgressPercentage = (campaign) => {
    if (!campaign.progress) return 0;
    return Math.round((campaign.progress.completed / campaign.progress.total) * 100);
  };

  // Sort campaigns by most recent
  const sortedCampaigns = campaigns ? [...campaigns].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return 0;
  }) : [];

  // Filter campaigns based on search query
  const filteredCampaigns = sortedCampaigns.filter(campaign => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const name = campaign.name?.toLowerCase() || '';
    const repoUrl = campaign.repoUrl?.toLowerCase() || '';
    const searchQueryText = campaign.searchQuery?.toLowerCase() || '';
    
    return name.includes(query) || repoUrl.includes(query) || searchQueryText.includes(query);
  });

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 flex items-center justify-center">
          <Globe className="w-8 h-8 text-neutral-600" />
        </div>
        <h3 className="text-lg font-medium text-neutral-300 mb-2">No view campaigns yet</h3>
        <p className="text-neutral-500">Create your first campaign to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
        <input
          type="text"
          placeholder="Search campaigns by name, repo URL, or query..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-12 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
            {filteredCampaigns.map((campaign) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                layout
                className="bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-blue-500/50 transition-all overflow-hidden"
              >
                {/* Campaign Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white truncate">
                          {campaign.name}
                        </h3>
                        <div className={`px-3 py-1 rounded-full flex items-center gap-2 ${getStatusColor(campaign.status)}`}>
                          {getStatusIcon(campaign.status)}
                          <span className="text-xs font-medium">{campaign.status}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-neutral-400">
                        <div className="flex items-center gap-2">
                          {campaign.searchType === 'keyword' ? (
                            <Search className="w-4 h-4" />
                          ) : (
                            <Globe className="w-4 h-4" />
                          )}
                          <span className="capitalize">{campaign.searchType}</span>
                        </div>
                        <span>•</span>
                        <span>{campaign.numViews} views</span>
                        <span>•</span>
                        <span>Created {formatDate(campaign.createdAt)}</span>
                      </div>

                      {/* Search Query */}
                      <div className="mt-3 text-sm">
                        <span className="text-neutral-500">Query: </span>
                        <span className="text-neutral-300">{campaign.searchQuery}</span>
                      </div>

                      {/* Repo URL */}
                      <div className="mt-1 text-sm">
                        <span className="text-neutral-500">Repository: </span>
                        <a
                          href={campaign.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          {campaign.repoUrl}
                        </a>
                      </div>

                      {/* Progress Bar */}
                      {campaign.progress && campaign.progress.total > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-neutral-400">Progress</span>
                            <span className="text-neutral-300">
                              {campaign.progress.completed} / {campaign.progress.total} ({getProgressPercentage(campaign)}%)
                            </span>
                          </div>
                          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${getProgressPercentage(campaign)}%` }}
                              transition={{ duration: 0.5 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* Results */}
                      {campaign.results && campaign.results.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {expandedCampaign === campaign.id ? 'Hide' : 'Show'} results ({campaign.results.length})
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {campaign.status === 'Idle' && (
                        <button
                          onClick={() => onStart(campaign.id)}
                          className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/30"
                          title="Start Campaign"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {campaign.status === 'Running' && (
                        <button
                          onClick={() => onStop(campaign.id)}
                          className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl transition-all shadow-lg shadow-orange-500/30"
                          title="Stop Campaign"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {campaign.status !== 'Running' && (
                        <button
                          onClick={() => onDelete(campaign.id)}
                          className="p-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all shadow-lg shadow-red-500/30"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Results */}
                {expandedCampaign === campaign.id && campaign.results && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-neutral-800 bg-neutral-950"
                  >
                    <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
                      {campaign.results.map((result, index) => (
                        <div
                          key={index}
                          className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-neutral-300">
                              View #{index + 1}
                            </span>
                            {result.success ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          {result.profileId && (
                            <p className="text-xs text-neutral-500">
                              Profile: {result.profileId}
                            </p>
                          )}
                          {result.error && (
                            <p className="text-xs text-red-400 mt-1">
                              Error: {result.error}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
