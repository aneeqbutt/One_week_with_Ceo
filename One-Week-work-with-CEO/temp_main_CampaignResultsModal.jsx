import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Trash2, CheckCircle, XCircle, Loader, FileText } from 'lucide-react';

export default function CampaignResultsModal({ campaign, onClose, onRepoDeleted }) {
  const [deletingRepos, setDeletingRepos] = useState(new Set());
  const handleOpenUrl = async (url) => {
    try {
      await window.api.openExternal(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
      alert('Failed to open URL in browser');
    }
  };

  const handleDeleteRepo = async (result) => {
    if (!result.repoUrl || !result.account) return;

    const repoName = result.repoName || result.repoUrl.split('/').pop();
    
    if (!confirm(`Are you sure you want to delete the repository "${repoName}"?\n\nThis action cannot be undone!`)) {
      return;
    }

    setDeletingRepos(prev => new Set([...prev, result.repoUrl]));

    try {
      // Extract owner from repo URL
      const urlParts = result.repoUrl.split('/');
      const owner = urlParts[urlParts.length - 2];
      
      // Get the account ID from the campaign's account group
      const accounts = await window.api.listGithubAccounts(campaign.accountGroupId);
      const account = accounts.find(acc => acc.username === result.account);
      
      if (!account) {
        throw new Error('Account not found');
      }

      await window.api.deleteGithubRepo(owner, repoName, account.id);
      
      // Notify parent component
      if (onRepoDeleted) {
        onRepoDeleted(result.repoUrl);
      }

      alert(`Repository "${repoName}" has been deleted successfully!`);
    } catch (error) {
      console.error('Failed to delete repository:', error);
      alert(`Failed to delete repository: ${error.message}`);
    } finally {
      setDeletingRepos(prev => {
        const newSet = new Set(prev);
        newSet.delete(result.repoUrl);
        return newSet;
      });
    }
  };

  const results = campaign.results || [];
  const successfulRepos = results.filter(r => r.status === 'success');
  const failedRepos = results.filter(r => r.status === 'failed');
  const readmeOnlyRepos = successfulRepos.filter(r => !r.codeGenerated);
  const fullRepos = successfulRepos.filter(r => r.codeGenerated);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <div>
            <h2 className="text-xl font-bold text-white">{campaign.name}</h2>
            <div className="flex items-center gap-3 text-sm mt-1">
              {fullRepos.length > 0 && (
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {fullRepos.length} with code
                </span>
              )}
              {readmeOnlyRepos.length > 0 && (
                <span className="text-yellow-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {readmeOnlyRepos.length} README only
                </span>
              )}
              {failedRepos.length > 0 && (
                <span className="text-red-400 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {failedRepos.length} failed
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-400">No results yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => {
                const isSuccess = result.status === 'success';
                const isDeleting = deletingRepos.has(result.repoUrl);

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-xl border ${
                      isSuccess
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {isSuccess ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white truncate">
                            {result.repoName || result.item}
                          </h3>
                          {result.account && (
                            <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                              @{result.account}
                            </span>
                          )}
                          {/* Code Not Generated Tag */}
                          {isSuccess && !result.codeGenerated && (
                            <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                              README Only
                            </span>
                          )}
                        </div>

                        {isSuccess ? (
                          <>
                            <button
                              onClick={() => handleOpenUrl(result.repoUrl)}
                              className="text-sm text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 w-fit cursor-pointer"
                            >
                              {result.repoUrl}
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            {/* Show code generation status */}
                            {result.codeGenerated && result.filesPushed > 0 ? (
                              <p className="text-xs text-neutral-500 mt-1">
                                G£‡ {result.filesPushed} code files pushed
                              </p>
                            ) : result.codeGenerated === false ? (
                              <p className="text-xs text-yellow-500 mt-1">
                                G‹·n+≈ Repository created with README only (code generation failed)
                              </p>
                            ) : (
                              result.filesGenerated > 0 && (
                                <p className="text-xs text-neutral-500 mt-1">
                                  {result.filesGenerated} files generated
                                </p>
                              )
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-red-400">
                            {result.error || 'Failed to create repository'}
                          </p>
                        )}
                      </div>

                      {/* Delete Button - Only for successful repos */}
                      {isSuccess && (
                        <button
                          onClick={() => handleDeleteRepo(result)}
                          disabled={isDeleting}
                          className="flex-shrink-0 p-2 rounded-lg bg-neutral-800 hover:bg-red-500/10 border border-neutral-700 hover:border-red-500 text-neutral-400 hover:text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete Repository"
                        >
                          {isDeleting ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

