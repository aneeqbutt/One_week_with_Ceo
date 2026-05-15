import { ipcMain, app } from 'electron';
import { campaignManager } from '../services/campaignManager.js';
import { storage } from '../services/storage.js';
import { starsCampaignManager } from '../services/Starscampaignmanager.js';
import { indexerCampaignManager } from '../services/indexerCampaignManager.js';
import { upworkCampaignManager } from '../services/upworkCampaignManager.js';
import { log, success, warn, error, db, section } from './logger.js';

section('Registering IPC Handlers');

// ==================== App Info ====================
ipcMain.handle('app:get-info', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
  };
});

// ==================== Campaign Operations ====================
ipcMain.handle('campaigns:list', async () => {
  try {
    const campaigns = await storage.getCampaigns();
    return campaigns;
  } catch (err) {
    error('campaigns:list failed', err);
    throw err;
  }
});

ipcMain.handle('campaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createCampaign(payload);
    success(`Campaign created → id=${campaign.id} name="${campaign.name}" category=${payload?.category}`);
    return campaign;
  } catch (err) {
    error(`Campaign create failed → name="${payload?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('campaigns:update', async (_event, id, updates) => {
  try {
    const campaign = await storage.updateCampaign(id, updates);
    return campaign;
  } catch (err) {
    error(`Campaign update failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('campaigns:delete', async (_event, id) => {
  try {
    await storage.deleteCampaign(id);
    success(`Campaign deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Campaign delete failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('campaigns:start', async (_event, { id }) => {
  try {
    await campaignManager.startCampaign(id);
    success(`Campaign started → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Campaign start failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('campaigns:stop', async (_event, { id }) => {
  try {
    await campaignManager.stopCampaign(id);
    success(`Campaign stopped → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Campaign stop failed → id=${id}`, err);
    throw err;
  }
});

// ==================== Account Groups Operations ====================
ipcMain.handle('accountGroups:list', async () => {
  try {
    const groups = await storage.getAccountGroups();
    return groups;
  } catch (err) {
    error('accountGroups:list failed', err);
    throw err;
  }
});

ipcMain.handle('accountGroups:create', async (_event, data) => {
  try {
    const group = await storage.createAccountGroup(data);
    success(`Account group created → id=${group.id} name="${group.name}"`);
    return group;
  } catch (err) {
    error(`Account group create failed → name="${data?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('accountGroups:delete', async (_event, id) => {
  try {
    await storage.deleteAccountGroup(id);
    success(`Account group deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Account group delete failed → id=${id}`, err);
    throw err;
  }
});

// ==================== GitHub Accounts Operations ====================
ipcMain.handle('githubAccounts:list', async (_event, groupId) => {
  try {
    const accounts = await storage.getGithubAccounts(groupId);
    return accounts;
  } catch (err) {
    error(`githubAccounts:list failed → groupId=${groupId}`, err);
    throw err;
  }
});

ipcMain.handle('githubAccounts:create', async (_event, data) => {
  try {
    const account = await storage.createGithubAccount(data);
    success(`GitHub account created → id=${account.id} username=${account.username}`);
    return account;
  } catch (err) {
    error(`GitHub account create failed → username=${data?.username}`, err);
    throw err;
  }
});

ipcMain.handle('githubAccounts:update', async (_event, id, updates) => {
  try {
    const account = await storage.updateGithubAccount(id, updates);
    return account;
  } catch (err) {
    error(`GitHub account update failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('githubAccounts:delete', async (_event, id) => {
  try {
    await storage.deleteGithubAccount(id);
    success(`GitHub account deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`GitHub account delete failed → id=${id}`, err);
    throw err;
  }
});

// ==================== Logs ====================
ipcMain.handle('logs:get', async (_event, { id, since = 0 }) => {
  try {
    const logs = await storage.getLogs(id, since);
    return logs;
  } catch (err) {
    error(`logs:get failed → campaignId=${id}`, err);
    throw err;
  }
});

ipcMain.handle('logs:clear', async (_event, { id }) => {
  try {
    await storage.clearLogs(id);
    success(`Logs cleared → campaignId=${id}`);
    return { ok: true };
  } catch (err) {
    error(`logs:clear failed → campaignId=${id}`, err);
    throw err;
  }
});

// ==================== Shell Operations ====================
ipcMain.handle('shell:openExternal', async (_event, url) => {
  try {
    const { shell } = await import('electron');
    await shell.openExternal(url);
    return { ok: true };
  } catch (err) {
    error(`shell:openExternal failed → ${url}`, err);
    throw err;
  }
});

// ==================== Stars Campaigns ====================
ipcMain.handle('starsCampaigns:list', async () => {
  try {
    const campaigns = await storage.getStarsCampaigns();
    return campaigns;
  } catch (err) {
    error('starsCampaigns:list failed', err);
    throw err;
  }
});

ipcMain.handle('starsCampaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createStarsCampaign(payload);
    success(`Stars campaign created → id=${campaign.id} name="${campaign.name}"`);
    return campaign;
  } catch (err) {
    error(`Stars campaign create failed → name="${payload?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('starsCampaigns:start', async (_event, { id }) => {
  try {
    await starsCampaignManager.startCampaign(id);
    success(`Stars campaign started → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Stars campaign start failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('starsCampaigns:stop', async (_event, { id }) => {
  try {
    await starsCampaignManager.stopCampaign(id);
    success(`Stars campaign stopped → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Stars campaign stop failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('starsCampaigns:delete', async (_event, id) => {
  try {
    await storage.deleteStarsCampaign(id);
    success(`Stars campaign deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Stars campaign delete failed → id=${id}`, err);
    throw err;
  }
});

// ==================== GoLogin ====================
ipcMain.handle('gologin:getFolders', async () => {
  try {
    const GOLOGIN_TOKEN = process.env.GOLOGIN_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OTAxZWFkMWQ5ZDQwMGQwNWVhNTRlOGYifQ.V1bHwt59yXUbP8wODHM_K0Pa2Ipf0wv8l06cP8zthmc';

    const response = await fetch('https://api.gologin.com/folders', {
      headers: {
        'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`GoLogin API error: HTTP ${response.status}`);
    }

    const folders = await response.json();

    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        try {
          const profilesResponse = await fetch(
            `https://api.gologin.com/browser/v2?folder=${encodeURIComponent(folder.name)}`,
            {
              headers: {
                'Authorization': `Bearer ${GOLOGIN_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (profilesResponse.ok) {
            const data = await profilesResponse.json();
            return { ...folder, profileCount: data.profiles?.length || 0 };
          }
          warn(`GoLogin: could not fetch profiles for folder "${folder.name}"`);
          return { ...folder, profileCount: 0 };
        } catch (e) {
          error(`GoLogin: profiles fetch failed for folder "${folder.name}"`, e);
          return { ...folder, profileCount: 0 };
        }
      })
    );

    return foldersWithCounts;
  } catch (err) {
    error('GoLogin getFolders failed', err);
    throw err;
  }
});

// ==================== Indexer Campaign Operations ====================
ipcMain.handle('indexerCampaigns:list', async () => {
  try {
    const campaigns = await storage.getIndexerCampaigns();
    return campaigns;
  } catch (err) {
    error('indexerCampaigns:list failed', err);
    throw err;
  }
});

ipcMain.handle('indexerCampaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createIndexerCampaign(payload);
    success(`Indexer campaign created → id=${campaign.id} name="${campaign.name}"`);
    return campaign;
  } catch (err) {
    error(`Indexer campaign create failed → name="${payload?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('indexerCampaigns:start', async (_event, { id }) => {
  try {
    await indexerCampaignManager.startCampaign(id);
    success(`Indexer campaign started → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Indexer campaign start failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('indexerCampaigns:stop', async (_event, { id }) => {
  try {
    await indexerCampaignManager.stopCampaign(id);
    success(`Indexer campaign stopped → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Indexer campaign stop failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('indexerCampaigns:delete', async (_event, id) => {
  try {
    await storage.deleteIndexerCampaign(id);
    success(`Indexer campaign deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Indexer campaign delete failed → id=${id}`, err);
    throw err;
  }
});

// ==================== GPT Accounts Operations ====================
ipcMain.handle('gptAccounts:list', async () => {
  try {
    const accounts = await storage.getGPTAccounts();
    return accounts;
  } catch (err) {
    error('gptAccounts:list failed', err);
    throw err;
  }
});

ipcMain.handle('gptAccounts:create', async (_event, payload) => {
  try {
    const account = await storage.createGPTAccount(payload);
    success(`GPT account created → id=${account.id} name="${account.name}"`);
    return account;
  } catch (err) {
    error(`GPT account create failed → name="${payload?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('gptAccounts:update', async (_event, id, updates) => {
  try {
    await storage.updateGPTAccount(id, updates);
    return true;
  } catch (err) {
    error(`GPT account update failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('gptAccounts:delete', async (_event, id) => {
  try {
    await storage.deleteGPTAccount(id);
    success(`GPT account deleted → id=${id}`);
    return true;
  } catch (err) {
    error(`GPT account delete failed → id=${id}`, err);
    throw err;
  }
});

// ==================== View Campaign Operations ====================
ipcMain.handle('viewCampaigns:list', async () => {
  try {
    const campaigns = await storage.getViewCampaigns();
    return campaigns;
  } catch (err) {
    error('viewCampaigns:list failed', err);
    throw err;
  }
});

ipcMain.handle('viewCampaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createViewCampaign(payload);
    success(`View campaign created → id=${campaign.id} name="${campaign.name}"`);
    return campaign;
  } catch (err) {
    error(`View campaign create failed → name="${payload?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('viewCampaigns:start', async (_event, { id }) => {
  try {
    const { viewCampaignManager } = await import('../services/viewCampaignManager.js');
    await viewCampaignManager.startCampaign(id);
    success(`View campaign started → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`View campaign start failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('viewCampaigns:stop', async (_event, { id }) => {
  try {
    const { viewCampaignManager } = await import('../services/viewCampaignManager.js');
    await viewCampaignManager.stopCampaign(id);
    success(`View campaign stopped → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`View campaign stop failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('viewCampaigns:delete', async (_event, id) => {
  try {
    await storage.deleteViewCampaign(id);
    success(`View campaign deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`View campaign delete failed → id=${id}`, err);
    throw err;
  }
});

// ==================== Upwork Campaign Operations ====================
ipcMain.handle('upworkCampaigns:list', async () => {
  try {
    const campaigns = await storage.getUpworkCampaigns();
    return campaigns;
  } catch (err) {
    error('upworkCampaigns:list failed', err);
    throw err;
  }
});

ipcMain.handle('upworkCampaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createUpworkCampaign(payload);
    success(`Upwork campaign created → id=${campaign.id} name="${campaign.name}"`);
    return campaign;
  } catch (err) {
    error(`Upwork campaign create failed → name="${payload?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('upworkCampaigns:start', async (_event, { id }) => {
  try {
    upworkCampaignManager.startCampaign(id).catch(err => {
      error(`Upwork campaign runtime error → id=${id}`, err);
    });
    success(`Upwork campaign launched → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Upwork campaign start failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('upworkCampaigns:stop', async (_event, { id }) => {
  try {
    await upworkCampaignManager.stopCampaign(id);
    success(`Upwork campaign stopped → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Upwork campaign stop failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('upworkCampaigns:delete', async (_event, id) => {
  try {
    await storage.deleteUpworkCampaign(id);
    success(`Upwork campaign deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Upwork campaign delete failed → id=${id}`, err);
    throw err;
  }
});

// ==================== Scrape-Jobs Campaign Operations ====================
ipcMain.handle('scrapeJobsCampaigns:list', async () => {
  try {
    const campaigns = await storage.getScrapeJobsCampaigns();
    return campaigns;
  } catch (err) {
    error('scrapeJobsCampaigns:list failed', err);
    throw err;
  }
});

ipcMain.handle('scrapeJobsCampaigns:create', async (_event, payload) => {
  try {
    const campaign = await storage.createScrapeJobsCampaign(payload);
    success(`Scrape-jobs campaign created → id=${campaign.id} name="${campaign.name}"`);
    return campaign;
  } catch (err) {
    error(`Scrape-jobs campaign create failed → name="${payload?.name}"`, err);
    throw err;
  }
});

ipcMain.handle('scrapeJobsCampaigns:start', async (_event, { id }) => {
  try {
    const { upworkCampaignManager: mgr } = await import('../services/upworkCampaignManager.js');
    mgr.startScrapeJobsCampaign(id).catch(err => {
      error(`Scrape-jobs campaign runtime error → id=${id}`, err);
    });
    success(`Scrape-jobs campaign launched → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Scrape-jobs campaign start failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('scrapeJobsCampaigns:stop', async (_event, { id }) => {
  try {
    const { upworkCampaignManager: mgr } = await import('../services/upworkCampaignManager.js');
    await mgr.stopCampaign(id);
    success(`Scrape-jobs campaign stopped → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Scrape-jobs campaign stop failed → id=${id}`, err);
    throw err;
  }
});

ipcMain.handle('scrapeJobsCampaigns:delete', async (_event, id) => {
  try {
    await storage.deleteScrapeJobsCampaign(id);
    success(`Scrape-jobs campaign deleted → id=${id}`);
    return { ok: true };
  } catch (err) {
    error(`Scrape-jobs campaign delete failed → id=${id}`, err);
    throw err;
  }
});

section('All IPC Handlers Registered');
