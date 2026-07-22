import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, FolderGit, FolderUp, RefreshCw, AlertCircle, Play, CheckCircle, Sliders, Sparkles, TrendingUp, LayoutGrid } from 'lucide-react';

import { GitHubUser, GitHubRepo, GitHubOrg, UploadFile, UploadSession } from './types';
import { verifyToken, fetchUserRepos, fetchUserOrgs, createRepository, uploadFilesToGithub } from './utils/github';
import { processSelectedFiles } from './utils/fileTraverser';
import { safeStorage } from './utils/storage';

import TokenInput from './components/TokenInput';
import RepoSelector, { RepoConfig } from './components/RepoSelector';
import FolderDropzone from './components/FolderDropzone';
import FileTree from './components/FileTree';
import UploadProgressPanel from './components/UploadProgressPanel';
import SettingsPanel from './components/SettingsPanel';
import StatsDashboard from './components/StatsDashboard';
import AiAssistantPanel from './components/AiAssistantPanel';

const STORAGE_KEY = 'repostnow_github_token';

export default function App() {
  const [token, setToken] = useState<string>(() => safeStorage.getItem(STORAGE_KEY) || '');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [orgs, setOrgs] = useState<GitHubOrg[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai' | 'stats' | 'settings'>('dashboard');

  const [accounts, setAccounts] = useState<Array<{ token: string; user: GitHubUser }>>(() => {
    try {
      const stored = safeStorage.getItem('repostnow_linked_accounts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync accounts to localStorage
  useEffect(() => {
    safeStorage.setItem('repostnow_linked_accounts', JSON.stringify(accounts));
  }, [accounts]);

  const addAccountLink = useCallback((tokenVal: string, userVal: GitHubUser) => {
    setAccounts(prev => {
      const exists = prev.some(acc => acc.user.login.toLowerCase() === userVal.login.toLowerCase());
      if (exists) {
        return prev.map(acc => acc.user.login.toLowerCase() === userVal.login.toLowerCase() ? { token: tokenVal, user: userVal } : acc);
      }
      if (prev.length >= 3) {
        alert('You can link up to 3 GitHub accounts maximum. Please remove an account link first.');
        return prev;
      }
      return [...prev, { token: tokenVal, user: userVal }];
    });
  }, []);

  const handleSwitchAccount = useCallback((targetToken: string) => {
    const acc = accounts.find(a => a.token === targetToken);
    if (acc) {
      setToken(targetToken);
      setUser(acc.user);
      safeStorage.setItem(STORAGE_KEY, targetToken);
    }
  }, [accounts]);

  const handleRemoveAccount = useCallback((login: string) => {
    setAccounts(prev => {
      const filtered = prev.filter(a => a.user.login.toLowerCase() !== login.toLowerCase());
      if (user?.login.toLowerCase() === login.toLowerCase()) {
        if (filtered.length > 0) {
          setToken(filtered[0].token);
          setUser(filtered[0].user);
          safeStorage.setItem(STORAGE_KEY, filtered[0].token);
        } else {
          // Disconnect completely if no other accounts
          setToken('');
          setUser(null);
          setRepos([]);
          setOrgs([]);
          safeStorage.removeItem(STORAGE_KEY);
          setFiles([]);
        }
      }
      return filtered;
    });
  }, [user]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Files currently staged
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [unpackZip, setUnpackZip] = useState<boolean>(true);
  
  // Repo configuration from components
  const [repoConfig, setRepoConfig] = useState<RepoConfig | null>(null);

  // Current upload session state
  const [session, setSession] = useState<UploadSession>({
    status: 'idle',
    progress: 0,
    currentFileIndex: 0,
    totalFiles: 0,
  });

  // Fetch user repos & orgs
  const handleRefreshRepos = useCallback(async (activeToken: string = token) => {
    if (!activeToken) return;
    
    // 1. Load instantly from sessionStorage cache if available for near 0ms latency
    const cacheKeyRepos = `repostnow_cache_repos_${activeToken.slice(-8)}`;
    const cacheKeyOrgs = `repostnow_cache_orgs_${activeToken.slice(-8)}`;
    const cachedRepos = sessionStorage.getItem(cacheKeyRepos);
    const cachedOrgs = sessionStorage.getItem(cacheKeyOrgs);
    
    if (cachedRepos && cachedOrgs) {
      try {
        setRepos(JSON.parse(cachedRepos));
        setOrgs(JSON.parse(cachedOrgs));
      } catch (e) {
        // Ignore parsing errors
      }
    }

    try {
      // 2. Fetch fresh values in parallel
      const [userRepos, userOrgs] = await Promise.all([
        fetchUserRepos(activeToken),
        fetchUserOrgs(activeToken),
      ]);
      
      setRepos(userRepos);
      setOrgs(userOrgs);
      
      // 3. Populate sessionStorage cache for next load
      sessionStorage.setItem(cacheKeyRepos, JSON.stringify(userRepos));
      sessionStorage.setItem(cacheKeyOrgs, JSON.stringify(userOrgs));
    } catch (fetchErr) {
      console.error('Failed to load full repositories list:', fetchErr);
    }
  }, [token]);

  // Verify token and fetch profile details
  const handleConnectToken = useCallback(async (newToken: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const gitUser = await verifyToken(newToken);
      setUser(gitUser);
      setToken(newToken);
      safeStorage.setItem(STORAGE_KEY, newToken);
      addAccountLink(newToken, gitUser);

      // Fetch user repos & orgs
      await handleRefreshRepos(newToken);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate token. Please check validity.');
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleRefreshRepos, addAccountLink]);

  // Run on mount to check if token exists
  useEffect(() => {
    if (token) {
      handleConnectToken(token).catch((err) => {
        console.error('Initial token connection failed:', err);
      });
    }
  }, [token, handleConnectToken]);

  // Handle disconnecting
  const handleDisconnect = () => {
    setToken('');
    setUser(null);
    setRepos([]);
    setOrgs([]);
    safeStorage.removeItem(STORAGE_KEY);
    setFiles([]);
  };

  // Handle immediate local removal of a deleted repository (counteract API consistency lag)
  const handleDeleteRepoSuccess = useCallback((repoId: number) => {
    setRepos((prev) => {
      const filtered = prev.filter((r) => r.id !== repoId);
      const cacheKeyRepos = `repostnow_cache_repos_${token.slice(-8)}`;
      sessionStorage.setItem(cacheKeyRepos, JSON.stringify(filtered));
      return filtered;
    });
  }, [token]);

  // Handle immediate local update of modified repository settings (counteract API consistency lag)
  const handleUpdateRepoSuccess = useCallback((repoId: number, name: string, isPrivate: boolean) => {
    setRepos((prev) => {
      const updated = prev.map((r) => r.id === repoId ? { ...r, name, private: isPrivate, full_name: `${r.owner?.login}/${name}` } : r);
      const cacheKeyRepos = `repostnow_cache_repos_${token.slice(-8)}`;
      sessionStorage.setItem(cacheKeyRepos, JSON.stringify(updated));
      return updated;
    });
  }, [token]);


  // Add files to staging, avoiding duplicates based on relative path
  const handleFilesSelected = async (rawFiles: UploadFile[]) => {
    try {
      const newFiles = await processSelectedFiles(rawFiles, unpackZip);
      setFiles((prev) => {
        const merged = [...prev];
        newFiles.forEach((newFile) => {
          const index = merged.findIndex((f) => f.path === newFile.path);
          if (index !== -1) {
            // Replace existing file if re-uploaded
            merged[index] = newFile;
          } else {
            merged.push(newFile);
          }
        });
        return merged;
      });
    } catch (err: any) {
      console.error("Error processing selected files:", err);
      setError("Failed to extract or read some of the selected files/folders.");
    }
  };

  // Remove a staged file
  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Clear staged files
  const handleClearAll = () => {
    setFiles([]);
  };

  // Reset upload session back to idle
  const handleResetSession = () => {
    setSession({
      status: 'idle',
      progress: 0,
      currentFileIndex: 0,
      totalFiles: 0,
    });
    // Set all file statuses back to pending
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        status: 'pending',
        progress: 0,
        sha: undefined,
        error: undefined,
      }))
    );
  };

  const makeReadmeFile = (repoName: string, desc: string, filesList: UploadFile[]): UploadFile => {
    const content = `# ${repoName}

${desc.trim() || 'A project uploaded via RepostNow.'}

## Staged Files
This repository contains the following files uploaded using **RepostNow**:
${filesList.map(f => `- \`${f.path}\` (${(f.size / 1024).toFixed(2)} KB)`).join('\n')}

---
_Generated automatically with [RepostNow](https://repostnow.dev) - Direct-to-GitHub Repository Upload Engine._
`;
    const fileObj = new File([content], 'README.md', { type: 'text/markdown' });
    return {
      id: 'auto-readme',
      name: 'README.md',
      path: 'README.md',
      size: fileObj.size,
      type: 'text/markdown',
      file: fileObj,
      status: 'pending',
      progress: 0,
    };
  };

  // Run the repository push!
  const handlePushRepository = async () => {
    if (files.length === 0) return;
    if (!repoConfig) return;

    let filesToUpload = [...files];
    if (repoConfig.generateReadmeFromDesc && repoConfig.description.trim()) {
      const activeName = repoConfig.mode === 'create' ? repoConfig.name : repoConfig.selectedRepoFullName.split('/')[1];
      const readmeFile = makeReadmeFile(activeName, repoConfig.description, files);
      filesToUpload = filesToUpload.filter(f => f.path.toLowerCase() !== 'readme.md');
      filesToUpload.push(readmeFile);
      setFiles(filesToUpload);
    }

    // Live API upload
    if (!token) return;

    const { mode, owner, name, description, isPrivate, initReadme, selectedRepoFullName, branch, commitMessage } = repoConfig;

    try {
      let activeOwner = owner;
      let activeRepoName = name;

      if (mode === 'create') {
        if (!name) {
          throw new Error('Please enter a repository name.');
        }
        setSession({ status: 'preparing', progress: 5, currentFileIndex: 0, totalFiles: filesToUpload.length });
        const createdRepo = await createRepository(token, owner, name, description, isPrivate, initReadme);
        activeOwner = createdRepo.owner?.login || owner;
        activeRepoName = createdRepo.name;
      } else {
        // Uploading to existing
        if (!selectedRepoFullName) {
          throw new Error('Please select an existing repository.');
        }
        const [parsedOwner, parsedName] = selectedRepoFullName.split('/');
        activeOwner = parsedOwner;
        activeRepoName = parsedName;
      }

      // Call the Git database API upload flow
      await uploadFilesToGithub(
        token,
        activeOwner,
        activeRepoName,
        branch,
        filesToUpload,
        commitMessage,
        {
          onSessionChange: (updates) => setSession((prev) => ({ ...prev, ...updates })),
          onFileChange: (fileId, updates) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
            );
          },
        }
      );

      // Save successful push to Repository Addition History
      try {
        const stored = localStorage.getItem('repostnow_repo_history');
        const history = stored ? JSON.parse(stored) : [];
        const newEntry = {
          id: crypto.randomUUID(),
          repoName: activeRepoName,
          owner: activeOwner,
          mode: repoConfig.mode,
          isPrivate: repoConfig.isPrivate,
          timestamp: new Date().toLocaleString(),
          filesCount: filesToUpload.length,
          status: 'success'
        };
        localStorage.setItem('repostnow_repo_history', JSON.stringify([newEntry, ...history].slice(0, 25)));
      } catch (histErr) {
        console.error('Failed to save repository history:', histErr);
      }
    } catch (err: any) {
      console.error(err);
      setSession((prev) => ({
        ...prev,
        status: 'error',
        error: err.message || 'An error occurred during upload',
      }));
    }
  };

  const isUploading = session.status !== 'idle' && session.status !== 'success' && session.status !== 'error';
  const hasStagedFiles = files.length > 0;
  const isFormValid = !!(user && repoConfig && (repoConfig.mode === 'existing' ? !!repoConfig.selectedRepoFullName : !!repoConfig.name));

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070709] text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-300 relative">
      {/* Decorative Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* TOP HEADER */}
      <header className="shrink-0 h-14 bg-[#0B0B0E]/90 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl shadow-lg shadow-indigo-500/15 flex items-center justify-center">
            <FolderGit className="w-4 h-4 text-white" />
          </div>
          <div className="text-left flex items-center gap-2">
            <h1 className="text-sm font-extrabold text-white tracking-tight font-sans">RepostNow Code Studio</h1>
            <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono px-2 py-0.5 rounded-full">v5.0</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Status */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-mono text-emerald-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>AI Online</span>
          </div>

          {user && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[#121215] border border-white/5 rounded-full text-xs font-mono text-slate-300">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
              <span className="truncate max-w-[120px]">@{user.login}</span>
            </div>
          )}

          <button
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-xl border transition ${activeTab === 'settings' ? 'text-indigo-400 border-indigo-500/25 bg-indigo-500/10' : 'text-slate-400 hover:text-white bg-white/5 border-white/5'}`}
            title="Open settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className={`flex-1 min-h-0 z-10 flex flex-col ${activeTab === 'ai' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <main className={`flex-1 w-full mx-auto flex flex-col min-h-0 ${
          activeTab === 'ai' ? 'p-0 max-w-none h-full' : 'p-4 sm:p-6 max-w-7xl'
        }`}>
          <AnimatePresence mode="wait">
            {session.status !== 'idle' ? (
              <motion.div
                key="progress-panel"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-2xl mx-auto py-10 my-auto w-full"
              >
                <UploadProgressPanel
                  session={session}
                  owner={repoConfig?.mode === 'create' ? repoConfig?.owner || '' : repoConfig?.selectedRepoFullName.split('/')[0] || ''}
                  repoName={repoConfig?.mode === 'create' ? repoConfig?.name || '' : repoConfig?.selectedRepoFullName.split('/')[1] || ''}
                  branch={repoConfig?.branch || 'main'}
                  onReset={handleResetSession}
                />
              </motion.div>
            ) : (
              <div className="h-full flex flex-col flex-1 min-h-0">
                {/* 1. DASHBOARD VIEW */}
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto"
                  >
                    {/* Left Column: Accounts & Repo Configuration */}
                    <div className="lg:col-span-5 space-y-6">
                      <TokenInput
                        token={token}
                        user={user}
                        loading={loading}
                        error={error}
                        onConnect={handleConnectToken}
                        onDisconnect={handleDisconnect}
                      />

                      {user ? (
                        <motion.div
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <RepoSelector
                            repos={repos}
                            orgs={orgs}
                            username={user.login}
                            loading={loading}
                            onRepoConfigChange={setRepoConfig}
                          />
                        </motion.div>
                      ) : (
                        <div className="bg-[#141417]/40 border border-white/5 rounded-2xl p-8 text-center text-slate-500 border-dashed">
                          <Github className="w-8 h-8 mx-auto mb-3 opacity-30 text-indigo-400" />
                          <p className="text-xs leading-normal">
                            Please connect your GitHub account using your Personal Access Token, or open the settings tab to configure credentials securely.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Files Upload & Tree */}
                    <div className="lg:col-span-7 space-y-6 flex flex-col h-full">
                      <FolderDropzone
                        onFilesSelected={handleFilesSelected}
                        disabled={isUploading}
                        unpackZip={unpackZip}
                        onToggleUnpackZip={() => setUnpackZip(prev => !prev)}
                      />

                      <FileTree
                        files={files}
                        onRemoveFile={handleRemoveFile}
                        onClearAll={handleClearAll}
                        disabled={isUploading}
                      />

                      {hasStagedFiles && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 bg-[#141417] border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto shadow-2xl"
                        >
                          <div className="text-left">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ready to push</p>
                            <h4 className="font-bold text-slate-100 text-base">
                              {files.length} {files.length === 1 ? 'file' : 'files'} staged for upload
                            </h4>
                            {repoConfig && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Pushing to{' '}
                                <strong className="text-indigo-400 font-mono font-medium">
                                  {repoConfig.mode === 'create'
                                    ? `${repoConfig.owner}/${repoConfig.name || '[Unnamed Repo]'}`
                                    : repoConfig.selectedRepoFullName}
                                </strong>{' '}
                                on branch <strong className="text-slate-300 font-mono font-medium">{repoConfig.branch}</strong>
                              </p>
                            )}
                          </div>

                          <button
                            onClick={handlePushRepository}
                            disabled={!isFormValid || isUploading}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/15 disabled:shadow-none transition duration-200"
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>Upload Repository</span>
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 2. AI CODING ASSISTANT VIEW */}
                {activeTab === 'ai' && (
                  <motion.div
                    key="ai-assistant"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="h-full flex flex-col flex-1 min-h-0 shadow-2xl overflow-hidden"
                  >
                    <AiAssistantPanel
                      stagedFiles={files}
                      onUpdateStagedFiles={setFiles}
                      repos={repos}
                    />
                  </motion.div>
                )}

                {/* 3. STATISTICS & METRICS VIEW */}
                {activeTab === 'stats' && (
                  <motion.div
                    key="statistics"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-6"
                  >
                    <StatsDashboard
                      stagedFiles={files}
                    />
                  </motion.div>
                )}

                {/* 4. INLINE WORKSPACE SETTINGS & REPOS CONFIG VIEW */}
                {activeTab === 'settings' && (
                  <motion.div
                    key="settings-inline"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="h-full flex flex-col flex-1 min-h-0 overflow-hidden"
                  >
                    <SettingsPanel
                      isOpen={true}
                      isInline={true}
                      onClose={() => setActiveTab('dashboard')}
                      token={token}
                      user={user}
                      repos={repos}
                      stagedFiles={files}
                      onConnectToken={handleConnectToken}
                      onDisconnect={handleDisconnect}
                      onRefreshRepos={handleRefreshRepos}
                      accounts={accounts}
                      onSwitchAccount={handleSwitchAccount}
                      onRemoveAccount={handleRemoveAccount}
                      onDeleteRepoSuccess={handleDeleteRepoSuccess}
                      onUpdateRepoSuccess={handleUpdateRepoSuccess}
                    />
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* FULL-WIDTH MOBILE-COMPATIBLE BOTTOM NAVIGATION BAR */}
      <nav className="shrink-0 h-16 sm:h-18 bg-[#09090C]/95 backdrop-blur-2xl border-t border-white/10 px-2 sm:px-8 flex items-center justify-around sm:justify-center gap-1 sm:gap-10 z-40 shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 sm:px-5 rounded-xl transition select-none cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-indigo-400 font-bold bg-indigo-500/15 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <LayoutGrid className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-tight">Workspace</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center justify-center py-1 px-3 sm:px-5 rounded-xl transition select-none cursor-pointer ${
            activeTab === 'ai'
              ? 'text-indigo-400 font-bold bg-indigo-500/15 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-tight">AI Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center justify-center py-1 px-3 sm:px-5 rounded-xl transition select-none cursor-pointer ${
            activeTab === 'stats'
              ? 'text-indigo-400 font-bold bg-indigo-500/15 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-tight">Stats & Vercel</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1 px-3 sm:px-5 rounded-xl transition select-none cursor-pointer ${
            activeTab === 'settings'
              ? 'text-indigo-400 font-bold bg-indigo-500/15 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
          }`}
        >
          <Sliders className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-tight">Settings</span>
        </button>
      </nav>
    </div>
  );
}
