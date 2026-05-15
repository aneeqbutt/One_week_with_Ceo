import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, TrendingUp, Activity, Zap, Users, GitBranch, Star, Clock, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    runningCampaigns: 0,
    completedCampaigns: 0,
    totalRepos: 0,
    successRate: 0
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [syncToast, setSyncToast] = useState(null); // { recordsSynced, syncedAt }

  // Listen for listing-site sync notifications from main process
  useEffect(() => {
    if (!window.api?.onSyncUpdate) return;
    const unsub = window.api.onSyncUpdate((data) => {
      setSyncToast(data);
      // Auto-dismiss after 6 seconds
      setTimeout(() => setSyncToast(null), 6000);
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      if (window.api && window.api.listCampaigns) {
        const campaigns = await window.api.listCampaigns();
        
        const total = campaigns.length;
        const running = campaigns.filter(c => c.status === 'Running').length;
        const completed = campaigns.filter(c => c.status === 'Completed').length;
        
        let totalRepos = 0;
        let successfulRepos = 0;
        
        campaigns.forEach(campaign => {
          if (campaign.results) {
            totalRepos += campaign.results.length;
            successfulRepos += campaign.results.filter(r => r.status === 'success').length;
          }
        });
        
        const successRate = totalRepos > 0 ? Math.round((successfulRepos / totalRepos) * 100) : 0;
        
        setStats({
          totalCampaigns: total,
          runningCampaigns: running,
          completedCampaigns: completed,
          totalRepos: successfulRepos,
          successRate
        });

        // Get recent activity (last 5 campaigns)
        const recent = campaigns
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 5);
        setRecentActivity(recent);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Campaigns',
      value: stats.totalCampaigns,
      icon: Github,
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Running Now',
      value: stats.runningCampaigns,
      icon: Zap,
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
      animate: stats.runningCampaigns > 0
    },
    {
      title: 'Repositories Created',
      value: stats.totalRepos,
      icon: GitBranch,
      color: 'green',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: TrendingUp,
      color: 'yellow',
      gradient: 'from-yellow-500 to-orange-500'
    }
  ];

  const features = [
    {
      icon: Github,
      title: 'AI-Powered Generation',
      description: 'Leverage ChatGPT to generate repository metadata automatically',
      color: 'purple'
    },
    {
      icon: Zap,
      title: 'Bulk Automation',
      description: 'Process multiple keywords and create repositories in batches',
      color: 'blue'
    },
    {
      icon: Activity,
      title: 'Real-time Monitoring',
      description: 'Track campaign progress and view detailed execution logs',
      color: 'green'
    }
  ];

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">

      {/* Listing-site sync toast — fixed bottom-right, auto-dismisses */}
      <AnimatePresence>
        {syncToast && (
          <motion.div
            key="sync-toast"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl bg-neutral-900 border border-green-500/40 shadow-xl shadow-black/60"
          >
            <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Listing Site Updated</p>
              <p className="text-xs text-neutral-400">
                {syncToast.recordsSynced} new record{syncToast.recordsSynced !== 1 ? 's' : ''} published
              </p>
            </div>
            <button
              onClick={() => setSyncToast(null)}
              className="ml-2 text-neutral-600 hover:text-neutral-400 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 border border-purple-500/20 rounded-3xl p-8"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 animate-pulse" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-neutral-400">Overview of your automation activity</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-neutral-700 transition-all overflow-hidden"
          >
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-neutral-400">{card.title}</span>
                <div className={`w-10 h-10 rounded-xl bg-${card.color}-500/10 flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 text-${card.color}-400 ${card.animate ? 'animate-pulse' : ''}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-white">{card.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-xl font-semibold text-white mb-4">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-neutral-700 transition-all"
            >
              <div className={`w-12 h-12 rounded-xl bg-${feature.color}-500/10 flex items-center justify-center mb-4`}>
                <feature.icon className={`w-6 h-6 text-${feature.color}-400`} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-neutral-400">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Recent Campaigns</h2>
          <Link
            to="/github-repo-generator"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            View all →
          </Link>
        </div>
        
        {recentActivity.length > 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {recentActivity.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + index * 0.05 }}
                className={`p-4 flex items-center justify-between ${
                  index !== recentActivity.length - 1 ? 'border-b border-neutral-800' : ''
                } hover:bg-neutral-800/50 transition-colors`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                    <Github className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{campaign.name}</h3>
                    <p className="text-xs text-neutral-500">
                      {campaign.keywords?.length || 0} keywords
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    campaign.status === 'Running' ? 'bg-blue-500/10 text-blue-400' :
                    campaign.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                    'bg-neutral-800 text-neutral-400'
                  }`}>
                    {campaign.status}
                  </div>
                  <Clock className="w-4 h-4 text-neutral-600" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
            <Github className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-500">No campaigns yet. Create your first one to get started!</p>
          </div>
        )}
      </motion.div>

      {/* Quick Action */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-8 text-center"
      >
        <Star className="w-12 h-12 text-purple-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Ready to automate?</h3>
        <p className="text-neutral-400 mb-6">Create your first campaign and start generating repositories</p>
        <Link
          to="/github-repo-generator"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all shadow-lg shadow-purple-500/30"
        >
          <Github className="w-5 h-5" />
          Go to GitHub Automation
        </Link>
      </motion.div>
    </div>
  );
}