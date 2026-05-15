import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trash2, ChevronRight, UserCheck } from 'lucide-react';

export default function AccountsGroup() {
  const navigate = useNavigate();
  const [accountGroups, setAccountGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAccountGroups();
  }, []);

  const loadAccountGroups = async () => {
    try {
      setLoading(true);
      const groups = await window.api.listAccountGroups();
      setAccountGroups(groups);
    } catch (error) {
      console.error('Failed to load account groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setCreating(true);
      await window.api.createAccountGroup({ name: newGroupName.trim() });
      setNewGroupName('');
      setShowCreateModal(false);
      loadAccountGroups();
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create account group');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!confirm(`Are you sure you want to delete "${groupName}"? This will also delete all accounts in this group.`)) {
      return;
    }

    try {
      await window.api.deleteAccountGroup(groupId);
      loadAccountGroups();
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('Failed to delete account group');
    }
  };

  const handleGroupClick = (groupId, groupName) => {
    navigate(`/account-groups/${groupId}`, { state: { groupName } });
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-neutral-950/80 to-neutral-950/60 backdrop-blur-xl">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                  Account Groups
                </h1>
              </div>
              <p className="text-neutral-400 text-sm ml-[52px]">
                Manage your GitHub account groups and their associated accounts
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium transition-all duration-200 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-neutral-400 text-sm">Loading account groups...</p>
            </div>
          </div>
        ) : accountGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Account Groups Yet</h3>
            <p className="text-neutral-400 mb-6 max-w-md">
              Create your first account group to organize and manage your GitHub accounts
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Create Your First Group
            </button>
          </div>
        ) : (
          <div className="max-w-4xl">
            <div className="grid gap-3">
              {accountGroups.map((group) => (
                <div
                  key={group.id}
                  className="group relative bg-gradient-to-r from-neutral-900/50 to-neutral-900/30 border border-white/10 rounded-xl p-5 hover:border-purple-500/50 transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-purple-500/10"
                  onClick={() => handleGroupClick(group.id, group.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                        <Users className="w-6 h-6 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">
                          {group.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-neutral-400">
                          <UserCheck className="w-4 h-4" />
                          <span>
                            {group.accountCount || 0} {group.accountCount === 1 ? 'account' : 'accounts'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id, group.name);
                        }}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all duration-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Create Account Group</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Create a new group to organize your GitHub accounts
              </p>
            </div>
            <form onSubmit={handleCreateGroup} className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Production Accounts, Test Accounts"
                  className="input-modern focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}