import React from 'react';
import { motion } from 'framer-motion';
import { Play, Square, Trash2, FileText, Star, Clock, CheckCircle2, Loader } from 'lucide-react';

export default function StarsCampaignList({ campaigns, onStart, onStop, onViewLogs, onDelete }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'Running':
        return 'from-orange-500 to-yellow-500';
      case 'Completed':
        return 'from-green-500 to-emerald-500';
      case 'Stopped':
        return 'from-neutral-500 to-neutral-600';
      case 'Failed':
        return 'from-red-500 to-rose-500';
      default:
        return 'from-neutral-500 to-neutral-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Running':
        return <Loader className="w-4 h-4 animate-spin" />;
      case 'Completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'Stopped':
        return <Square className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
          <Star className="w-8 h-8 text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Star Campaigns Yet</h3>
        <p className="text-neutral-400 text-sm max-w-md mx-auto">
          Create your first campaign to start automating GitHub repository starring with GoLogin profiles
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign, index) => (
        <motion.div
          key={campaign.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-yellow-500/30 transition-all group"
        >
          <div className="flex items-start justify-between">
            {/* Left Side - Info */}
            <div className="flex-1 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-yellow-400 transition-colors">
                    {campaign.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white bg-gradient-to-r ${getStatusColor(
                        campaign.status
                      )}`}
                    >
                      {getStatusIcon(campaign.status)}
                      {campaign.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-13">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Keyword</div>
                  <div className="text-sm text-white font-medium">{campaign.keyword}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Target URL</div>
                  <div className="text-sm text-white font-medium truncate" title={campaign.targetUrl}>
                    {campaign.targetUrl}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Folder</div>
                  <div className="text-sm text-white font-medium">{campaign.folderName || 'N/A'}</div>
                </div>
              </div>

              {/* Progress Bar (if running) */}
              {campaign.status === 'Running' && campaign.progress !== undefined && (
                <div className="pl-13 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Progress</span>
                    <span className="text-white font-medium">
                      {campaign.currentProfile || 0} / {campaign.totalProfiles || 0} profiles
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${campaign.progress}%` }}
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                    />
                  </div>
                </div>
              )}

              {/* Stats (if completed) */}
              {campaign.status === 'Completed' && (
                <div className="flex items-center gap-6 pl-13 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-neutral-400">Successful:</span>
                    <span className="text-white font-medium">{campaign.stats?.successful || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-neutral-400">Skipped:</span>
                    <span className="text-white font-medium">{campaign.stats?.skipped || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-neutral-400">Failed:</span>
                    <span className="text-white font-medium">{campaign.stats?.failed || 0}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center gap-2 ml-4">
              {campaign.status === 'Idle' || campaign.status === 'Stopped' ? (
                <button
                  onClick={() => onStart(campaign.id)}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white transition-all shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50"
                  title="Start Campaign"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : campaign.status === 'Running' ? (
                <button
                  onClick={() => onStop(campaign.id)}
                  className="p-2.5 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white transition-all"
                  title="Stop Campaign"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : null}

              {/* <button
                onClick={() => onViewLogs(campaign.id)}
                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all"
                title="View Logs"
              >
                <FileText className="w-4 h-4" />
              </button> */}

              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this campaign?')) {
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
    </div>
  );
}