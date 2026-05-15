import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader, CheckCircle, XCircle, ExternalLink, User, FileCode, Folder, Clock } from 'lucide-react';

export default function RepoStatusModal({ campaign, onClose }) {
  const [deletingRepo, setDeletingRepo] = useState(null);

  // Get current results from campaign
  const results = campaign.results || [];
  const successfulRepos = results.filter(r => r.status === 'success');
  const failedRepos = results.filter(r => r.status === 'failed');
  const inProgressCount = (campaign.progress?.total || 0) - results.length;

  const handleDeleteRepo = async (repoUrl, repoName) => {
    if (!confirm(`Are you sure you want to delete the repository "${repoName}"?`)) {
      return;
    }

    try {
      setDeletingRepo(repoUrl);
      const accounts = await window.api.listGithubAccounts();
      
      // Extract repo name from URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        throw new Error('Invalid repository URL');
      }
      
      const [, owner, repo] = match;
      const account = accounts.find(acc => acc.username.toLowerCase() === owner.toLowerCase());
      
      if (!account) {
        throw new Error(`No GitHub account found for username: ${owner}`);
      }

      await window.api.deleteGithubRepo(account.id, owner, repo);
      
      // Update campaign results to remove the deleted repo
      const updatedResults = campaign.results.filter(r => r.repoUrl !== repoUrl);
      campaign.results = updatedResults;
      
      // Trigger re-render by closing and reopening if needed
      onClose();
    } catch (error) {
      console.error('Failed to delete repository:', error);
      alert(`Failed to delete repository: ${error.message}`);
    } finally {
      setDeletingRepo(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/95 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Campaign In Progress
            </h2>
            <p className="text-sm text-neutral-400 mt-1">{campaign.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 bg-neutral-800/50 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{successfulRepos.length}</div>
            <div className="text-xs text-neutral-400 mt-1">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{inProgressCount}</div>
            <div className="text-xs text-neutral-400 mt-1">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{failedRepos.length}</div>
            <div className="text-xs text-neutral-400 mt-1">Failed</div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] px-6 py-4">
          {/* In Progress Section */}
          {inProgressCount > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                Processing ({inProgressCount} remaining)
              </h3>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-sm text-neutral-300">
                  Campaign is actively processing jobs. New repositories will appear here as they complete.
                </p>
              </div>
            </div>
          )}

          {/* Successful Repos */}
          {successfulRepos.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Completed Repositories ({successfulRepos.length})
              </h3>
              <div className="space-y-3">
                {successfulRepos.map((result, idx) => (
                  <motion.div
                    key={result.repoUrl || idx}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 hover:border-green-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Folder className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <a
                            href={result.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-white hover:text-green-400 transition-colors truncate flex items-center gap-1.5"
                          >
                            {result.repoName || 'Repository'}
                            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          </a>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-neutral-400">
                          {result.account && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              <span>{result.account}</span>
                            </div>
                          )}
                          {result.filesPushed > 0 && (
                            <div className="flex items-center gap-1.5">
                              <FileCode className="w-3.5 h-3.5" />
                              <span>{result.filesPushed} files</span>
                            </div>
                          )}
                          {result.codeGenerated && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                              Code Generated
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Button - Only for successful repos */}
                      <button
                        onClick={() => handleDeleteRepo(result.repoUrl, result.repoName)}
                        disabled={deletingRepo === result.repoUrl}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {deletingRepo === result.repoUrl ? (
                          <>
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          'Delete'
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Repos */}
          {failedRepos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Failed ({failedRepos.length})
              </h3>
              <div className="space-y-3">
                {failedRepos.map((result, idx) => (
                  <motion.div
                    key={result.repoUrl || idx}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/5 border border-red-500/20 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white mb-1">{result.repoName || 'Repository'}</p>
                        {result.error && (
                          <p className="text-xs text-neutral-400 break-words">{result.error}</p>
                        )}
                        {result.account && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-neutral-500">
                            <User className="w-3.5 h-3.5" />
                            <span>{result.account}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {results.length === 0 && (
            <div className="text-center py-12">
              <Loader className="w-12 h-12 text-neutral-600 mx-auto mb-3 animate-spin" />
              <p className="text-neutral-400">Processing jobs...</p>
              <p className="text-sm text-neutral-500 mt-1">Repositories will appear here as they complete</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex justify-end bg-neutral-900/95 backdrop-blur-sm">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
