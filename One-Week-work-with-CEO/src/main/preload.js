import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // App info
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),

  // Campaign operations
  listCampaigns: () => ipcRenderer.invoke('campaigns:list'),
  createCampaign: (campaignData) => ipcRenderer.invoke('campaigns:create', campaignData),
  updateCampaign: (id, updates) => ipcRenderer.invoke('campaigns:update', id, updates),
  deleteCampaign: (id) => ipcRenderer.invoke('campaigns:delete', id),
  startCampaign: (id) => ipcRenderer.invoke('campaigns:start', { id }),
  stopCampaign: (id) => ipcRenderer.invoke('campaigns:stop', { id }),

  // Stars Campaign operations
  listStarsCampaigns: () => ipcRenderer.invoke('starsCampaigns:list'),
  createStarsCampaign: (campaignData) => ipcRenderer.invoke('starsCampaigns:create', campaignData),
  startStarsCampaign: (id) => ipcRenderer.invoke('starsCampaigns:start', { id }),
  stopStarsCampaign: (id) => ipcRenderer.invoke('starsCampaigns:stop', { id }),
  deleteStarsCampaign: (id) => ipcRenderer.invoke('starsCampaigns:delete', id),
  
  // Indexer Campaign operations
  listIndexerCampaigns: () => ipcRenderer.invoke('indexerCampaigns:list'),
  createIndexerCampaign: (campaignData) => ipcRenderer.invoke('indexerCampaigns:create', campaignData),
  startIndexerCampaign: (id) => ipcRenderer.invoke('indexerCampaigns:start', { id }),
  stopIndexerCampaign: (id) => ipcRenderer.invoke('indexerCampaigns:stop', { id }),
  deleteIndexerCampaign: (id) => ipcRenderer.invoke('indexerCampaigns:delete', id),
  

  // View Campaign operations
  listViewCampaigns: () => ipcRenderer.invoke('viewCampaigns:list'),
  createViewCampaign: (campaignData) => ipcRenderer.invoke('viewCampaigns:create', campaignData),
  startViewCampaign: (id) => ipcRenderer.invoke('viewCampaigns:start', { id }),
  stopViewCampaign: (id) => ipcRenderer.invoke('viewCampaigns:stop', { id }),
  deleteViewCampaign: (id) => ipcRenderer.invoke('viewCampaigns:delete', id),
  
  // Upwork Campaign operations
  listUpworkCampaigns: () => ipcRenderer.invoke('upworkCampaigns:list'),
  createUpworkCampaign: (campaignData) => ipcRenderer.invoke('upworkCampaigns:create', campaignData),
  startUpworkCampaign: (id) => ipcRenderer.invoke('upworkCampaigns:start', { id }),
  stopUpworkCampaign: (id) => ipcRenderer.invoke('upworkCampaigns:stop', { id }),
  deleteUpworkCampaign: (id) => ipcRenderer.invoke('upworkCampaigns:delete', id),


  // GoLogin operations
  getGoLoginFolders: () => ipcRenderer.invoke('gologin:getFolders'),

  // GPT Accounts operations
  listGPTAccounts: () => ipcRenderer.invoke('gptAccounts:list'),
  createGPTAccount: (data) => ipcRenderer.invoke('gptAccounts:create', data),
  updateGPTAccount: (id, updates) => ipcRenderer.invoke('gptAccounts:update', id, updates),
  deleteGPTAccount: (id) => ipcRenderer.invoke('gptAccounts:delete', id),

  // Account Groups operations
  listAccountGroups: () => ipcRenderer.invoke('accountGroups:list'),
  createAccountGroup: (data) => ipcRenderer.invoke('accountGroups:create', data),
  deleteAccountGroup: (id) => ipcRenderer.invoke('accountGroups:delete', id),

  // GitHub Accounts operations
  listGithubAccounts: (groupId) => ipcRenderer.invoke('githubAccounts:list', groupId),
  createGithubAccount: (data) => ipcRenderer.invoke('githubAccounts:create', data),
  deleteGithubAccount: (id) => ipcRenderer.invoke('githubAccounts:delete', id),
  updateGithubAccount: (id, updates) => ipcRenderer.invoke('githubAccounts:update', id, updates),

  // Logs
  getCampaignLogs: (campaignId) => ipcRenderer.invoke('logs:get', { id: campaignId }),
  clearLogs: (campaignId) => ipcRenderer.invoke('logs:clear', { id: campaignId }),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  listScrapeJobsCampaigns: () => ipcRenderer.invoke('scrapeJobsCampaigns:list'),
  createScrapeJobsCampaign: (campaignData) => ipcRenderer.invoke('scrapeJobsCampaigns:create', campaignData),
  startScrapeJobsCampaign: (id) => ipcRenderer.invoke('scrapeJobsCampaigns:start', { id }),
  stopScrapeJobsCampaign: (id) => ipcRenderer.invoke('scrapeJobsCampaigns:stop', { id }),
  deleteScrapeJobsCampaign: (id) => ipcRenderer.invoke('scrapeJobsCampaigns:delete', id),

// Add this event listener (if not already present for other campaign types)
  onScrapeJobsCampaignStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('scrape-jobs-campaign:status', subscription);
    return () => ipcRenderer.removeListener('scrape-jobs-campaign:status', subscription);
  },

  
  // Event listeners
  onLog: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('log:message', subscription);
    return () => ipcRenderer.removeListener('log:message', subscription);
  },
  
  onCampaignStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('campaign:status', subscription);
    return () => ipcRenderer.removeListener('campaign:status', subscription);
  },
  
  onStarsCampaignStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('stars-campaign:status', subscription);
    return () => ipcRenderer.removeListener('stars-campaign:status', subscription);
  },
  
  onIndexerCampaignStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('indexer-campaign:status', subscription);
    return () => ipcRenderer.removeListener('indexer-campaign:status', subscription);
  },
  

  onViewCampaignStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('view-campaign:status', subscription);
    return () => ipcRenderer.removeListener('view-campaign:status', subscription);
  },
  
  onUpworkCampaignStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('upwork-campaign:status', subscription);
    return () => ipcRenderer.removeListener('upwork-campaign:status', subscription);
  },


  onProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('campaign:progress', subscription);
    return () => ipcRenderer.removeListener('campaign:progress', subscription);
  },

  // Listing-site sync notification
  onSyncUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('sync:update', subscription);
    return () => ipcRenderer.removeListener('sync:update', subscription);
  }
});

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
  isElectron: true,
  os: process.platform
});