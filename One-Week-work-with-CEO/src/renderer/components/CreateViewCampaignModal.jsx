import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Globe, XCircle } from 'lucide-react';

export default function CreateViewCampaignModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    searchType: 'keyword',
    searchQuery: '',
    repoUrl: '',
    numViews: 10
  });

  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Campaign name is required';
    if (!formData.searchQuery.trim()) newErrors.searchQuery = 'Search query is required';
    if (!formData.repoUrl.trim()) {
      newErrors.repoUrl = 'Repository URL is required';
    } else if (!formData.repoUrl.includes('github.com')) {
      newErrors.repoUrl = 'Must be a valid GitHub repository URL';
    }
    if (formData.numViews < 1) newErrors.numViews = 'Number of views must be at least 1';
    if (formData.numViews > 1000) newErrors.numViews = 'Number of views cannot exceed 1000';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit(formData);
      // Reset form
      setFormData({
        name: '',
        searchType: 'keyword',
        searchQuery: '',
        repoUrl: '',
        numViews: 10
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to create view campaign:', error);
      setErrors({ submit: error.message || 'Failed to create campaign' });
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white">Create View Campaign</h2>
              </div>
              <button
                onClick={onClose}
                className="text-neutral-400 hover:text-white transition-colors p-2 hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">{/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., My Repo Views Campaign"
                  className={`w-full px-4 py-3 bg-neutral-800 border ${
                    errors.name ? 'border-red-500' : 'border-neutral-700'
                  } rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all`}
                />
                {errors.name && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Search Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Search Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleChange('searchType', 'keyword')}
                    className={`px-4 py-4 rounded-xl border-2 transition-all ${
                      formData.searchType === 'keyword'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/20'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                    }`}
                  >
                    <Search className="w-5 h-5 mx-auto mb-2" />
                    <span className="text-sm font-medium block">Keyword</span>
                    <p className="text-xs opacity-75 mt-1">Search via Google</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('searchType', 'about')}
                    className={`px-4 py-4 rounded-xl border-2 transition-all ${
                      formData.searchType === 'about'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/20'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                    }`}
                  >
                    <Globe className="w-5 h-5 mx-auto mb-2" />
                    <span className="text-sm font-medium block">About</span>
                    <p className="text-xs opacity-75 mt-1">Direct navigation</p>
                  </button>
                </div>
              </div>

              {/* Search Query */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {formData.searchType === 'keyword' ? 'Search Keyword' : 'About Description'} *
                </label>
                <input
                  type="text"
                  value={formData.searchQuery}
                  onChange={(e) => handleChange('searchQuery', e.target.value)}
                  placeholder={
                    formData.searchType === 'keyword'
                      ? 'e.g., react component library'
                      : 'e.g., Description of your repository'
                  }
                  className={`w-full px-4 py-3 bg-neutral-800 border ${
                    errors.searchQuery ? 'border-red-500' : 'border-neutral-700'
                  } rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all`}
                />
                {errors.searchQuery && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {errors.searchQuery}
                  </p>
                )}
                <p className="mt-2 text-xs text-neutral-500">
                  {formData.searchType === 'keyword'
                    ? 'This keyword will be used to search on Google'
                    : 'This will be used for the About page navigation'}
                </p>
              </div>

              {/* Repository URL */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  GitHub Repository URL *
                </label>
                <input
                  type="text"
                  value={formData.repoUrl}
                  onChange={(e) => handleChange('repoUrl', e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className={`w-full px-4 py-3 bg-neutral-800 border ${
                    errors.repoUrl ? 'border-red-500' : 'border-neutral-700'
                  } rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all`}
                />
                {errors.repoUrl && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {errors.repoUrl}
                  </p>
                )}
              </div>

              {/* Number of Views */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Number of Views *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.numViews}
                  onChange={(e) => handleChange('numViews', parseInt(e.target.value))}
                  className={`w-full px-4 py-3 bg-neutral-800 border ${
                    errors.numViews ? 'border-red-500' : 'border-neutral-700'
                  } rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all`}
                />
                {errors.numViews && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {errors.numViews}
                  </p>
                )}
                <p className="mt-2 text-xs text-neutral-500">
                  Number of unique views to generate (1-1000)
                </p>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {errors.submit}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                >
                  Create Campaign
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
