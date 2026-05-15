import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Sparkles, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import CreateIndexerCampaignModal from '../components/CreateIndexerCampaignModal.jsx';
import IndexerCampaignList from '../components/IndexerCampaignList.jsx';

export default function IndexerChecker() {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    indexed: 0,
    notIndexed: 0
  });

  const refresh = async () => {
    if (window.api && window.api.listIndexerCampaigns) {
      try {
        const data = await window.api.listIndexerCampaigns();
        setCampaigns(data);
        
        // Calculate stats
        const running = data.filter(c => c.status === 'Running').length;
        const completed = data.filter(c => c.status === 'Completed');
        const indexed = completed.filter(c => c.result?.indexed).length;
        const notIndexed = completed.filter(c => c.result && !c.result.indexed).length;
        
        setStats({
          total: data.length,
          running,
          indexed,
          notIndexed
        });
      } catch (error) {
        console.error('Error fetching indexer campaigns:', error);
      }
    } else {
      console.warn('API not available for indexer campaigns');
    }
  };

  useEffect(() => {
    refresh();
    
    // Set up polling for updates
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.api && window.api.onIndexerCampaignStatus) {
      const unsubscribe = window.api.onIndexerCampaignStatus((data) => {
        refresh();
      });
      return unsubscribe;
    }
    return () => {};
  }, []);

  const onCreate = async (campaign) => {
    try {
      if (window.api && window.api.createIndexerCampaign) {
        await window.api.createIndexerCampaign(campaign);
        setOpen(false);
        refresh();
      } else {
        console.error('API not available');
      }
    } catch (error) {
      console.error('Error creating indexer campaign:', error);
      alert('Failed to create campaign: ' + error.message);
    }
  };

  const onStart = async (id) => {
    if (window.api && window.api.startIndexerCampaign) {
      await window.api.startIndexerCampaign(id);
    }
  };

  const onStop = async (id) => {
    if (window.api && window.api.stopIndexerCampaign) {
      await window.api.stopIndexerCampaign(id);
    }
  };

  const onDelete = async (id) => {
    if (window.api && window.api.deleteIndexerCampaign) {
      await window.api.deleteIndexerCampaign(id);
      refresh();
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 rounded-3xl p-8"
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-teal-500/5 animate-pulse" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50">
              <Search className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                Google Indexer Checker
                <Sparkles className="w-6 h-6 text-green-400" />
              </h1>
              <p className="text-neutral-400">
                Check if your GitHub repositories are indexed on Google search
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setOpen(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold flex items-center gap-2 transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Check Index
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-green-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Total Checks</span>
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Search className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Running</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.running}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Indexed</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.indexed}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-red-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Not Indexed</span>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.notIndexed}</div>
        </motion.div>
      </div>

      {/* Campaigns Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white mb-1">Your Index Checks</h2>
          <p className="text-sm text-neutral-500">Manage and monitor your Google indexing checks</p>
        </div>
        
        <IndexerCampaignList
          campaigns={campaigns}
          onStart={onStart}
          onStop={onStop}
          onDelete={onDelete}
        />
      </motion.div>

      {/* Create Campaign Modal */}
      <CreateIndexerCampaignModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={onCreate}
      />
    </div>
  );
}
