import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Github, Plus, Trash2, ArrowLeft, GitBranch, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

export default function GithubAccounts() {
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const groupName = location.state?.groupName || 'Account Group';

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [proxyBulks, setProxyBulks] = useState([]);
  const [selectedProxies, setSelectedProxies] = useState([]);
  const [formData, setFormData] = useState({
    username: '',
    accessToken: '',
    proxy: ''
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadProxyBulks();
  }, [groupId]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await window.api.listGithubAccounts(groupId);
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProxyBulks = async () => {
    try {
      const bulks = await window.api.listProxyBulks();
      setProxyBulks(bulks);
    } catch (error) {
      console.error('Failed to load proxy bulks:', error);
    }
  };

  const handleProxyBulkChange = (bulkId) => {
    if (!bulkId) {
      setSelectedProxies([]);
      setFormData({ ...formData, proxy: '' });
      return;
    }
    
    const bulk = proxyBulks.find(b => b.id === bulkId);
    if (bulk && bulk.proxies) {
      setSelectedProxies(bulk.proxies);
      setFormData({ ...formData, proxy: '' });
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.accessToken.trim()) return;

    try {
      setAdding(true);
      const result = await window.api.createGithubAccount({
        groupId,
        username: formData.username.trim(),
        accessToken: formData.accessToken.trim(),
        proxy: formData.proxy || null
      });
      if (result && result.ok === false) {
        // Show a user-friendly error
        alert(result.error || 'Failed to add GitHub account');
        setAdding(false);
        return;
      }
      setFormData({ username: '', accessToken: '', proxy: '' });
      setSelectedProxies([]);
      setShowAddModal(false);
      loadAccounts();
    } catch (error) {
      console.error('Failed to add account:', error);
      alert(error?.message || 'Failed to add GitHub account. Please check your credentials and try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAccount = async (accountId, username) => {
    if (!confirm(`Are you sure you want to delete the account "${username}"?`)) {
      return;
    }

    try {
      await window.api.deleteGithubAccount(accountId);
      loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account');
    }
  };

  const getStatusBadge = (account) => {
    const repoCount = account.repoCount || 0;
    
    // Account is disabled if it has 15 or more repos
    if (repoCount >= 15) {
      return (
        <span className="badge badge-error">
          <AlertCircle className="w-3.5 h-3.5" />
          Disabled (15+ repos)
        </span>
      );
    }
    
    // Otherwise use the stored status
    const badges = {
      active: { color: 'badge-success', icon: CheckCircle, text: 'Active' },
      error: { color: 'badge-error', icon: XCircle, text: 'Error' },
      pending: { color: 'badge-warning', icon: Clock, text: 'Pending' }
    };
    const badge = badges[account.status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`badge ${badge.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {badge.text}
      </span>
    );
  };

  const getRepoCountDisplay = (repoCount) => {
    const count = repoCount || 0;
    const isNearLimit = count >= 12;
    const isAtLimit = count >= 15;
    
    return (
      <div className={`flex items-center gap-2 ${
        isAtLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-neutral-400'
      }`}>
        <GitBranch className="w-4 h-4" />
        <span>
          {count}/15 {count === 1 ? 'repository' : 'repositories'}
        </span>
        {isAtLimit && (
          <span className="text-xs text-red-400 font-semibold">(Limit Reached)</span>
        )}
        {isNearLimit && !isAtLimit && (
          <span className="text-xs text-yellow-400 font-semibold">(Near Limit)</span>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-neutral-950/80 to-neutral-950/60 backdrop-blur-xl">
        <div className="px-8 py-6">
          <button
            onClick={() => navigate('/account-groups')}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Account Groups</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Github className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                    {groupName}
                  </h1>
                  <p className="text-neutral-400 text-sm mt-0.5">
                    Manage GitHub accounts in this group
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-neutral-400 text-sm">Loading accounts...</p>
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Github className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Accounts Yet</h3>
            <p className="text-neutral-400 mb-6 max-w-md">
              Add your first GitHub account to start automating repository creation
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Add Your First Account
            </button>
          </div>
        ) : (
          <div className="max-w-5xl">
            <div className="grid gap-3">
              {accounts.map((account) => {
                const repoCount = account.repoCount || 0;
                const isDisabled = repoCount >= 15;
                
                return (
                  <div
                    key={account.id}
                    className={`group relative bg-gradient-to-r from-neutral-900/50 to-neutral-900/30 border rounded-xl p-5 transition-all duration-200 ${
                      isDisabled 
                        ? 'border-red-500/30 opacity-60' 
                        : 'border-white/10 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center border ${
                          isDisabled 
                            ? 'from-red-500/20 to-red-500/20 border-red-500/30' 
                            : 'from-blue-500/20 to-purple-500/20 border-blue-500/30'
                        }`}>
                          <Github className={`w-6 h-6 ${isDisabled ? 'text-red-400' : 'text-blue-400'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">
                              {account.username}
                            </h3>
                            {getStatusBadge(account)}
                            {account.assignedProxy && (
                              <span className="badge badge-info text-xs">
                                🔒 Proxy Bound
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            {getRepoCountDisplay(repoCount)}
                            {account.lastUsed && (
                              <div className="flex items-center gap-2 text-neutral-400">
                                <Clock className="w-4 h-4" />
                                <span>
                                  Last used {new Date(account.lastUsed).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {account.assignedProxy && (
                              <div className="flex items-center gap-2 text-cyan-400">
                                <span className="text-xs">
                                  🔒 {account.assignedProxy.substring(0, 30)}...
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAccount(account.id, account.username)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Add GitHub Account</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Connect a GitHub account using a personal access token
              </p>
            </div>
            <form onSubmit={handleAddAccount} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    GitHub Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g., octocat"
                    className="input-modern focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Personal Access Token
                  </label>
                  <input
                    type="password"
                    value={formData.accessToken}
                    onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="input-modern focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Generate a token at{' '}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      github.com/settings/tokens
                    </a>
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Proxy (Optional)
                  </label>
                  <select
                    onChange={(e) => handleProxyBulkChange(e.target.value)}
                    className="input-modern focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-2"
                  >
                    <option value="">Select a proxy bulk first...</option>
                    {proxyBulks.map((bulk) => (
                      <option key={bulk.id} value={bulk.id}>
                        {bulk.name} ({bulk.proxies?.length || 0} proxies)
                      </option>
                    ))}
                  </select>
                  
                  {selectedProxies.length > 0 && (
                    <select
                      value={formData.proxy}
                      onChange={(e) => setFormData({ ...formData, proxy: e.target.value })}
                      className="input-modern focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="">No proxy</option>
                      {selectedProxies.map((proxy, index) => (
                        <option key={index} value={proxy}>
                          {proxy.substring(0, 50)}...
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-neutral-500 mt-2">
                    Select a proxy to bind to this account for all repository operations
                  </p>
                </div>

                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400">
                    ⚠️ Note: Accounts with 15 or more repositories will be automatically disabled
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={adding}
                >
                  {adding ? 'Adding...' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}