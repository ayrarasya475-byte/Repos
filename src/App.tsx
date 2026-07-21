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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ai' | 'stats'>('dashboard');

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
    try {
      const [userRepos, userOrgs] = await Promise.all([
        fetchUserRepos(activeToken),
        fetchUserOrgs(activeToken),
      ]);
      setRepos(userRepos);
      setOrgs(userOrgs);
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
    <div className="min-h-screen bg-[#070709] text-slate-100 flex flex-col md:flex-row selection:bg-indigo-500/30 selection:text-indigo-300 relative overflow-x-hidden">
      {/* Decorative Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none z-0" />

      {/* DESKTOP SIDEBAR NAVIGATION RAIL */}
      <aside className="hidden md:flex w-64 border-r border-white/5 bg-[#09090C] flex-col p-5 flex-shrink-0 z-30 sticky top-0 h-screen justify-between">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-white/5 pb-5">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center">
              <FolderGit className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-sm font-extrabold text-white tracking-tight font-sans">RepostNow</h1>
              <p className="text-[10px] text-indigo-400 font-mono tracking-wider">CODE ENGINE v1.2.0</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold px-3 block mb-2">Workspace Modules</span>
            
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${activeTab === 'dashboard' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Dashboard Workspace</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${activeTab === 'ai' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Coding Assistant</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${activeTab === 'stats' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Analytics & Stats</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${activeTab === 'settings' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
            >
              <Sliders className="w-4 h-4" />
              <span>Settings & Repos Config</span>
            </button>
          </div>
        </div>

        {/* Bottom Sidebar Action & Profile */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-[#121215] border border-white/5 rounded-xl text-xs font-mono text-slate-300">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
              <span className="truncate">@{user.login}</span>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden sticky top-0 z-40 bg-[#0E0E10]/90 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between w-full">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-lg shadow flex items-center justify-center">
            <FolderGit className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-extrabold text-white">RepostNow</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-1.5 rounded-lg border transition ${activeTab === 'settings' ? 'text-indigo-400 border-indigo-500/25 bg-indigo-500/10' : 'text-slate-400 hover:text-white bg-white/5 border-white/5'}`}
            title="Open settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-grow flex flex-col min-h-screen min-w-0 z-10 pb-20 md:pb-0">
        <main className="flex-grow p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            {session.status !== 'idle' ? (
              <motion.div
                key="progress-panel"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="max-w-2xl mx-auto py-10"
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
              <div className="h-full">
                {/* 1. DASHBOARD VIEW */}
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-6"
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
                            Please connect your GitHub account using your Personal Access Token, or open the settings sidebar to authenticate via secure popup integration.
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
                    className="h-[82vh] md:h-[86vh] flex flex-col shadow-2xl"
                  >
                    <AiAssistantPanel
                      stagedFiles={files}
                      onUpdateStagedFiles={setFiles}
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
                    className="h-[82vh] md:h-[86vh] flex flex-col"
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
                    />
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </main>

        {/* Global Desktop Footer */}
        <footer className="hidden md:block py-6 text-center text-slate-600 text-xs border-t border-white/5 bg-[#08080A]">
          <p>© 2026 RepostNow. Direct Browser GitHub Pipeline. No logs. No trackers.</p>
        </footer>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E0E10]/90 backdrop-blur-md border-t border-white/5 px-4 py-2 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition ${activeTab === 'dashboard' ? 'text-indigo-400 font-bold bg-indigo-500/10' : 'text-slate-400'}`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-mono">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition ${activeTab === 'ai' ? 'text-indigo-400 font-bold bg-indigo-500/10' : 'text-slate-400'}`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-mono">AI Code</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition ${activeTab === 'stats' ? 'text-indigo-400 font-bold bg-indigo-500/10' : 'text-slate-400'}`}
        >
          <TrendingUp className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-mono">Stats</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition ${activeTab === 'settings' ? 'text-indigo-400 font-bold bg-indigo-500/10' : 'text-slate-400'}`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-mono">Settings</span>
        </button>
      </nav>

      {/* Workspace Control Center split-pane drawer/dialog overlay */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
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
      />
    </div>
  );
}
