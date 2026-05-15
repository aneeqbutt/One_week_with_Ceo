import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Star, Sparkles, Zap, TrendingUp } from 'lucide-react';
import CreateStarsCampaignModal from '../components/CreateStarsCampaignModal.jsx';
import StarsCampaignList from '../components/StarsCampaignList.jsx';
import LogViewer from '../components/LogViewer.jsx';

export default function StarsCampaign() {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0
  });

  const refresh = async () => {
    if (window.api && window.api.listStarsCampaigns) {
      const res = await window.api.listStarsCampaigns();
      setCampaigns(res || []);
      
      // Calculate stats
      setStats({
        total: res.length,
        running: res.filter(c => c.status === 'Running').length,
        completed: res.filter(c => c.status === 'Completed').length
      });
    } else {
      setCampaigns([]);
      setStats({ total: 0, running: 0, completed: 0 });
    }
  };

  useEffect(() => {
    refresh();
    
    // Set up polling for updates
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.api && window.api.onStarsCampaignStatus) {
      const unsub = window.api.onStarsCampaignStatus(() => refresh());
      return () => unsub?.();
    }
    return () => {};
  }, []);

  const onCreate = async (form) => {
    try {
      console.log('🔧 onCreate called with form:', form);
      
      if (!window.api) {
        console.error('❌ window.api is not defined!');
        throw new Error('Electron API not available');
      }
      
      if (!window.api.createStarsCampaign) {
        console.error('❌ window.api.createStarsCampaign is not defined!');
        throw new Error('createStarsCampaign function not available');
      }
      
      console.log('📤 Calling window.api.createStarsCampaign...');
      const result = await window.api.createStarsCampaign(form);
      console.log('✅ Stars campaign created successfully:', result);
      
      setOpen(false);
      await refresh();
    } catch (error) {
      console.error('❌ Error in onCreate:', error);
      throw error;
    }
  };

  const onStart = async (id) => {
    if (window.api && window.api.startStarsCampaign) {
      await window.api.startStarsCampaign(id);
    }
    setSelected(id);
  };

  const onStop = async (id) => {
    if (window.api && window.api.stopStarsCampaign) {
      await window.api.stopStarsCampaign(id);
    }
  };

  const onDelete = async (id) => {
    if (window.api && window.api.deleteStarsCampaign) {
      await window.api.deleteStarsCampaign(id);
      if (selected === id) {
        setSelected(null);
      }
      await refresh();
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-red-500/10 border border-yellow-500/20 rounded-3xl p-8"
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-red-500/5 animate-pulse" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
              <Star className="w-8 h-8 text-white fill-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                GitHub Stars Campaign
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </h1>
              <p className="text-neutral-400">
                Automate GitHub repository starring using GoLogin profiles
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setOpen(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold flex items-center gap-2 transition-all shadow-lg shadow-yellow-500/30 hover:shadow-yellow-500/50 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-yellow-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Total Campaigns</span>
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-orange-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Running</span>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-400 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.running}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-green-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Completed</span>
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.completed}</div>
        </motion.div>
      </div>

      {/* Campaigns Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white mb-1">Your Star Campaigns</h2>
          <p className="text-sm text-neutral-500">Manage and monitor your GitHub starring automation</p>
        </div>
        
        <StarsCampaignList
          campaigns={campaigns}
          onStart={onStart}
          onStop={onStop}
          onViewLogs={(id) => setSelected(id)}
          onDelete={onDelete}
        />
      </motion.div>

      {/* Logs Section */}
      {/* <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white mb-1">Activity Logs</h2>
          <p className="text-sm text-neutral-500">Real-time campaign execution logs</p>
        </div>
        
        <LogViewer campaignId={selected} campaignType="stars" />
      </motion.div> */}

      {/* Create Campaign Modal */}
      <CreateStarsCampaignModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={onCreate}
      />
    </div>
  );
}