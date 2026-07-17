import React, { useState, useEffect } from 'react';
import { PlusCircle, Database, Search, ShieldCheck, ShieldAlert, GitBranch, MessageSquare, AlertCircle } from 'lucide-react';
import { GitHubRepo, GitHubOrg } from '../types';

interface RepoSelectorProps {
  repos: GitHubRepo[];
  orgs: GitHubOrg[];
  username: string;
  loading: boolean;
  onRepoConfigChange: (config: RepoConfig) => void;
}

export interface RepoConfig {
  mode: 'create' | 'existing';
  owner: string;
  name: string;
  description: string;
  isPrivate: boolean;
  initReadme: boolean;
  generateReadmeFromDesc: boolean;
  selectedRepoFullName: string;
  branch: string;
  commitMessage: string;
}

export default function RepoSelector({
  repos,
  orgs,
  username,
  loading,
  onRepoConfigChange,
}: RepoSelectorProps) {
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [owner, setOwner] = useState(username || '');
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [initReadme, setInitReadme] = useState(true);
  const [generateReadmeFromDesc, setGenerateReadmeFromDesc] = useState(true);
  
  const [selectedRepo, setSelectedRepo] = useState<string>(repos[0]?.full_name || '');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('Upload project files via RepostNow 🚀');
  const [searchQuery, setSearchQuery] = useState('');

  // Update owner when username changes
  useEffect(() => {
    if (username) {
      setOwner(username);
    }
  }, [username]);

  // Sync selectedRepo when repos change
  useEffect(() => {
    if (repos.length > 0 && !selectedRepo) {
      setSelectedRepo(repos[0].full_name);
      setBranch(repos[0].default_branch || 'main');
    }
  }, [repos, selectedRepo]);

  // Update default branch when selected repo changes
  const handleRepoSelect = (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    const repo = repos.find(r => r.full_name === repoFullName);
    if (repo) {
      setBranch(repo.default_branch || 'main');
    }
  };

  // Keep repo name safe for GitHub
  const handleRepoNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Format: lowercase, replace spaces with hyphens, filter special chars
    const formatted = rawValue
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_.]/g, '');
    setRepoName(formatted);
  };

  // Push latest config to parent component
  useEffect(() => {
    onRepoConfigChange({
      mode,
      owner,
      name: repoName,
      description,
      isPrivate,
      initReadme,
      generateReadmeFromDesc,
      selectedRepoFullName: selectedRepo,
      branch,
      commitMessage: commitMessage.trim() || 'Upload project files via RepostNow',
    });
  }, [mode, owner, repoName, description, isPrivate, initReadme, generateReadmeFromDesc, selectedRepo, branch, commitMessage]);

  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <div className="bg-[#141417] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="font-semibold text-slate-100 text-lg">Repository Settings</h3>
          <p className="text-slate-400 text-sm">Choose where you want to upload your repository.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#0A0A0B] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setMode('create')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition duration-200 ${
              mode === 'create'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Repo</span>
          </button>
          <button
            onClick={() => setMode('existing')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition duration-200 ${
              mode === 'existing'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Existing Repo</span>
          </button>
        </div>
      </div>

      {mode === 'create' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Owner selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Repository Owner
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/50 text-sm transition"
              >
                <option value={username || ''}>
                  {username ? `${username} (You)` : 'Loading owner...'}
                </option>
                {orgs.map((org, index) => (
                  <option key={`sel-org-${org.id || org.login || index}`} value={org.login}>
                    {org.login} (Organization)
                  </option>
                ))}
              </select>
            </div>

            {/* Repository Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Repository Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={repoName}
                onChange={handleRepoNameChange}
                placeholder="my-awesome-project"
                required
                className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono text-sm transition placeholder-slate-700"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Description <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A spectacular project uploaded with RepostNow"
              className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/50 text-sm transition placeholder-slate-700"
            />
          </div>

          {/* Auto-generate README checkbox */}
          <div
            onClick={() => setGenerateReadmeFromDesc(!generateReadmeFromDesc)}
            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer select-none transition ${
              generateReadmeFromDesc
                ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400'
                : 'bg-[#0A0A0B] border-white/10 text-slate-400'
            }`}
          >
            <div className="relative flex items-center justify-center w-4 h-4 border border-white/10 rounded bg-[#0A0A0B]">
              {generateReadmeFromDesc && <div className="w-2 h-2 bg-indigo-500 rounded-sm" />}
            </div>
            <div>
              <p className="font-semibold text-xs text-slate-200">Generate README.md based on Description</p>
              <p className="text-[10px] text-slate-400">Automatically creates README.md from the description above when pushing.</p>
            </div>
          </div>

          {/* Privacy and README checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div
              onClick={() => setIsPrivate(!isPrivate)}
              className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition ${
                isPrivate
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                  : 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400'
              }`}
            >
              {isPrivate ? <ShieldAlert className="w-5 h-5 flex-shrink-0" /> : <ShieldCheck className="w-5 h-5 flex-shrink-0" />}
              <div>
                <p className="font-semibold text-sm text-slate-200">
                  {isPrivate ? 'Private Repository' : 'Public Repository'}
                </p>
                <p className="text-xs text-slate-400">
                  {isPrivate ? 'Only you and collaborators can view' : 'Anyone on the internet can view'}
                </p>
              </div>
            </div>

            <div
              onClick={() => setInitReadme(!initReadme)}
              className={`flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition ${
                initReadme
                  ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400'
                  : 'bg-[#0A0A0B] border-white/10 text-slate-400'
              }`}
            >
              <div className="relative flex items-center justify-center w-5 h-5 border border-white/10 rounded-md bg-[#0A0A0B]">
                {initReadme && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />}
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-200">Initialize with README</p>
                <p className="text-xs text-slate-400">Creates an initial README.md automatically</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select Existing Repo */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Repository
            </label>
            
            {repos.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>No repositories found. Ensure your PAT has the correct scopes.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Search bar within repository select */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/50 text-sm transition placeholder-slate-700"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto border border-white/10 bg-[#0A0A0B] rounded-xl divide-y divide-white/5 custom-scrollbar">
                  {filteredRepos.length === 0 ? (
                    <p className="p-4 text-center text-slate-500 text-sm">No matching repositories found</p>
                  ) : (
                    filteredRepos.map((repo, index) => (
                      <div
                        key={`sel-repo-${repo.id || repo.full_name || index}`}
                        onClick={() => handleRepoSelect(repo.full_name)}
                        className={`p-3 cursor-pointer flex items-center justify-between text-sm transition ${
                          selectedRepo === repo.full_name
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-300 hover:bg-[#141417]'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{repo.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{repo.full_name}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          repo.private
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : 'bg-slate-800 border-white/5 text-slate-400'
                        }`}>
                          {repo.private ? 'Private' : 'Public'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shared Branch and Commit Message (Applicable for both modes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-5">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
            <span>Target Branch</span>
          </label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value.replace(/\s+/g, '-'))}
            placeholder="main"
            className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/50 font-mono text-sm transition placeholder-slate-700"
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Commit Message</span>
          </label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Upload project files via RepostNow 🚀"
            className="w-full px-3 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/50 text-sm transition placeholder-slate-700"
          />
        </div>
      </div>
    </div>
  );
}
