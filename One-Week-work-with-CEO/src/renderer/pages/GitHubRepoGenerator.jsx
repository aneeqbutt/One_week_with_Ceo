import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Github, Sparkles, Zap } from 'lucide-react';
import CreateCampaignModal from '../components/CreateCampaignModal.jsx';
import CampaignList from '../components/CampaignList.jsx';

export default function GitHubRepoGenerator() {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0
  });

  const refresh = async () => {
    if (window.api && window.api.listCampaigns) {
      // Fetch both regular campaigns and Upwork campaigns
      const regularCampaigns = await window.api.listCampaigns();
      const upworkCampaigns = window.api.listUpworkCampaigns
        ? await window.api.listUpworkCampaigns()
        : [];

      // Also fetch scrape-jobs campaigns (they live in upwork collection but are a different category)
      const scrapeJobsCampaigns = window.api.listScrapeJobsCampaigns
        ? await window.api.listScrapeJobsCampaigns()
        : [];

      // Merge all lists and deduplicate by id (some campaigns live in multiple lists)
      const combined = [
        ...(regularCampaigns || []),
        ...(upworkCampaigns || []),
        ...(scrapeJobsCampaigns || [])
      ];

      const seen = new Map();
      for (const c of combined) {
        if (!c || !c.id) continue;
        if (!seen.has(c.id)) {
          seen.set(c.id, c);
        } else {
          // Prefer the more-specific record if available (scrape-jobs/upwork over generic)
          const existing = seen.get(c.id);
          if ((existing.category === 'keywords' || existing.category === 'apify' || existing.category === 'va') && (c.category === 'upwork' || c.category === 'scrape-jobs')) {
            seen.set(c.id, c);
          }
        }
      }

      const allCampaigns = Array.from(seen.values());
      setCampaigns(allCampaigns);
      
      // Calculate stats
      setStats({
        total: allCampaigns.length,
        running: allCampaigns.filter(c => c.status === 'Running').length,
        completed: allCampaigns.filter(c => c.status === 'Completed').length
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
    if (window.api && window.api.onCampaignStatus) {
      const unsub = window.api.onCampaignStatus(() => refresh());
      return () => unsub?.();
    }
    return () => {};
  }, []);

  useEffect(() => {
    if (window.api && window.api.onUpworkCampaignStatus) {
      const unsub = window.api.onUpworkCampaignStatus(() => refresh());
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
      
      if (!window.api.createCampaign) {
        console.error('❌ window.api.createCampaign is not defined!');
        throw new Error('createCampaign function not available');
      }
      
      console.log('📤 Calling window.api.createCampaign...');
      const result = await window.api.createCampaign(form);
      console.log('✅ Campaign created successfully:', result);
      
      setOpen(false);
      await refresh();
    } catch (error) {
      console.error('❌ Error in onCreate:', error);
      throw error;
    }
  };

  const onStart = async (id) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    if (campaign.category === 'upwork') {
      if (window.api && window.api.startUpworkCampaign) {
        await window.api.startUpworkCampaign(id);
      }
    } else if (campaign.category === 'scrape-jobs') {
      if (window.api && window.api.startScrapeJobsCampaign) {
        await window.api.startScrapeJobsCampaign(id);
      }
    } else {
      if (window.api && window.api.startCampaign) {
        await window.api.startCampaign(id);
      }
    }
    setSelected(id);
  };

  const onStop = async (id) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    if (campaign.category === 'upwork') {
      if (window.api && window.api.stopUpworkCampaign) {
        await window.api.stopUpworkCampaign(id);
      }
    } else if (campaign.category === 'scrape-jobs') {
      if (window.api && window.api.stopScrapeJobsCampaign) {
        await window.api.stopScrapeJobsCampaign(id);
      }
    } else {
      if (window.api && window.api.stopCampaign) {
        await window.api.stopCampaign(id);
      }
    }
  };

  const onDelete = async (id) => {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;

    if (campaign.category === 'upwork') {
      if (window.api && window.api.deleteUpworkCampaign) {
        await window.api.deleteUpworkCampaign(id);
        await refresh();
      }
    } else if (campaign.category === 'scrape-jobs') {
      if (window.api && window.api.deleteScrapeJobsCampaign) {
        await window.api.deleteScrapeJobsCampaign(id);
        await refresh();
      }
    } else {
      if (window.api && window.api.deleteCampaign) {
        await window.api.deleteCampaign(id);
        await refresh();
      }
    }
  };

  const handleModalClose = () => {
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 border border-purple-500/20 rounded-3xl p-8"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 animate-pulse" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Github className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                GitHub Repository Automation
                <Sparkles className="w-6 h-6 text-yellow-400" />
              </h1>
              <p className="text-neutral-400">
                Generate repositories automatically using AI-powered ChatGPT integration
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setOpen(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold flex items-center gap-2 transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-purple-500/50 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-400">Total Campaigns</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Github className="w-5 h-5 text-purple-400" />
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
              <Sparkles className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white">{stats.completed}</div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white mb-1">Your Campaigns</h2>
          <p className="text-sm text-neutral-500">Manage and monitor your automation campaigns</p>
        </div>
        
        <CampaignList
          campaigns={campaigns}
          onStart={onStart}
          onStop={onStop}
          onDelete={onDelete}
        />
      </motion.div>

      <CreateCampaignModal
        open={open}
        onClose={handleModalClose}
        onCreate={onCreate}
      />
    </div>
  );
}
