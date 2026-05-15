import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Search, Link2, Folder, AlertCircle } from 'lucide-react';

export default function CreateStarsCampaignModal({ open, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    keyword: '',
    targetUrl: '',
    folderId: ''
  });
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch GoLogin folders when modal opens
  useEffect(() => {
    if (open) {
      fetchFolders();
    }
  }, [open]);

  const fetchFolders = async () => {
    try {
      if (window.api && window.api.getGoLoginFolders) {
        const folderList = await window.api.getGoLoginFolders();
        setFolders(folderList || []);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate form
      if (!formData.name.trim()) {
        throw new Error('Campaign name is required');
      }
      if (!formData.keyword.trim()) {
        throw new Error('Search keyword is required');
      }
      if (!formData.targetUrl.trim()) {
        throw new Error('Target URL is required');
      }
      if (!formData.folderId) {
        throw new Error('Please select a GoLogin folder');
      }

      // Find selected folder name so we pass both id and name to backend
      const selectedFolder = folders.find(f => f.id === formData.folderId);
      const payload = {
        ...formData,
        folderName: selectedFolder ? selectedFolder.name : ''
      };

      await onCreate(payload);
      
      // Reset form
      setFormData({
        name: '',
        keyword: '',
        targetUrl: '',
        folderId: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-red-500/10 border-b border-neutral-800 p-6">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-red-500/5 animate-pulse" />
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                      <Star className="w-6 h-6 text-white fill-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Create Stars Campaign</h2>
                      <p className="text-sm text-neutral-400">Configure your GitHub starring automation</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-red-400">Error</div>
                      <div className="text-sm text-red-300 mt-1">{error}</div>
                    </div>
                  </motion.div>
                )}

                {/* Campaign Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., Star AI Repos Campaign"
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                  />
                </div>

                {/* Search Keyword */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300 flex items-center gap-2">
                    <Search className="w-4 h-4 text-yellow-400" />
                    Search Keyword
                  </label>
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={(e) => handleChange('keyword', e.target.value)}
                    placeholder="e.g., AI automation tool"
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
                  />
                  <p className="text-xs text-neutral-500">
                    This keyword will be used to search on Google for the repository
                  </p>
                </div>

                {/* Target URL */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-orange-400" />
                    Target Repository URL
                  </label>
                  <input
                    type="text"
                    value={formData.targetUrl}
                    onChange={(e) => handleChange('targetUrl', e.target.value)}
                    placeholder="e.g., github.com/username/repo-name or username/repo-name"
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                  />
                  <p className="text-xs text-neutral-500">
                    Enter the GitHub repository URL or owner/repo format
                  </p>
                </div>

                {/* GoLogin Folder Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-300 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-purple-400" />
                    GoLogin Folder
                  </label>
                  <select
                    value={formData.folderId}
                    onChange={(e) => handleChange('folderId', e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select a folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name} ({folder.profileCount || 0} profiles)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-neutral-500">
                    All profiles in this folder will be used for starring
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-300">
                      <div className="font-medium mb-1">How it works:</div>
                      <ul className="space-y-1 list-disc list-inside">
                        <li>Each profile will search Google for your keyword</li>
                        <li>The target repository will be found and clicked</li>
                        <li>The repository will be starred automatically</li>
                        <li>10 seconds delay between profiles to appear natural</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </form>

              {/* Footer */}
              <div className="border-t border-neutral-800 p-6 bg-neutral-900/50">
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold transition-all shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Star className="w-4 h-4" />
                        Create Campaign
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}