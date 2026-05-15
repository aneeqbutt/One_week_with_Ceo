import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Sparkles } from 'lucide-react';

export default function CreateIndexerCampaignModal({ open, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    bulkInput: ''
  });

  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Campaign name is required';
    }
    if (!formData.bulkInput.trim()) {
      newErrors.bulkInput = 'At least one keyword-URL pair is required';
    } else {
      // Validate format of bulk input
      const lines = formData.bulkInput.trim().split('\n').filter(line => line.trim());
      const invalidLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length !== 2) {
          invalidLines.push(`Line ${i + 1}: Must have exactly one comma separating keyword and URL`);
        } else if (!parts[0]) {
          invalidLines.push(`Line ${i + 1}: Keyword cannot be empty`);
        } 
      }
      
      if (invalidLines.length > 0) {
        newErrors.bulkInput = invalidLines.join('\n');
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Parse bulk input into items array
    const lines = formData.bulkInput.trim().split('\n').filter(line => line.trim());
    const items = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        searchQuery: parts[0],
        repoUrl: parts[1],
        searchType: 'keyword'
      };
    });

    // Create single campaign with multiple items
    const campaign = {
      name: formData.name,
      items: items
    };

    // Create campaign
    onCreate(campaign);
    
    // Reset form
    setFormData({
      name: '',
      bulkInput: ''
    });
    setErrors({});
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border-b border-neutral-800 p-6">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-teal-500/5 animate-pulse" />
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    Create Indexer Check
                    <Sparkles className="w-5 h-5 text-green-400" />
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1">
                    Bulk check multiple repositories on Google
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., My Bulk Index Check"
                className={`w-full px-4 py-3 bg-neutral-800 border ${
                  errors.name ? 'border-red-500' : 'border-neutral-700'
                } rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all`}
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Bulk Input */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Keyword-URL Pairs *
              </label>
              <textarea
                value={formData.bulkInput}
                onChange={(e) => handleChange('bulkInput', e.target.value)}
                placeholder={`Enter one pair per line in format: keyword,url\n\nExample:\nreact component library,https://github.com/user/repo1\npython scraper,https://github.com/user/repo2\nnode.js api,https://github.com/user/repo3`}
                rows={8}
                className={`w-full px-4 py-3 bg-neutral-800 border ${
                  errors.bulkInput ? 'border-red-500' : 'border-neutral-700'
                } rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all font-mono text-sm resize-none`}
              />
              {errors.bulkInput && (
                <p className="mt-2 text-sm text-red-400 whitespace-pre-line">{errors.bulkInput}</p>
              )}
              <p className="mt-2 text-xs text-neutral-500">
                <span className="font-semibold">Format:</span> keyword,url (one per line)
                <br />
                Each line will create a separate index check with the same campaign name.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
              >
                Create Campaigns
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
