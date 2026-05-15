import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, X } from 'lucide-react';

export default function Settings() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [gptAccounts, setGptAccounts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAppInfo();
    loadGPTAccounts();
  }, []);

  const loadAppInfo = async () => {
    if (window.api && typeof window.api.getAppInfo === 'function') {
      window.api.getAppInfo()
        .then(setInfo)
        .catch((err) => setError('Failed to load app info'));
    } else {
      setError('Not running in Electron or API bridge unavailable');
    }
  };

  const loadGPTAccounts = async () => {
    try {
      const accounts = await window.api.listGPTAccounts();
      setGptAccounts(accounts);
    } catch (err) {
      console.error('Failed to load GPT accounts:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this GPT account?')) return;
    
    try {
      await window.api.deleteGPTAccount(id);
      await loadGPTAccounts();
    } catch (err) {
      console.error('Failed to delete GPT account:', err);
      alert('Failed to delete GPT account');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      
      {/* App Info Card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="text-neutral-400">App Info</div>
        {error ? (
          <div className="mt-2 text-red-400">{error}</div>
        ) : (
          <>
            <div className="mt-2">Name: {info?.name}</div>
            <div>Version: {info?.version}</div>
            <div>User data: {info?.userDataPath}</div>
          </>
        )}
      </div>

      {/* ChatGPT Accounts Section */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">ChatGPT Accounts</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white hover:from-green-600 hover:to-emerald-600 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        </div>

        {/* Accounts List */}
        <div className="space-y-3">
          {gptAccounts.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              No ChatGPT accounts saved yet
            </div>
          ) : (
            gptAccounts.map((account) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:border-green-500/50 transition-colors"
              >
                <div>
                  <div className="font-medium">{account.name}</div>
                  <div className="text-sm text-neutral-400">
                    {account.cookies?.length || 0} cookies • Created {new Date(account.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Add Account Modal */}
      <AddGPTAccountModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadGPTAccounts}
      />
    </div>
  );
}

function AddGPTAccountModal({ open, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [cookiesJson, setCookiesJson] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Account name is required');
      return;
    }

    if (!cookiesJson.trim()) {
      setError('Cookies JSON is required');
      return;
    }

    // Validate JSON
    let cookies;
    try {
      cookies = JSON.parse(cookiesJson);
      if (!Array.isArray(cookies)) {
        setError('Cookies must be a JSON array');
        return;
      }
    } catch (err) {
      setError('Invalid JSON format');
      return;
    }

    setLoading(true);

    try {
      await window.api.createGPTAccount({
        name: name.trim(),
        cookies: cookies
      });

      setName('');
      setCookiesJson('');
      onClose();
      onSuccess();
    } catch (err) {
      console.error('Failed to create GPT account:', err);
      setError('Failed to create account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-xl"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-neutral-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="mb-6 text-2xl font-semibold">Add ChatGPT Account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Name */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., John Doe"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-neutral-500 focus:border-green-500 focus:outline-none"
              />
            </div>

            {/* Cookies JSON */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                Cookies JSON
              </label>
              <textarea
                value={cookiesJson}
                onChange={(e) => setCookiesJson(e.target.value)}
                placeholder='[{"name": "cookie_name", "value": "cookie_value", ...}]'
                rows={12}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-white placeholder-neutral-500 focus:border-green-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-neutral-400">
                Paste the cookies array in JSON format (exported from browser extension)
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
