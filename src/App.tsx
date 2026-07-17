import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Github, FolderGit, FolderUp, RefreshCw, AlertCircle, Play, CheckCircle, Sliders } from 'lucide-react';

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

const STORAGE_KEY = 'repostnow_github_token';

export default function App() {
  const [token, setToken] = useState<string>(() => safeStorage.getItem(STORAGE_KEY) || '');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [orgs, setOrgs] = useState<GitHubOrg[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Files currently staged
  const [files, setFiles] = useState<UploadFile[]>([]);
  
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

      // Fetch user repos & orgs
      await handleRefreshRepos(newToken);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate token. Please check validity.');
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleRefreshRepos]);

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
      const newFiles = await processSelectedFiles(rawFiles);
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
    <div className="min-h-screen flex flex-col selection:bg-indigo-500/30 selection:text-indigo-300">
      {/* Decorative Background Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Primary Header */}
      <header className="sticky top-0 z-40 bg-[#0E0E10]/85 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center justify-center p-3 rounded-xl border transition duration-200 shadow-md ${
                isSettingsOpen
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/50'
                  : 'bg-[#141417] hover:bg-[#1c1c21] text-slate-200 hover:text-slate-100 border-white/5'
              }`}
              title="Open Settings & Workspace Control Center"
            >
              <Sliders className="w-5 h-5 text-indigo-400" />
            </button>
            
            <div className="hidden sm:flex items-center gap-3 border-l border-white/5 pl-4">
              <div className="p-2 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl shadow-lg shadow-indigo-500/10 flex items-center justify-center">
                <FolderGit className="w-5 h-5 text-white font-bold" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-slate-100 font-sans">RepostNow</h1>
                  <span className="px-2 py-0.5 rounded-full bg-[#0A0A0B] border border-white/5 text-slate-400 text-[10px] font-mono">v1.1.0</span>
                </div>
                <p className="text-[11px] text-slate-400">Direct-to-GitHub Repository Upload Engine</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#141417] border border-white/5 rounded-xl text-xs font-mono text-slate-300">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>@{user.login}</span>
              </div>
            )}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 text-slate-400 hover:text-slate-100 hover:bg-[#141417] rounded-xl transition duration-150 border border-transparent hover:border-white/5"
              title="Visit GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Workspace Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:py-8 space-y-6">
        <AnimatePresence mode="wait">
          {session.status !== 'idle' ? (
            /* Upload Session active: focus completely on Progress logs and terminal */
            <motion.div
              key="progress-panel"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-2xl mx-auto"
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
            /* Main setup workspace dashboard */
            <motion.div
              key="setup-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Left Column: Accounts & Repo Configuration */}
              <div className="lg:col-span-5 space-y-6">
                {/* 1. Account / Token input */}
                <TokenInput
                  token={token}
                  user={user}
                  loading={loading}
                  error={error}
                  onConnect={handleConnectToken}
                  onDisconnect={handleDisconnect}
                />

                {/* 2. Repository selection configuration */}
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
                    <p className="text-sm">Please connect your GitHub account using your Personal Access Token, or click Settings & Repos at the top left to authenticate with Firebase.</p>
                  </div>
                )}
              </div>

              {/* Right Column: Files upload & File tree */}
              <div className="lg:col-span-7 space-y-6 flex flex-col h-full">
                {/* Dropzone */}
                <FolderDropzone
                  onFilesSelected={handleFilesSelected}
                  disabled={isUploading}
                />

                {/* Staged files explorer list */}
                <FileTree
                  files={files}
                  onRemoveFile={handleRemoveFile}
                  onClearAll={handleClearAll}
                  disabled={isUploading}
                />

                {/* Master push action panel */}
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
        </AnimatePresence>
      </main>

      {/* Settings Dialog Overlay */}
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
      />

      {/* Simple Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/60 py-6 text-center text-slate-500 text-xs">
        <p>© 2026 RepostNow. Built securely in the browser. Zero server logs.</p>
      </footer>
    </div>
  );
}
