import React, { useState, useEffect } from 'react';
import { X, Sparkles, Link, Hash, Clock, Zap } from 'lucide-react';

export default function CreateCampaignModal({ open, onClose, onCreate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gptAccounts, setGptAccounts] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: 'keywords', // 'keywords', 'apify', 'va', 'upwork', or 'scrape-jobs'
    keywords: '',
    apifyUrls: '',
    questions: '',
    gptAccountId: '',
    timeCoefficient: 'balanced',
    customReposPerHour: 10,
    vaRepoType: 'single',
    vaSingleRepoDescriptions: '',
    vaMultipleRepoDescriptions: '',
    vaPlatform: 'bitbash',
    upworkSearchInput: '',
    scrapeJobUrls: '', // NEW: For scrape-jobs category
    scrapeJobNiche: 'Automation',
    keywordsInputType: 'keyword', // 'keyword' or 'url'
  });


  // Predefined time coefficients
  const timeCoefficients = {
    fast: {
      label: 'Fast',
      description: '1 repo per 5 minutes',
      reposPerHour: 12,
      minDelay: 300000,
    },
    balanced: {
      label: 'Balanced',
      description: '1 repo per 15 minutes',
      reposPerHour: 4,
      minDelay: 900000,
    },
    slow: {
      label: 'Slow',
      description: '1 repo per 30 minutes',
      reposPerHour: 2,
      minDelay: 1800000,
    },
    custom: {
      label: 'Custom',
      description: 'Set your own pace',
      reposPerHour: null,
      minDelay: null,
    },
  };

  // Reset form when modal closes/opens
  useEffect(() => {
    if (open) {
      loadGPTAccounts();
      // Reset error when modal opens
      setError('');
    } else {
      // Reset form state when modal closes to prevent stale data
      setFormData({
        name: '',
        category: 'keywords',
        keywords: '',
        apifyUrls: '',
        questions: '',
        gptAccountId: '',
        timeCoefficient: 'balanced',
        customReposPerHour: 10,
        vaRepoType: 'single',
        vaSingleRepoDescriptions: '',
        vaMultipleRepoDescriptions: '',
        vaPlatform: 'bitbash',
        upworkSearchInput: '',
        scrapeJobUrls: '',
        keywordsInputType: 'keyword',
      });
      setError('');
      setLoading(false);
    }
  }, [open]);

  const loadGPTAccounts = async () => {
    try {
      const accounts = await window.api.listGPTAccounts();
      setGptAccounts(accounts || []);
    } catch (error) {
      console.error('Failed to load GPT accounts:', error);
      setError('Failed to load GPT accounts');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Campaign name is required');
      return;
    }

    if (!formData.gptAccountId) {
      setError('Please select a ChatGPT account');
      return;
    }

    if (formData.category === 'keywords' && !formData.keywords.trim()) {
      setError(formData.keywordsInputType === 'url' ? 'Please enter at least one URL' : 'Please enter at least one keyword');
      return;
    }

    if (formData.category === 'apify' && !formData.apifyUrls.trim()) {
      setError('Please enter at least one Apify URL');
      return;
    }

    // VA Campaign Validation
    if (formData.category === 'va') {
      if (formData.vaRepoType === 'single' && !formData.vaSingleRepoDescriptions.trim()) {
        setError('Please enter at least one repository description');
        return;
      }
      if (formData.vaRepoType === 'multiple' && !formData.vaMultipleRepoDescriptions.trim()) {
        setError('Please enter at least one repository description');
        return;
      }
    }

    // Upwork Campaign Validation
    if (formData.category === 'upwork') {
      if (!formData.upworkSearchInput.trim()) {
        setError('Please enter a keyword or URL to search Upwork jobs');
        return;
      }
    }

    // NEW: Scrape Jobs Campaign Validation
    if (formData.category === 'scrape-jobs') {
      if (!formData.scrapeJobUrls.trim()) {
        setError('Please enter at least one job');
        return;
      }
      
      if (!formData.scrapeJobNiche) {
        setError('Please select a niche (Automation or Scraping)');
        return;
      }
      
      // Validate format - jobs should be separated by ---
      const jobs = formData.scrapeJobUrls
        .split('---')
        .map(job => job.trim())
        .filter(job => job.length > 0);
      
      if (jobs.length === 0) {
        setError('Please enter at least one valid job. Separate multiple jobs with "---"');
        return;
      }
      
      // Basic validation - each job should have some content
      const invalidJobs = jobs.filter(job => job.length < 50);
      
      if (invalidJobs.length > 0) {
        setError('Each job entry should contain sufficient information (at least 50 characters)');
        return;
      }
    }

    // Check for duplicate Apify URLs in past campaigns
    if (formData.category === 'apify') {
      try {
        const existingCampaigns = await window.api.listCampaigns();
        const newUrls = formData.apifyUrls
          .split('\n')
          .map(url => url.trim().toLowerCase())
          .filter(url => url.length > 0);

        for (const newUrl of newUrls) {
          for (const campaign of existingCampaigns) {
            if (campaign.category === 'apify' && campaign.results) {
              const successfulUrls = campaign.results
                .filter(result => result.status === 'success')
                .map(result => (result.item || '').trim().toLowerCase());

              if (successfulUrls.includes(newUrl)) {
                const repoName = campaign.results.find(
                  r => (r.item || '').trim().toLowerCase() === newUrl
                )?.repoName || 'this URL';
                
                setError(`Repo already created with this name: ${repoName}`);
                return;
              }
            }
          }
        }
      } catch (err) {
        console.error('Error checking for duplicate URLs:', err);
      }
    }

    // Validate custom time coefficient
    if (formData.timeCoefficient === 'custom') {
      if (!formData.customReposPerHour || formData.customReposPerHour < 1) {
        setError('Please enter a valid number of repos per hour (minimum 1)');
        return;
      }
    }

    try {
      setLoading(true);

      // Calculate delay between repos based on coefficient
      let delayBetweenRepos = 2000;

      if (formData.timeCoefficient === 'custom') {
        delayBetweenRepos = Math.round(3600000 / formData.customReposPerHour);
      } else {
        delayBetweenRepos = timeCoefficients[formData.timeCoefficient].minDelay;
      }

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        timeCoefficient: formData.timeCoefficient,
        delayBetweenRepos,
        reposPerHour:
          formData.timeCoefficient === 'custom'
            ? formData.customReposPerHour
            : timeCoefficients[formData.timeCoefficient].reposPerHour,
      };

      // Add keywords or URLs based on category
      if (formData.category === 'keywords') {
        payload.keywords = formData.keywords;
        payload.keywordsInputType = formData.keywordsInputType;
        payload.questions = formData.questions;
      } else if (formData.category === 'apify') {
        payload.apifyUrls = formData.apifyUrls;
      } else if (formData.category === 'va') {
        payload.vaRepoType = formData.vaRepoType;
        payload.vaPlatform = formData.vaPlatform;
        if (formData.vaRepoType === 'single') {
          payload.vaSingleRepoDescriptions = formData.vaSingleRepoDescriptions;
        } else {
          payload.vaMultipleRepoDescriptions = formData.vaMultipleRepoDescriptions;
        }
      } else if (formData.category === 'upwork') {
        payload.upworkSearchInput = formData.upworkSearchInput;
      } else if (formData.category === 'scrape-jobs') {
        // NEW: Add manual job info and niche
        payload.scrapeJobUrls = formData.scrapeJobUrls;
        payload.scrapeJobNiche = formData.scrapeJobNiche;
      }

      // Add GPT account ID
      payload.gptAccountId = formData.gptAccountId;

      // Call appropriate API based on category
      if (formData.category === 'upwork') {
        await window.api.createUpworkCampaign(payload);
      } else if (formData.category === 'scrape-jobs') {
        // NEW: Call scrape jobs API
        await window.api.createScrapeJobsCampaign(payload);
      } else {
        await onCreate(payload);
      }

      // Close modal - form will be reset by useEffect
      onClose();
    } catch (err) {
      console.error('Failed to create campaign:', err);
      setError(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setFormData({ ...formData, category });
  };

  const handleTimeCoefficientChange = (coefficient) => {
    setFormData({ ...formData, timeCoefficient: coefficient });
  };

  const getEstimatedTime = () => {
    // Upwork campaigns run indefinitely
    if (formData.category === 'upwork') {
      return 'Runs until stopped';
    }

    let itemCount = 0;
    if (formData.category === 'keywords') {
      itemCount = formData.keywords
        .split('\n')
        .filter((line) => line.trim().length > 0).length;
    } else if (formData.category === 'apify') {
      itemCount = formData.apifyUrls
        .split('\n')
        .filter((line) => line.trim().length > 0).length;
    } else if (formData.category === 'va') {
      if (formData.vaRepoType === 'single') {
        itemCount = formData.vaSingleRepoDescriptions
          .split(',')
          .filter((desc) => desc.trim().length > 0).length;
      } else {
        itemCount = formData.vaMultipleRepoDescriptions
          .split('\n')
          .filter((line) => line.trim().length > 0).length;
      }
    } else if (formData.category === 'scrape-jobs') {
      // NEW: Calculate for manual job entries
      itemCount = formData.scrapeJobUrls
        .split('---')
        .filter((job) => job.trim().length > 0).length;
    }

    if (itemCount === 0) return null;

    let reposPerHour =
      formData.timeCoefficient === 'custom'
        ? formData.customReposPerHour
        : timeCoefficients[formData.timeCoefficient].reposPerHour;

    if (!reposPerHour) return null;

    const hours = itemCount / reposPerHour;
    const minutes = Math.round((hours % 1) * 60);
    const fullHours = Math.floor(hours);

    if (fullHours === 0) {
      return `~${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes === 0) {
      return `~${fullHours} hour${fullHours !== 1 ? 's' : ''}`;
    } else {
      return `~${fullHours}h ${minutes}m`;
    }
  };

  // Early return if modal is not open - prevents rendering and state issues
  if (!open) return null;

  const estimatedTime = getEstimatedTime();

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal if clicking the backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl border-b border-neutral-800 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create Campaign</h2>
              <p className="text-sm text-neutral-400">
                Set up a new automation campaign
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Campaign Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Q1 Automation Campaign"
              className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Category Selection - Dropdown */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Content Source <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                disabled={loading}
              >
                <option value="keywords">Keywords - Generate repos using AI</option>
                <option value="apify">Apify URLs - Scrape from Apify actors</option>
                <option value="va">VA Campaign - Android automation repos</option>
                <option value="upwork">Live Upwork Jobs - Generate repos from Upwork</option>
                <option value="scrape-jobs">Scrape Jobs - Create repos from specific Upwork job URLs</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Keywords Input */}
          {formData.category === 'keywords' && (
            <>
              <div>
                {/* Input type toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, keywordsInputType: 'keyword', keywords: '' })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      formData.keywordsInputType === 'keyword'
                        ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
                        : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                    disabled={loading}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    Keywords
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, keywordsInputType: 'url', keywords: '' })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      formData.keywordsInputType === 'url'
                        ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                        : 'bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                    disabled={loading}
                  >
                    <Link className="w-3.5 h-3.5" />
                    URLs
                  </button>
                </div>

                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {formData.keywordsInputType === 'url' ? 'URLs' : 'Keywords'} <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.keywords}
                  onChange={(e) =>
                    setFormData({ ...formData, keywords: e.target.value })
                  }
                  placeholder={
                    formData.keywordsInputType === 'url'
                      ? 'Enter one URL per line, e.g.:\nhttps://github.com/trending\nhttps://github.com/topics/automation\nhttps://github.com/topics/scraping'
                      : 'Enter one keyword per line, e.g.:\nweb scraping\ndata analysis\nmachine learning'
                  }
                  rows={6}
                  className={`w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none transition-all resize-none font-mono text-sm ${
                    formData.keywordsInputType === 'url'
                      ? 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      : 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                  }`}
                  disabled={loading}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  {formData.keywordsInputType === 'url'
                    ? 'Each URL will be used to generate a unique repository'
                    : 'Each keyword will be used to generate a unique repository'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Questions & Answers{' '}
                  <span className="text-neutral-500">(Optional)</span>
                </label>
                <textarea
                  value={formData.questions}
                  onChange={(e) =>
                    setFormData({ ...formData, questions: e.target.value })
                  }
                  placeholder="Enter questions and answers (one per line):&#10;What is the main purpose?&#10;To automate data collection&#10;Who is the target audience?&#10;Developers and data scientists"
                  rows={6}
                  className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  Provide context for better AI-generated content
                </p>
              </div>
            </>
          )}

          {/* Apify URLs Input */}
          {formData.category === 'apify' && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Apify Actor URLs <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.apifyUrls}
                onChange={(e) =>
                  setFormData({ ...formData, apifyUrls: e.target.value })
                }
                placeholder="Enter one Apify actor URL per line, e.g.:&#10;https://apify.com/apify/web-scraper&#10;https://apify.com/apify/google-search-scraper&#10;https://apify.com/apify/instagram-scraper"
                rows={8}
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none font-mono text-sm"
                disabled={loading}
              />
              <p className="text-xs text-neutral-500 mt-2">
                Each URL will be scraped and a repository will be created from
                the actor's content
              </p>
            </div>
          )}

          {/* VA Campaign Input */}
          {formData.category === 'va' && (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Repository Type <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.vaRepoType}
                    onChange={(e) => setFormData({ ...formData, vaRepoType: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all appearance-none cursor-pointer"
                    disabled={loading}
                  >
                    <option value="single">Single Repo - Multiple features, one repo</option>
                    <option value="multiple">Multiple Repos - One repo per description</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  Automation Platform <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, vaPlatform: 'bitbash' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.vaPlatform === 'bitbash'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
                    }`}
                    disabled={loading}
                  >
                    <div className="text-left">
                      <div
                        className={`font-semibold ${
                          formData.vaPlatform === 'bitbash'
                            ? 'text-white'
                            : 'text-neutral-300'
                        }`}
                      >
                        BitBash
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        BitBash automation platform
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, vaPlatform: 'appilot' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.vaPlatform === 'appilot'
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
                    }`}
                    disabled={loading}
                  >
                    <div className="text-left">
                      <div
                        className={`font-semibold ${
                          formData.vaPlatform === 'appilot'
                            ? 'text-white'
                            : 'text-neutral-300'
                        }`}
                      >
                        Appilot
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Appilot automation platform
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {formData.vaRepoType === 'single' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Repository Descriptions <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formData.vaSingleRepoDescriptions}
                    onChange={(e) =>
                      setFormData({ ...formData, vaSingleRepoDescriptions: e.target.value })
                    }
                    placeholder="Enter descriptions separated by commas, e.g.:&#10;Automates following users, Posts scheduled content, Manages multiple accounts"
                    rows={6}
                    className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all resize-none"
                    disabled={loading}
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Multiple features will be combined into a single Android automation repository
                  </p>
                </div>
              )}

              {formData.vaRepoType === 'multiple' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Repository Descriptions <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formData.vaMultipleRepoDescriptions}
                    onChange={(e) =>
                      setFormData({ ...formData, vaMultipleRepoDescriptions: e.target.value })
                    }
                    placeholder="Enter one description per line, e.g.:&#10;Instagram Auto Follow Bot&#10;TikTok Content Scheduler&#10;Twitter Account Manager"
                    rows={8}
                    className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all resize-none font-mono text-sm"
                    disabled={loading}
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Each line will generate a separate Android automation repository
                  </p>
                </div>
              )}
            </>
          )}

          {/* Upwork Jobs Input */}
          {formData.category === 'upwork' && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Search Keyword or URL <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.upworkSearchInput}
                onChange={(e) =>
                  setFormData({ ...formData, upworkSearchInput: e.target.value })
                }
                placeholder="Enter a keyword (e.g., 'web scraping') or Upwork job URL"
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                disabled={loading}
              />
              <p className="text-xs text-neutral-500 mt-2">
                Jobs will be continuously fetched and filtered based on your input. The campaign runs until you stop it.
              </p>
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-200">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ul className="space-y-1 text-xs text-blue-300/80">
                      <li>• Jobs are fetched from Upwork in real-time</li>
                      <li>• Each job is analyzed by AI to check viability</li>
                      <li>• Valid jobs generate automation/scraping repos</li>
                      <li>• Campaign continues until you click "Stop"</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NEW: Scrape Jobs Input */}
          {formData.category === 'scrape-jobs' && (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Manual Job Information <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.scrapeJobUrls}
                  onChange={(e) =>
                    setFormData({ ...formData, scrapeJobUrls: e.target.value })
                  }
                  placeholder="Enter job information (one job per entry, separated by '---'):&#10;&#10;Job Title: Instagram Automation Bot&#10;Description: Need a bot to automate Instagram following and engagement. Should handle multiple accounts and have scheduling features.&#10;Skills: Python, Selenium, Instagram API&#10;Budget: $500-1000&#10;Duration: 1-3 months&#10;---&#10;Job Title: E-commerce Web Scraping Tool&#10;Description: Build a scraper for multiple e-commerce sites to extract product data, prices, and reviews.&#10;Skills: Python, BeautifulSoup, Scrapy&#10;Budget: $300-500&#10;Duration: Less than 1 month"
                  rows={14}
                  className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all resize-none font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-neutral-500 mt-2">
                  Separate multiple jobs with '---'. Include title, description, skills, budget, etc.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Repository Niche <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scrapeJobNiche: 'Automation' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.scrapeJobNiche === 'Automation'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
                    }`}
                    disabled={loading}
                  >
                    <div className="text-left">
                      <div
                        className={`font-semibold ${
                          formData.scrapeJobNiche === 'Automation'
                            ? 'text-white'
                            : 'text-neutral-300'
                        }`}
                      >
                        Automation
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Bot/automation projects
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, scrapeJobNiche: 'Scraping' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.scrapeJobNiche === 'Scraping'
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
                    }`}
                    disabled={loading}
                  >
                    <div className="text-left">
                      <div
                        className={`font-semibold ${
                          formData.scrapeJobNiche === 'Scraping'
                            ? 'text-white'
                            : 'text-neutral-300'
                        }`}
                      >
                        Scraping
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Data extraction projects
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <Link className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-200">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ul className="space-y-1 text-xs text-orange-300/80">
                      <li>• Manually enter job information (no scraping needed)</li>
                      <li>• GPT generates README based on selected niche</li>
                      <li>• Repos created with appropriate code structure</li>
                      <li>• Duplicate detection prevents re-creating similar jobs</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Time Coefficient Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Execution Speed <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(timeCoefficients).map(([key, coeff]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTimeCoefficientChange(key)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    formData.timeCoefficient === key
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-neutral-700 bg-neutral-800/30 hover:border-neutral-600'
                  }`}
                  disabled={loading}
                >
                  <Clock
                    className={`w-5 h-5 mb-2 ${
                      formData.timeCoefficient === key
                        ? 'text-cyan-400'
                        : 'text-neutral-400'
                    }`}
                  />
                  <div
                    className={`font-semibold ${
                      formData.timeCoefficient === key
                        ? 'text-white'
                        : 'text-neutral-300'
                    }`}
                  >
                    {coeff.label}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {coeff.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Time Coefficient Input */}
          {formData.timeCoefficient === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Repositories Per Hour <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={formData.customReposPerHour}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      customReposPerHour: parseInt(e.target.value) || 1,
                    })
                  }
                  className="flex-1 px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  disabled={loading}
                />
                <span className="text-neutral-400">repos/hour</span>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Delay between repos:{' '}
                {Math.round(3600000 / formData.customReposPerHour / 1000)}
                s (~
                {Math.round(3600000 / formData.customReposPerHour / 60000)}
                m)
              </p>
            </div>
          )}

          {/* Estimated Time */}
          {estimatedTime && (
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/50 rounded-xl">
              <p className="text-sm text-cyan-400">
                ⏱Estimated completion time: <strong>{estimatedTime}</strong>
              </p>
            </div>
          )}

          {/* ChatGPT Account Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              ChatGPT Account <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 pointer-events-none" />
              <select
                value={formData.gptAccountId}
                onChange={(e) =>
                  setFormData({ ...formData, gptAccountId: e.target.value })
                }
                className="w-full pl-11 pr-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all appearance-none cursor-pointer"
                disabled={loading}
              >
                <option value="">Select a ChatGPT account...</option>
                {gptAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            {gptAccounts.length === 0 && (
              <p className="text-xs text-yellow-500 mt-2">
                ⚠️ No ChatGPT accounts found. Please add one in Settings.
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl">
              <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Campaign
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}