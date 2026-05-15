import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Trash2, CheckCircle, XCircle, Clock, Loader, Search, ExternalLink } from 'lucide-react';

export default function IndexerCampaignList({ campaigns, onStart, onStop, onDelete }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Running':
        return 'from-blue-500 to-cyan-500';
      case 'Completed':
        return 'from-green-500 to-emerald-500';
      case 'Failed':
        return 'from-red-500 to-pink-500';
      case 'Stopped':
        return 'from-yellow-500 to-orange-500';
      default:
        return 'from-neutral-600 to-neutral-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Running':
        return <Loader className="w-3.5 h-3.5 animate-spin" />;
      case 'Completed':
        return <CheckCircle className="w-3.5 h-3.5" />;
      case 'Failed':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'Stopped':
        return <Square className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 flex items-center justify-center">
          <Search className="w-8 h-8 text-neutral-600" />
        </div>
        <h3 className="text-lg font-medium text-neutral-300 mb-2">No campaigns yet</h3>
        <p className="text-neutral-500">Create your first indexer check campaign to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {campaigns.map((campaign, index) => (
          <motion.div
            key={campaign.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: index * 0.05 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-green-500/30 transition-all group"
          >
            <div className="flex items-start justify-between">
              {/* Campaign Info */}
              <div className="flex-1 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Search className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="text-base font-semibold text-white group-hover:text-green-400 transition-colors truncate">
                        {campaign.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white bg-gradient-to-r ${getStatusColor(
                          campaign.status
                        )} flex-shrink-0`}
                      >
                        {getStatusIcon(campaign.status)}
                        {campaign.status}
                      </span>
                      {campaign.items && campaign.items.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                          {campaign.items.length} {campaign.items.length === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {campaign.status === 'Running' && campaign.progress ? (
                        <span>Processing {campaign.progress.processed}/{campaign.progress.total} items</span>
                      ) : (
                        <span>Checking if repositories appear in Google search for specified keywords</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Campaign Details */}
                <div className="pl-13 space-y-3">
                  {/* Show all items if campaign hasn't run yet or is running */}
                  {(!campaign.results || campaign.results.length === 0) && campaign.items && campaign.items.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-neutral-500 mb-2">Items to Check:</div>
                      {campaign.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-xs text-neutral-400">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="text-xs text-neutral-500">Keyword:</div>
                            <div className="text-sm text-white font-medium">{item.searchQuery}</div>
                            <div className="text-xs text-neutral-500 mt-2">Repository:</div>
                            <a
                              href={item.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-green-400 hover:text-green-300 flex items-center gap-1 group/link"
                              onClick={(e) => {
                                e.preventDefault();
                                if (window.api && window.api.openExternal) {
                                  window.api.openExternal(item.repoUrl);
                                }
                              }}
                            >
                              <span className="truncate">{item.repoUrl.replace('https://github.com/', '')}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60 group-hover/link:opacity-100 transition-opacity" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Index Results */}
                {campaign.results && campaign.results.length > 0 && campaign.status === 'Completed' && (
                  <div className="pl-13 mt-4 space-y-3">
                    <div className="text-xs text-neutral-500 mb-2">Results:</div>
                    {campaign.results.map((result, idx) => (
                      <div key={idx}>
                        {result.indexed && result.foundUrl ? (
                          <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-green-400 mb-2">✅ Indexed!</div>
                                <div className="space-y-1 text-xs">
                                  <div>
                                    <span className="text-neutral-400">Keyword: </span>
                                    <span className="text-neutral-200">{result.searchQuery}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-400">Repository: </span>
                                    <a
                                      href={result.repoUrl}
                                      className="text-green-400 hover:text-green-300"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (window.api && window.api.openExternal) {
                                          window.api.openExternal(result.repoUrl);
                                        }
                                      }}
                                    >
                                      {result.repoUrl.replace('https://github.com/', '')}
                                    </a>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-neutral-400">Position:</span>
                                    <span className="text-white font-semibold bg-green-500/20 px-2 py-0.5 rounded">
                                      #{result.position || 'N/A'}
                                    </span>
                                  </div>
                                  {result.title && (
                                    <div className="mt-1">
                                      <span className="text-neutral-400">Title: </span>
                                      <span className="text-neutral-200">{result.title}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : result.status === 'failed' ? (
                          <div className="p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <XCircle className="w-5 h-5 text-red-400" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-red-400 mb-2">❌ Error</div>
                                <div className="space-y-1 text-xs">
                                  <div>
                                    <span className="text-neutral-400">Keyword: </span>
                                    <span className="text-neutral-200">{result.searchQuery}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-400">Repository: </span>
                                    <span className="text-neutral-200">{result.repoUrl.replace('https://github.com/', '')}</span>
                                  </div>
                                  <div className="text-red-400 mt-2">{result.error}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                <XCircle className="w-5 h-5 text-yellow-400" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-yellow-400 mb-2">⚠️ Not Found</div>
                                <div className="space-y-1 text-xs">
                                  <div>
                                    <span className="text-neutral-400">Keyword: </span>
                                    <span className="text-neutral-200">{result.searchQuery}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-400">Repository: </span>
                                    <a
                                      href={result.repoUrl}
                                      className="text-yellow-400 hover:text-yellow-300"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        if (window.api && window.api.openExternal) {
                                          window.api.openExternal(result.repoUrl);
                                        }
                                      }}
                                    >
                                      {result.repoUrl.replace('https://github.com/', '')}
                                    </a>
                                  </div>
                                  <div className="text-neutral-400 mt-2">Not found in first page of Google results</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Failed Status */}
                {campaign.status === 'Failed' && campaign.error && (
                  <div className="pl-13 mt-4">
                    <div className="p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                        <div className="flex-1">
                          <div className="text-base font-semibold text-red-400 mb-2">Error Occurred</div>
                          <div className="text-sm text-neutral-300 bg-neutral-900/50 px-3 py-2 rounded-lg border border-neutral-800">
                            {campaign.error}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                {campaign.status === 'Idle' || campaign.status === 'Stopped' || campaign.status === 'Failed' ? (
                  <button
                    onClick={() => onStart(campaign.id)}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
                    title="Start Check"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                ) : campaign.status === 'Running' ? (
                  <button
                    onClick={() => onStop(campaign.id)}
                    className="p-2.5 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white transition-all"
                    title="Stop Check"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : null}

                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
                      onDelete(campaign.id);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-all"
                  title="Delete Campaign"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
