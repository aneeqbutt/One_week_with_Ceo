import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, RefreshCw, Eye, Activity, CheckCircle, Loader, Sparkles, Zap } from 'lucide-react';
import CreateViewCampaignModal from '../components/CreateViewCampaignModal';
import ViewCampaignList from '../components/ViewCampaignList';

export default function RepoViews() {
  const [campaigns, setCampaigns] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0,
    totalViews: 0
  });

  // Load campaigns
  const loadCampaigns = async () => {
    try {
      setIsLoading(true);
      const data = await window.api.listViewCampaigns();
      setCampaigns(data);
      calculateStats(data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (campaignData) => {
    const stats = {
      total: campaignData.length,
      running: campaignData.filter(c => c.status === 'Running').length,
      completed: campaignData.filter(c => c.status === 'Completed').length,
      totalViews: campaignData.reduce((sum, c) => sum + (c.progress?.completed || 0), 0)
    };
    setStats(stats);
  };

  // Create campaign
  const handleCreateCampaign = async (formData) => {
    try {
      await window.api.createViewCampaign(formData);
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      throw error;
    }
  };

  // Start campaign
  const handleStartCampaign = async (id) => {
    try {
      await window.api.startViewCampaign(id);
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to start campaign:', error);
    }
  };

  // Stop campaign
  const handleStopCampaign = async (id) => {
    try {
      await window.api.stopViewCampaign(id);
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to stop campaign:', error);
    }
  };

  // Delete campaign
  const handleDeleteCampaign = async (id) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await window.api.deleteViewCampaign(id);
      await loadCampaigns();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  // Listen for campaign status updates
  useEffect(() => {
    const unsubscribe = window.api.onViewCampaignStatus((data) => {
      console.log('View campaign status update:', data);
      loadCampaigns();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Initial load
  useEffect(() => {
    loadCampaigns();
  }, []);

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-indigo-500/10 border border-blue-500/20 rounded-3xl p-8"
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-indigo-500/5 animate-pulse" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <Eye className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                Repository Views Campaign
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </h1>
              <p className="text-neutral-400">
                Generate organic views for your GitHub repositories using automated browser profiles
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {/* <button
              onClick={loadCampaigns}
              disabled={isLoading}
              className="px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 text-white transition-all flex items-center gap-2 disabled:opacity-50 hover:scale-105"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button> */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Create Campaign
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Total Campaigns</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-400" />
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
              <Zap className="w-5 h-5 text-blue-400 animate-pulse" />
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
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.completed}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Total Views Generated</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalViews}</div>
        </motion.div>
      </div>

      {/* Campaigns Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white mb-1">Your Campaigns</h2>
          <p className="text-sm text-neutral-500">Manage and monitor your view generation campaigns</p>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12 bg-neutral-900 border border-neutral-800 rounded-2xl">
            <Loader className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : (
          <ViewCampaignList
            campaigns={campaigns}
            onStart={handleStartCampaign}
            onStop={handleStopCampaign}
            onDelete={handleDeleteCampaign}
            onRefresh={loadCampaigns}
          />
        )}
      </motion.div>

      {/* Create Campaign Modal */}
      <CreateViewCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />
    </div>
  );
}
