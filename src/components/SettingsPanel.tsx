import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, Key, FolderGit, Search, Trash2, X, Download, Upload, Eye, ChevronLeft,
  ChevronRight, Folder, File, HelpCircle, Loader2, Sparkles, CheckCircle, RefreshCw, AlertTriangle, Github,
  Globe, ShieldAlert, ArrowRight, LayoutGrid, Cpu, Sliders, Play, Terminal, Edit2
} from 'lucide-react';
import { GitHubUser, GitHubRepo, UploadFile } from '../types';
import {
  fetchRepoContents, deleteRepository, deleteFileFromRepo, uploadSingleFileToRepo, fileToBase64, wipeRepositoryContents, deleteDirectoryFromRepo, updateRepository, renameFileInRepo
} from '../utils/github';
import {
  getFirebaseConfig, loginWithGitHubViaFirebase
} from '../utils/firebase';
import FilePreviewModal from './FilePreviewModal';
import JSZip from 'jszip';
import { safeStorage } from '../utils/storage';

interface SettingsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  token: string;
  user: GitHubUser | null;
  repos: GitHubRepo[];
  stagedFiles: UploadFile[];
  onConnectToken: (newToken: string) => void;
  onDisconnect: () => void;
  onRefreshRepos: () => void;
  isInline?: boolean;
  accounts?: Array<{ token: string; user: GitHubUser }>;
  onSwitchAccount?: (token: string) => void;
  onRemoveAccount?: (login: string) => void;
}

type ScreenType = 'home' | 'auth' | 'repos' | 'repo-detail' | 'deploy' | 'profile' | 'repo-config';

export default function SettingsPanel({
  isOpen,
  onClose,
  token,
  user,
  repos,
  stagedFiles,
  onConnectToken,
  onDisconnect,
  onRefreshRepos,
  isInline = false,
  accounts = [],
  onSwitchAccount,
  onRemoveAccount
}: SettingsPanelProps) {
  // Navigation screen
  const [screen, setScreen] = useState<ScreenType>('home');
  const [inputToken, setInputToken] = useState(token);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vercel deployment configurations
  const [vercelToken, setVercelToken] = useState('');
  const [vercelProjectName, setVercelProjectName] = useState('repostnow-app');
  const [deployStatus, setDeployStatus] = useState<'idle' | 'packing' | 'uploading' | 'queued' | 'building' | 'success' | 'error'>('idle');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  // Repository Browser states
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [repoContents, setRepoContents] = useState<any[]>([]);
  const [fetchingContents, setFetchingContents] = useState(false);
  const [contentsError, setContentsError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  
  // Single-file Upload Form state inside Repo Browser
  const [uploadingSingle, setUploadingSingle] = useState(false);
  const [uploadSingleError, setUploadSingleError] = useState<string | null>(null);

  // Deleting File State
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  // Captcha Modal Overlay states
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaAction, setCaptchaAction] = useState<() => Promise<void>>(() => async () => {});
  const [captchaTitle, setCaptchaTitle] = useState('');
  const [captchaSubtitle, setCaptchaSubtitle] = useState('');
  const [captchaError, setCaptchaError] = useState(false);

  // Preview file modal state
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  // Repository inline file editor states
  const [editingRepoFile, setEditingRepoFile] = useState<any | null>(null);
  const [editingRepoFileContent, setEditingRepoFileContent] = useState<string>('');
  const [savingRepoFile, setSavingRepoFile] = useState<boolean>(false);

  // Manual Zip Deployment state
  const [deployZipFile, setDeployZipFile] = useState<File | null>(null);

  // Repository configuration states
  const [configRepo, setConfigRepo] = useState<GitHubRepo | null>(null);
  const [newRepoName, setNewRepoName] = useState('');
  const [isRepoPrivate, setIsRepoPrivate] = useState(false);
  const [repoUpdating, setRepoUpdating] = useState(false);
  const [renameOldPath, setRenameOldPath] = useState('');
  const [renameNewPath, setRenameNewPath] = useState('');
  const [fileRenaming, setFileRenaming] = useState(false);
  const [selectedFileToDeploy, setSelectedFileToDeploy] = useState<any | null>(null);

  // Load configuration from localStorage on mount/open
  useEffect(() => {
    setInputToken(token);
    const savedVercelToken = safeStorage.getItem('REPOSTNOW_VERCEL_TOKEN') || '';
    setVercelToken(savedVercelToken);
    
    // Automatically reset sub-state when closing
    if (!isOpen) {
      setScreen('home');
      setDeployStatus('idle');
      setDeployError(null);
      setSelectedRepo(null);
      setConfigRepo(null);
    }
  }, [token, isOpen]);

  const [configRepoFiles, setConfigRepoFiles] = useState<any[]>([]);

  useEffect(() => {
    if (screen === 'repo-config' && configRepo) {
      setLoading(true);
      fetchRepoContents(token, configRepo.owner?.login || '', configRepo.name, '', configRepo.default_branch || 'main')
        .then(res => {
          if (Array.isArray(res)) {
            setConfigRepoFiles(res);
          } else {
            setConfigRepoFiles([]);
          }
        })
        .catch(err => {
          console.error('Error fetching repo files for config:', err);
          setConfigRepoFiles([]);
        })
        .finally(() => setLoading(false));
    }
  }, [screen, configRepo, token]);

  // Handle Token-based login submit
  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onConnectToken(inputToken.trim());
      setScreen('home');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Direct GitHub Sign-In via Firebase (using Env config)
  const handleDirectOAuthLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const ghToken = await loginWithGitHubViaFirebase();
      await onConnectToken(ghToken);
      setScreen('home');
    } catch (err: any) {
      setError(err.message || 'OAuth authentication failed. Ensure VITE_FIREBASE_ env values are active.');
    } finally {
      setLoading(false);
    }
  };

  // Browse Repository files
  const handleBrowseRepo = async (repo: GitHubRepo, path: string = '') => {
    setSelectedRepo(repo);
    setCurrentPath(path);
    setScreen('repo-detail');
    setFetchingContents(true);
    setContentsError(null);
    try {
      const contents = await fetchRepoContents(token, repo.owner?.login || '', repo.name, path, repo.default_branch || 'main');
      // Sort: folders first, then files
      const sorted = Array.isArray(contents) 
        ? contents.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
          })
        : [contents];
      setRepoContents(sorted);
    } catch (err: any) {
      setContentsError(err.message || 'Failed to load repository contents');
    } finally {
      setFetchingContents(false);
    }
  };

  // Navigate back/up a directory
  const handleNavigateUp = () => {
    if (!currentPath) return;
    const segments = currentPath.split('/');
    segments.pop();
    const parentPath = segments.join('/');
    if (selectedRepo) {
      handleBrowseRepo(selectedRepo, parentPath);
    }
  };

  // Action: Trigger Captcha for Repository Deletion
  const triggerDeleteRepo = (repo: GitHubRepo) => {
    triggerCaptcha(
      'Delete Repository',
      `You are deleting "${repo.full_name}". This operation is permanent and cannot be undone.`,
      async () => {
        setLoading(true);
        try {
          await deleteRepository(token, repo.owner?.login || '', repo.name);
          onRefreshRepos();
          alert(`Successfully deleted repository ${repo.name}`);
        } catch (err: any) {
          alert(`Failed to delete repository: ${err.message}. Ensure your token has 'delete_repo' scope.`);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Action: Trigger Captcha for Wiping All Repository Files
  const triggerWipeRepo = (repo: GitHubRepo) => {
    triggerCaptcha(
      'Wipe Repository Contents',
      `You are deleting ALL files and folders inside "${repo.full_name}". Only a README.md will remain.`,
      async () => {
        setLoading(true);
        try {
          await wipeRepositoryContents(token, repo.owner?.login || '', repo.name, repo.default_branch || 'main');
          handleBrowseRepo(repo, '');
          alert(`All directory files and folders successfully wiped!`);
        } catch (err: any) {
          alert(`Wipe failed: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Delete a specific file or folder in the browser (no captcha needed for single files, but confirmation popup)
  const handleDeleteFile = async (item: any) => {
    if (!selectedRepo) return;
    setLoading(true);
    try {
      if (item.type === 'dir') {
        await deleteDirectoryFromRepo(
          token,
          selectedRepo.owner?.login || '',
          selectedRepo.name,
          item.path,
          selectedRepo.default_branch || 'main',
          `Delete folder ${item.name} via RepostNow Workspace`
        );
      } else {
        await deleteFileFromRepo(
          token,
          selectedRepo.owner?.login || '',
          selectedRepo.name,
          item.path,
          item.sha,
          selectedRepo.default_branch || 'main',
          `Delete ${item.name} via RepostNow Workspace`
        );
      }
      setDeletingFile(null);
      
      // Optimistic update: filter out the deleted item from local state instantly
      setRepoContents(prev => prev.filter(c => c.path !== item.path));

      // Wait 1 second before doing the real GitHub refresh to let GitHub's eventual consistency settle
      setTimeout(() => {
        handleBrowseRepo(selectedRepo, currentPath);
      }, 1000);
    } catch (err: any) {
      alert(`Failed to delete item: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Start repository file inline editing
  const handleStartEditRepoFile = async (item: any) => {
    setLoading(true);
    try {
      const response = await fetch(item.download_url);
      if (!response.ok) throw new Error('Failed to retrieve file source.');
      const text = await response.text();
      setEditingRepoFile(item);
      setEditingRepoFileContent(text);
    } catch (err: any) {
      alert(`Failed to load file content: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update repository settings (name & privacy)
  const handleUpdateRepoSettings = async () => {
    if (!configRepo) return;
    setRepoUpdating(true);
    try {
      await updateRepository(token, configRepo.owner?.login || '', configRepo.name, {
        name: newRepoName.trim(),
        private: isRepoPrivate,
      });
      alert('Repository updated successfully!');
      onRefreshRepos();
      setScreen('repos');
    } catch (err: any) {
      alert(`Failed to update repository: ${err.message}`);
    } finally {
      setRepoUpdating(false);
    }
  };

  // Rename a file in the repository
  const handleRenameFileInRepo = async () => {
    if (!configRepo || !renameOldPath.trim() || !renameNewPath.trim()) return;
    setFileRenaming(true);
    try {
      await renameFileInRepo(
        token,
        configRepo.owner?.login || '',
        configRepo.name,
        renameOldPath.trim(),
        renameNewPath.trim(),
        configRepo.default_branch || 'main'
      );
      alert(`Successfully renamed file from "${renameOldPath}" to "${renameNewPath}"!`);
      setRenameOldPath('');
      setRenameNewPath('');
    } catch (err: any) {
      alert(`Failed to rename file: ${err.message}`);
    } finally {
      setFileRenaming(false);
    }
  };

  // Save the repository file inline edit
  const handleSaveRepoFile = async () => {
    if (!selectedRepo || !editingRepoFile) return;
    setSavingRepoFile(true);
    try {
      const base64Content = btoa(unescape(encodeURIComponent(editingRepoFileContent)));
      await uploadSingleFileToRepo(
        token,
        selectedRepo.owner?.login || '',
        selectedRepo.name,
        editingRepoFile.path,
        base64Content,
        selectedRepo.default_branch || 'main',
        `Update ${editingRepoFile.name} via RepostNow Editor`,
        editingRepoFile.sha
      );

      alert(`File "${editingRepoFile.name}" has been updated successfully on GitHub!`);
      setEditingRepoFile(null);
      // Settle and reload contents
      setTimeout(() => {
        handleBrowseRepo(selectedRepo, currentPath);
      }, 1000);
    } catch (err: any) {
      alert(`Failed to save file: ${err.message}`);
    } finally {
      setSavingRepoFile(false);
    }
  };

  // Upload single file directly to repository
  const handleSingleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !selectedRepo) return;

    setUploadingSingle(true);
    setUploadSingleError(null);

    try {
      const base64 = await fileToBase64(rawFile);
      const filePath = currentPath ? `${currentPath}/${rawFile.name}` : rawFile.name;
      
      const existing = repoContents.find(item => item.name === rawFile.name && item.type === 'file');
      
      await uploadSingleFileToRepo(
        token,
        selectedRepo.owner?.login || '',
        selectedRepo.name,
        filePath,
        base64,
        selectedRepo.default_branch || 'main',
        `Add file ${rawFile.name} via RepostNow Workspace`,
        existing?.sha
      );

      handleBrowseRepo(selectedRepo, currentPath);
    } catch (err: any) {
      setUploadSingleError(err.message || 'Failed to upload file');
    } finally {
      setUploadingSingle(false);
    }
  };

  // File Preview Modal handler
  const handlePreviewFile = (item: any) => {
    setLoading(true);
    fetch(item.download_url)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then(blob => {
        const fileObj = new File([blob], item.name, { type: item.name.split('.').pop() === 'png' ? 'image/png' : 'text/plain' });
        setPreviewFile({
          id: item.sha,
          name: item.name,
          path: item.path,
          size: item.size,
          type: fileObj.type || 'text/plain',
          file: fileObj,
          status: 'success',
          progress: 100
        });
      })
      .catch(() => {
        alert('Could not download preview contents for this file format.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Save Vercel Token Helper
  const handleSaveVercelToken = (tokenValue: string) => {
    setVercelToken(tokenValue.trim());
    safeStorage.setItem('REPOSTNOW_VERCEL_TOKEN', tokenValue.trim());
  };

  // Helper to compute SHA-1 hash and size of a file (highly compatible, native Web Crypto API)
  const computeSHA1 = async (bytes: Uint8Array): Promise<{ sha: string; size: number }> => {
    const hashBuffer = await crypto.subtle.digest('SHA-1', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { sha, size: bytes.length };
  };

  const cleanFilePath = (filePath: string): string => {
    let clean = filePath.replace(/\\/g, '/');
    if (clean.startsWith('./')) {
      clean = clean.substring(2);
    }
    if (clean.startsWith('/')) {
      clean = clean.substring(1);
    }
    return clean;
  };

  const isIgnoredFile = (filePath: string): boolean => {
    const clean = cleanFilePath(filePath).toLowerCase();
    return (
      clean.includes('node_modules/') ||
      clean.includes('.git/') ||
      clean.includes('.github/') ||
      clean.endsWith('.ds_store') ||
      clean === 'node_modules' ||
      clean === '.git'
    );
  };

  // Vercel Deployment Core Handler
  const executeVercelDeployment = async (filesList: Array<{ file: string; data: Uint8Array }>) => {
    if (!vercelToken) {
      setDeployError('Vercel API Token is required. Please save it in credentials configuration first.');
      setDeployStatus('error');
      return;
    }

    setDeployStatus('uploading');
    setDeployError(null);
    setDeployedUrl(null);
    
    const logs: string[] = [];
    const addLog = (msg: string) => {
      const timestamp = new Date().toLocaleTimeString();
      logs.push(`[${timestamp}] ${msg}`);
      setDeployLogs([...logs]);
    };

    addLog('🚀 Initiating Vercel Instant Deployment Pipeline...');
    addLog(`📦 Preparing metrics and hashing ${filesList.length} source file(s) for compilation...`);

    try {
      const processedFiles: Array<{ file: string; sha: string; size: number; data: Uint8Array }> = [];
      
      for (const item of filesList) {
        const cleanPath = cleanFilePath(item.file);
        if (isIgnoredFile(cleanPath)) {
          continue;
        }
        const { sha, size } = await computeSHA1(item.data);
        processedFiles.push({
          file: cleanPath,
          sha,
          size,
          data: item.data,
        });
      }

      if (processedFiles.length === 0) {
        throw new Error('No deployable files found (all source files were either empty or ignored).');
      }

      addLog(`🔍 Filtered down to ${processedFiles.length} deployment assets. Staging onto Vercel File Store...`);

      let uploadedCount = 0;
      const concurrencyLimit = 5;
      const chunks: typeof processedFiles[] = [];
      for (let i = 0; i < processedFiles.length; i += concurrencyLimit) {
        chunks.push(processedFiles.slice(i, i + concurrencyLimit));
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await Promise.all(
          chunk.map(async (item) => {
            try {
              const res = await fetch('/api/proxy-vercel-file', {
                method: 'POST',
                headers: {
                  'x-vercel-token': vercelToken,
                  'Content-Type': 'application/octet-stream',
                  'x-now-digest': item.sha,
                  'x-now-size': String(item.size),
                },
                body: item.data,
              });

              if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Upload failed for ${item.file}: ${errText}`);
              }
              uploadedCount++;
            } catch (err: any) {
              throw new Error(`Failed to stage file "${item.file}": ${err.message}`);
            }
          })
        );

        const progress = Math.round((uploadedCount / processedFiles.length) * 100);
        addLog(`📤 Staged ${uploadedCount}/${processedFiles.length} files (${progress}% complete)`);
      }

      addLog('📡 Sending final deployment schema payload to Vercel global edge...');

      const filesPayload = processedFiles.map((item) => ({
        file: item.file,
        sha: item.sha,
        size: item.size,
        mode: 33188, // 100644 (standard file permissions)
      }));

      const payload = {
        name: vercelProjectName.trim() || 'repostnow-app',
        files: filesPayload,
        projectSettings: {
          framework: null,
        },
      };

      const res = await fetch('/api/proxy-vercel-deployments', {
        method: 'POST',
        headers: {
          'x-vercel-token': vercelToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Vercel API deployment request failed.');
      }

      const deploymentId = data.id;
      const initialUrl = data.url;
      const initialUrlFormatted = `https://${initialUrl}`;
      
      addLog(`✨ Deployment created successfully on Vercel Edge.`);
      addLog(`🆔 Deployment ID: ${deploymentId}`);
      addLog(`🌐 Target Live URL: ${initialUrlFormatted}`);
      addLog(`🔍 Starting live pipeline status tracking...`);

      // Polling loop
      let finished = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 * 2 seconds = 120 seconds timeout
      let currentState = data.readyState || 'QUEUED';

      const mapState = (st: string): typeof deployStatus => {
        const lower = st.toLowerCase();
        if (lower === 'ready') return 'success';
        if (lower === 'error' || lower === 'canceled') return 'error';
        if (lower === 'building') return 'building';
        if (lower === 'queued') return 'queued';
        return 'uploading';
      };

      setDeployStatus(mapState(currentState));

      while (!finished && attempts < maxAttempts) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 2000));

        try {
          const pollRes = await fetch(`/api/proxy-vercel-poll/${deploymentId}`, {
            headers: {
              'x-vercel-token': vercelToken,
            },
          });

          if (!pollRes.ok) {
            addLog(`⚠️ [Warning] Transient polling connection loss (HTTP ${pollRes.status}). Retrying...`);
            continue;
          }

          const pollData = await pollRes.json();
          const newState = pollData.readyState || 'QUEUED';

          if (newState !== currentState) {
            currentState = newState;
            setDeployStatus(mapState(currentState));
            addLog(`🔄 Vercel Status Changed: ${currentState}`);
          }

          if (currentState === 'READY') {
            finished = true;
            setDeployedUrl(`https://${pollData.url}`);
            setDeployStatus('success');
            addLog(`🎉 SUCCESS! Deployment is live and ready on the Edge CDN network.`);
            addLog(`🔗 URL Address: https://${pollData.url}`);
          } else if (currentState === 'ERROR') {
            finished = true;
            setDeployStatus('error');
            setDeployError('Vercel build compilation or environment error.');
            addLog(`❌ FAILED: Build compilation failed on Vercel. Please check your source code or Vercel dashboard logs.`);
          } else if (currentState === 'CANCELED') {
            finished = true;
            setDeployStatus('error');
            setDeployError('Deployment was canceled.');
            addLog(`⚠️ CANCELED: Deployment process canceled by user or system.`);
          } else {
            if (currentState === 'BUILDING') {
              addLog('⚡ Vercel is compiling code & running custom scripts (processes pending)...');
            } else if (currentState === 'QUEUED') {
              addLog('⏳ Waiting for Vercel runner assignment...');
            } else if (currentState === 'INITIALIZING') {
              addLog('⚙️ Preparing isolated worker container...');
            }
          }
        } catch (pollErr: any) {
          addLog(`⚠️ [Warning] Connection issue during polling: ${pollErr.message}`);
        }
      }

      if (!finished) {
        addLog(`⏳ Polling connection timed out (reached 120s limit). The deploy is still compiling on Vercel.`);
        setDeployedUrl(initialUrlFormatted);
        setDeployStatus('success');
      }

    } catch (err: any) {
      addLog(`❌ PIPELINE EXCEPTION: ${err.message || 'Unknown error'}`);
      setDeployError(err.message || 'An error occurred while calling Vercel API.');
      setDeployStatus('error');
    }
  };

  // Trigger: Deploy Currently Staged Files to Vercel
  const handleDeployStagedToVercel = async () => {
    if (stagedFiles.length === 0) {
      setDeployError('No files are staged. Please drop files in the main page staging area.');
      setDeployStatus('error');
      return;
    }

    setDeployStatus('packing');
    setDeployError(null);
    setDeployedUrl(null);
    setDeployLogs([]);
    try {
      const filesList: Array<{ file: string; data: Uint8Array }> = [];
      for (const staged of stagedFiles) {
        const arrayBuffer = await staged.file.arrayBuffer();
        filesList.push({
          file: staged.path,
          data: new Uint8Array(arrayBuffer)
        });
      }
      await executeVercelDeployment(filesList);
    } catch (err: any) {
      setDeployError('Failed to read local staged files: ' + err.message);
      setDeployStatus('error');
    }
  };

  // Trigger: Deploy Selected GitHub Repository to Vercel (Using zip extraction)
  const handleDeployRepoToVercel = async (repo: GitHubRepo) => {
    setDeployStatus('packing');
    setDeployError(null);
    setDeployedUrl(null);
    setDeployLogs([]);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      const timestamp = new Date().toLocaleTimeString();
      logs.push(`[${timestamp}] ${msg}`);
      setDeployLogs([...logs]);
    };

    addLog(`📥 Fetching latest files from GitHub repository: ${repo.name}...`);
    try {
      // Download repository zip ball via backend proxy to bypass CORS
      const ref = repo.default_branch || 'main';
      const ownerName = repo.owner?.login || '';
      const response = await fetch(`/api/proxy-github-zip?owner=${encodeURIComponent(ownerName)}&repo=${encodeURIComponent(repo.name)}&ref=${encodeURIComponent(ref)}&token=${encodeURIComponent(token)}`);

      if (!response.ok) {
        throw new Error(`Failed to download repository files from GitHub (HTTP ${response.status})`);
      }

      addLog(`📦 Extracting archive zip file structure...`);
      const zipBlob = await response.blob();
      const zip = await JSZip.loadAsync(zipBlob);
      const filesList: Array<{ file: string; data: Uint8Array }> = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('uint8array');
          // GitHub zipballs embed everything in a sub-folder. We strip the root folder name.
          const segments = relativePath.split('/');
          segments.shift();
          const cleanPath = segments.join('/');
          if (cleanPath) {
            filesList.push({
              file: cleanPath,
              data: content
            });
          }
        }
      }

      if (filesList.length === 0) {
        throw new Error('Downloaded repository zip was empty or could not be decoded.');
      }

      addLog(`✨ Extraction completed. Processing ${filesList.length} files...`);
      await executeVercelDeployment(filesList);
    } catch (err: any) {
      setDeployError(err.message || 'Failed to download and package GitHub repository.');
      setDeployStatus('error');
    }
  };

  // Trigger: Deploy manually uploaded zip file to Vercel
  const handleDeployZipToVercel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDeployStatus('packing');
    setDeployError(null);
    setDeployedUrl(null);
    setDeployLogs([]);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      const timestamp = new Date().toLocaleTimeString();
      logs.push(`[${timestamp}] ${msg}`);
      setDeployLogs([...logs]);
    };

    addLog(`📦 Parsing local ZIP package: ${file.name}...`);
    try {
      const zip = await JSZip.loadAsync(file);
      const filesList: Array<{ file: string; data: Uint8Array }> = [];

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
          const content = await zipEntry.async('uint8array');
          filesList.push({
            file: relativePath,
            data: content
          });
        }
      }

      if (filesList.length === 0) {
        throw new Error('Uploaded zip archive is empty.');
      }

      addLog(`✨ ZIP parsed successfully. Extracted ${filesList.length} files...`);
      await executeVercelDeployment(filesList);
    } catch (err: any) {
      setDeployError(err.message || 'Failed to parse uploaded ZIP file.');
      setDeployStatus('error');
    }
  };

  // Captcha Helper trigger
  const triggerCaptcha = (title: string, subtitle: string, action: () => Promise<void>) => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(code);
    setCaptchaInput('');
    setCaptchaTitle(title);
    setCaptchaSubtitle(subtitle);
    setCaptchaAction(() => action);
    setCaptchaError(false);
    setCaptchaOpen(true);
  };

  const handleCaptchaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaInput.trim() === captchaCode) {
      setCaptchaOpen(false);
      await captchaAction();
    } else {
      setCaptchaError(true);
    }
  };

  const filteredRepos = repos.filter(repo =>
    repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    (repo.description || '').toLowerCase().includes(repoSearch.toLowerCase())
  );
  return (
    <AnimatePresence>
      {(isInline || isOpen) && (
        <div id="settings-modal" className={isInline ? "w-full h-full relative" : "fixed inset-0 z-50 flex justify-center items-center p-4 sm:p-6 md:p-10 font-sans"}>
          {/* Blur Overlay Mask */}
          {!isInline && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-[#040406]/92 backdrop-blur-md"
            />
          )}

          {/* Center-Aligned Split Pane Window Container */}
          <motion.div
            initial={isInline ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
            animate={isInline ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isInline ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
            transition={isInline ? { duration: 0.2 } : { type: 'spring', damping: 26, stiffness: 220 }}
            className={isInline
              ? "relative w-full h-full bg-[#08080A] border border-white/5 rounded-2xl flex flex-col md:flex-row overflow-hidden font-sans"
              : "relative w-full max-w-5xl xl:max-w-6xl h-[90vh] md:h-[85vh] bg-[#08080A] border border-white/10 rounded-2xl flex flex-col md:flex-row shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden z-10 font-sans"
            }
          >
            {/* Left Sidebar Menu Side Pane */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-[#09090C] flex flex-col p-4 md:p-5 flex-shrink-0">
              {/* Sidebar Header / Logo */}
              <div className="hidden md:flex items-center gap-3 mb-6 border-b border-white/5 pb-5">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/10 shadow-lg shadow-indigo-500/5 flex items-center justify-center">
                  <Sliders className="w-5 h-5 animate-pulse" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-bold text-slate-100 tracking-tight">Control Center</h2>
                  <p className="text-[10px] text-indigo-400 font-mono tracking-wider">REPOSTNOW v1.2.0</p>
                </div>
              </div>

              {/* Sidebar Navigation Options */}
              <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible md:space-y-1 gap-2 md:gap-0 flex-grow pr-1 pb-1 md:pb-0 scrollbar-none">
                <span className="hidden md:block text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold px-3 mb-2">WORKSPACE PANELS</span>
                
                <button
                  onClick={() => setScreen('home')}
                  className={`flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-xl text-xs font-semibold transition text-left flex-shrink-0 md:flex-shrink-0 ${screen === 'home' ? 'bg-white/5 text-white border border-white/5 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
                >
                  <LayoutGrid className="w-4 h-4 text-indigo-400" />
                  <span>Overview</span>
                </button>

                <button
                  onClick={() => setScreen('auth')}
                  className={`flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-xl text-xs font-semibold transition text-left flex-shrink-0 md:flex-shrink-0 ${screen === 'auth' ? 'bg-white/5 text-white border border-white/5 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
                >
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Credentials</span>
                </button>

                <button
                  onClick={() => {
                    if (!user) {
                      alert('Please connect your GitHub account first.');
                      setScreen('auth');
                      return;
                    }
                    setScreen('repos');
                  }}
                  className={`flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-xl text-xs font-semibold transition text-left flex-shrink-0 md:flex-shrink-0 ${screen === 'repos' || screen === 'repo-detail' ? 'bg-white/5 text-white border border-white/5 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
                >
                  <FolderGit className="w-4 h-4 text-emerald-400" />
                  <span>Repo Browser</span>
                </button>

                {user && (
                  <button
                    onClick={() => setScreen('profile')}
                    className={`flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-xl text-xs font-semibold transition text-left flex-shrink-0 md:flex-shrink-0 ${screen === 'profile' ? 'bg-white/5 text-white border border-white/5 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
                  >
                    <Github className="w-4 h-4 text-purple-400" />
                    <span>Profile</span>
                  </button>
                )}

                <button
                  onClick={() => setScreen('deploy')}
                  className={`flex items-center gap-2 px-3 py-2 md:py-2.5 rounded-xl text-xs font-semibold transition text-left flex-shrink-0 md:flex-shrink-0 ${screen === 'deploy' ? 'bg-white/5 text-white border border-white/5 shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'}`}
                >
                  <Globe className="w-4 h-4 text-teal-400" />
                  <span>Vercel Deploy</span>
                </button>
              </div>

              {/* Sidebar Footer with connected user details */}
              <div className="hidden md:block pt-4 border-t border-white/5">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 px-2">
                      <img src={user.avatar_url} alt={user.login} className="w-8 h-8 rounded-full border border-indigo-500/20 shadow" />
                      <div className="text-left truncate">
                        <p className="text-xs font-bold text-slate-200 truncate">{user.name || user.login}</p>
                        <p className="text-[10px] text-indigo-400 font-mono truncate">@{user.login}</p>
                      </div>
                    </div>
                    <button
                      onClick={onDisconnect}
                      className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-xl text-[10px] font-bold transition"
                    >
                      Disconnect Account
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950/40 border border-white/5 rounded-xl text-center space-y-2">
                    <p className="text-[10px] text-slate-500 font-mono">No connected account</p>
                    <button
                      onClick={() => setScreen('auth')}
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition"
                    >
                      Authenticate Now
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Blurred / Frosty Glass Container */}
            <div className="flex-grow flex flex-col bg-[#0E0E12] h-full overflow-hidden">
              {/* Frosty Aligned Header */}
              <div className="px-6 py-4 border-b border-white/5 bg-[#09090C]/80 backdrop-blur flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-300">
                    {screen === 'home' && <LayoutGrid className="w-4 h-4 text-indigo-400" />}
                    {screen === 'auth' && <Key className="w-4 h-4 text-amber-400" />}
                    {(screen === 'repos' || screen === 'repo-detail') && <FolderGit className="w-4 h-4 text-emerald-400" />}
                    {screen === 'profile' && <Github className="w-4 h-4 text-purple-400" />}
                    {screen === 'deploy' && <Globe className="w-4 h-4 text-teal-400" />}
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-slate-100 tracking-tight uppercase tracking-wider font-mono">
                      {screen === 'home' && 'OVERVIEW'}
                      {screen === 'auth' && 'CREDENTIALS & SECURITY'}
                      {screen === 'repos' && 'REPOSITORY BROWSER'}
                      {screen === 'repo-detail' && 'FILE EXPLORER'}
                      {screen === 'profile' && 'GITHUB PROFILE'}
                      {screen === 'deploy' && 'VERCEL EDGE PIPELINE'}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {screen === 'home' && 'Manage Connected accounts, file systems, and hosting integrations'}
                      {screen === 'auth' && 'Configure personal access tokens or secure SSO keys'}
                      {screen === 'repos' && 'Audit and modify remote directories and repository assets'}
                      {screen === 'repo-detail' && `Browsing files inside: ${selectedRepo?.full_name}`}
                      {screen === 'profile' && 'Real-time statistics and credentials information'}
                      {screen === 'deploy' && 'Host static websites or applications directly from memory'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(screen === 'repo-detail' || screen === 'auth' || screen === 'profile' || screen === 'deploy') && (
                    <button
                      onClick={() => setScreen('home')}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-xl text-[11px] font-semibold transition"
                    >
                      ← Overview
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded-xl transition border border-white/5 active:scale-95"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Detail Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0E0E12]/80">
                {/* --- SCREEN 1: HOME PANEL --- */}
                {screen === 'home' && (
                  <div className="space-y-6">
                    {/* Connected Status Card */}
                    <div className="p-5 bg-gradient-to-tr from-indigo-950/20 to-indigo-900/10 border border-indigo-500/10 rounded-2xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                      {user ? (
                        <img
                          src={user.avatar_url}
                          alt={user.login}
                          className="w-11 h-11 rounded-full border-2 border-indigo-500/30 shadow-md"
                        />
                      ) : (
                        <div className="p-2.5 bg-slate-900 border border-white/5 rounded-full text-slate-400">
                          <Github className="w-6 h-6 opacity-40" />
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-semibold">Active Session</p>
                        <h4 className="font-bold text-slate-200 text-sm">
                          {user ? `@${user.login}` : 'Offline / Guest Mode'}
                        </h4>
                      </div>
                    </div>
                    {user ? (
                      <button
                        onClick={onDisconnect}
                        className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-xl text-xs font-semibold transition"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => setScreen('auth')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-500/10"
                      >
                        Sign In Now
                      </button>
                    )}
                  </div>

                  {/* Multi-accounts Quick Switch Panel */}
                  {accounts && accounts.length > 1 && (
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5 text-left">
                      <div className="flex items-center gap-1.5 px-1">
                        <Github className="w-3.5 h-3.5 text-indigo-400" />
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Quick Account Switcher</h5>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {accounts.map((acc, idx) => {
                          const isActive = user?.login.toLowerCase() === acc.user.login.toLowerCase();
                          return (
                            <button
                              key={`quick-acc-${acc.user.login}-${idx}`}
                              onClick={() => !isActive && onSwitchAccount?.(acc.token)}
                              disabled={isActive}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-left transition ${
                                isActive
                                  ? 'bg-indigo-600/15 border-indigo-500/25 cursor-default'
                                  : 'bg-[#141418] border-white/5 hover:border-white/10 hover:bg-[#1c1c24]'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <img src={acc.user.avatar_url} alt={acc.user.login} className="w-6 h-6 rounded-full border border-indigo-500/10" />
                                <span className="text-xs font-semibold text-slate-200 truncate">@{acc.user.login}</span>
                              </div>
                              {isActive && (
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* List of Features (Vertical, Organized, Premium Grid) */}
                  <div className="space-y-3.5">
                    <h3 className="text-xs uppercase font-mono tracking-wider text-slate-500 font-bold px-1">WORKSPACE FEATURES</h3>

                    {/* Feature 1: Auth */}
                    <button
                      onClick={() => setScreen('auth')}
                      className="w-full text-left p-5 bg-[#141418] hover:bg-[#1a1a21] border border-white/5 rounded-2xl flex items-center justify-between transition-all duration-200 hover:translate-x-1 hover:border-indigo-500/20 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-white/5 group-hover:bg-indigo-500/20 transition-all">
                          <Key className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm group-hover:text-indigo-300 transition-colors">GitHub Credentials</h4>
                          <p className="text-xs text-slate-400 mt-1">Direct token integrations or OAuth authentication mechanisms</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 font-mono rounded-full ${user ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-slate-800 text-slate-500'}`}>
                          {user ? 'Connected' : 'Offline'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform" />
                      </div>
                    </button>

                    {/* Feature 2: Repos manager */}
                    <button
                      onClick={() => {
                        if (!user) {
                          alert('Please connect your GitHub account first.');
                          setScreen('auth');
                          return;
                        }
                        setScreen('repos');
                      }}
                      className="w-full text-left p-5 bg-[#141418] hover:bg-[#1a1a21] border border-white/5 rounded-2xl flex items-center justify-between transition-all duration-200 hover:translate-x-1 hover:border-indigo-500/20 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-white/5 group-hover:bg-amber-500/20 transition-all">
                          <FolderGit className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm group-hover:text-amber-300 transition-colors">Browse & Clean Repositories</h4>
                          <p className="text-xs text-slate-400 mt-1">Explore, upload single files, wipe directories, or delete whole repositories</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user && (
                          <span className="text-[10px] px-2 py-0.5 font-mono rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/10">
                            {repos.length} Repos
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform" />
                      </div>
                    </button>

                    {/* Feature: GitHub Account Profile */}
                    {user && (
                      <button
                        onClick={() => setScreen('profile')}
                        className="w-full text-left p-5 bg-[#141418] hover:bg-[#1a1a21] border border-white/5 rounded-2xl flex items-center justify-between transition-all duration-200 hover:translate-x-1 hover:border-indigo-500/20 group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-white/5 group-hover:bg-purple-500/20 transition-all">
                            <Github className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-200 text-sm group-hover:text-purple-300 transition-colors">GitHub Account Profile</h4>
                            <p className="text-xs text-slate-400 mt-1">View comprehensive stats, email, followers, gists, and account metadata</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 font-mono rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/10">
                            View Profile
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform" />
                        </div>
                      </button>
                    )}

                    {/* Feature 3: Deploy to Vercel */}
                    <button
                      onClick={() => setScreen('deploy')}
                      className="w-full text-left p-5 bg-[#141418] hover:bg-[#1a1a21] border border-white/5 rounded-2xl flex items-center justify-between transition-all duration-200 hover:translate-x-1 hover:border-indigo-500/20 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400 border border-white/5 group-hover:bg-teal-500/20 transition-all">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm group-hover:text-teal-300 transition-colors">Instant Vercel Deployment</h4>
                          <p className="text-xs text-slate-400 mt-1">Deploy local staged files, repositories, or manual Zip packages instantly</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 font-mono rounded-full ${vercelToken ? 'bg-teal-500/10 text-teal-400 border border-teal-500/10' : 'bg-slate-800 text-slate-500'}`}>
                          {vercelToken ? 'Token Ready' : 'Configure'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform" />
                      </div>
                    </button>
                  </div>

                  {/* Active Staging Briefing */}
                  <div className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-slate-400" />
                      <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Staging Memory Overview</h4>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Staged File Count:</span>
                      <span className="font-mono text-indigo-400 font-semibold">{stagedFiles.length} files</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Total size in memory:</span>
                      <span className="font-mono text-slate-300">
                        {(stagedFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* --- SCREEN 2: AUTH PANEL (CONFIG HUB) --- */}
              {screen === 'auth' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Sub-header navigation */}
                  <button
                    onClick={() => setScreen('home')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs font-semibold transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Control Center</span>
                  </button>

                  <div className="text-left">
                    <h3 className="text-lg font-bold text-slate-100">Credentials & API Configuration</h3>
                    <p className="text-xs text-slate-400 mt-1">Configure secure access keys for GitHub and Vercel Cloud integrations</p>
                  </div>

                  {/* GitHub Access Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">1. GitHub Platform Access</h4>
                    </div>

                    {/* Connect Button (Direct Login with popup) */}
                    <div className="bg-[#141418] border border-white/5 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                          <Github className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm">Secure GitHub Single Sign-On</h4>
                          <p className="text-xs text-slate-400">One-click authorize pop-up window login via Firebase Integration</p>
                        </div>
                      </div>

                      <button
                        onClick={handleDirectOAuthLogin}
                        disabled={loading}
                        className="w-full py-3 bg-[#24292F] hover:bg-[#24292F]/90 disabled:bg-[#0A0A0B] text-white border border-white/10 hover:border-white/20 font-bold rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            <span>Authorizing Popup Window...</span>
                          </>
                        ) : (
                          <>
                            <Github className="w-4.5 h-4.5" />
                            <span>Sign in with GitHub SSO</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Separator */}
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-white/5"></div>
                      <span className="flex-shrink mx-4 text-slate-600 font-mono text-[10px] uppercase tracking-wider">or integrate manually</span>
                      <div className="flex-grow border-t border-white/5"></div>
                    </div>

                    {/* Option B: PAT Token */}
                    <div className="bg-[#141418] border border-white/5 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                          <Key className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm">Personal Access Token (PAT)</h4>
                          <p className="text-xs text-slate-400">Provide a classic GitHub developer token with repo scopes</p>
                        </div>
                      </div>

                      <form onSubmit={handleTokenSubmit} className="space-y-3">
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="Paste your ghp_... token here"
                            value={inputToken}
                            onChange={(e) => setInputToken(e.target.value)}
                            className="w-full pl-4 pr-24 py-3.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                          />
                          <button
                            type="submit"
                            disabled={loading || !inputToken.trim()}
                            className="absolute right-2 top-1.5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition shadow-md"
                          >
                            {loading ? 'Saving...' : 'Verify & Connect'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Linked Accounts List (Max 3) */}
                    {accounts && accounts.length > 0 && (
                      <div className="p-5 bg-[#141418] border border-white/5 rounded-2xl space-y-3 text-left">
                        <div className="flex items-center gap-1.5">
                          <Github className="w-4 h-4 text-indigo-400" />
                          <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">Linked Accounts (Switch instantly)</h5>
                        </div>
                        <div className="space-y-2.5">
                          {accounts.map((acc, idx) => {
                            const isActive = user?.login.toLowerCase() === acc.user.login.toLowerCase();
                            return (
                              <div
                                key={`auth-acc-${acc.user.login}-${idx}`}
                                className={`p-3 rounded-xl border flex items-center justify-between transition ${
                                  isActive
                                    ? 'bg-indigo-600/10 border-indigo-500/25'
                                    : 'bg-[#0A0A0C] border-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <img src={acc.user.avatar_url} alt={acc.user.login} className="w-8 h-8 rounded-full border border-white/10" />
                                  <div>
                                    <p className="text-xs font-bold text-slate-200">{acc.user.name || acc.user.login}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">@{acc.user.login}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isActive ? (
                                    <span className="text-[9px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Active</span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onSwitchAccount?.(acc.token)}
                                      className="px-2.5 py-1 bg-white/5 hover:bg-indigo-600 hover:text-white text-slate-300 rounded-lg text-[10px] font-bold transition"
                                    >
                                      Switch
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onRemoveAccount?.(acc.user.login)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                                    title="Unlink Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vercel Cloud Integration Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-500 rounded-full"></div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">2. Vercel Cloud Hosting Integration</h4>
                    </div>

                    <div className="bg-[#141418] border border-white/5 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl">
                          <Globe className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm">Vercel Integration Token</h4>
                          <p className="text-xs text-slate-400">Save a Vercel Personal Token in your browser to deploy apps instantly</p>
                        </div>
                      </div>

                      <div className="relative">
                        <input
                          type="password"
                          placeholder="Paste your Vercel Access Token (Bearer dpl_...) here"
                          value={vercelToken}
                          onChange={(e) => handleSaveVercelToken(e.target.value)}
                          className="w-full pl-4 pr-16 py-3.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 placeholder-slate-700 focus:outline-none focus:border-teal-500 font-mono text-xs"
                        />
                        {vercelToken && (
                          <span className="absolute right-4 top-4 text-[10px] uppercase font-mono font-bold text-teal-400">
                            Connected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 text-xs">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span className="leading-relaxed">{error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* --- SCREEN 3: REPOS PANEL --- */}
              {screen === 'repos' && (
                <div className="space-y-6">
                  {/* Sub-header navigation */}
                  <button
                    onClick={() => setScreen('home')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs font-semibold transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Control Center</span>
                  </button>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">Repository Manager</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Select a repository to explore files or wipe files</p>
                    </div>
                    <button
                      onClick={onRefreshRepos}
                      className="p-2.5 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition duration-150 active:scale-95"
                      title="Sync Repositories"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Search and Filters */}
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4.5 h-4.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search repositories in account..."
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-[#0A0A0B] border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Repos list */}
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                    {filteredRepos.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-10">No repositories found.</p>
                    ) : (
                      filteredRepos.map((repo, index) => (
                        <div
                          key={`panel-repo-${repo.id || repo.full_name || index}`}
                          className="p-4 bg-[#141418] hover:bg-[#1a1a21] border border-white/5 rounded-2xl flex items-center justify-between gap-4 transition duration-150 group"
                        >
                          <div className="text-left space-y-1 overflow-hidden flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="font-semibold text-slate-100 text-sm hover:text-indigo-400 cursor-pointer truncate"
                                onClick={() => handleBrowseRepo(repo)}
                              >
                                {repo.name}
                              </span>
                              {repo.private ? (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/10 text-[9px] text-amber-400 font-mono">Private</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/10 text-[9px] text-emerald-400 font-mono">Public</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-1">{repo.description || 'No description provided.'}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                              <span>Branch: {repo.default_branch || 'main'}</span>
                              {repo.language && (
                                <>
                                  <span>•</span>
                                  <span>{repo.language}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleBrowseRepo(repo)}
                              className="px-3.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl text-xs font-semibold transition"
                            >
                              Explore
                            </button>
                            <button
                              onClick={() => {
                                setConfigRepo(repo);
                                setNewRepoName(repo.name);
                                setIsRepoPrivate(repo.private);
                                setSelectedFileToDeploy(null);
                                setScreen('repo-config');
                              }}
                              className="p-2.5 bg-amber-500/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded-xl transition border border-transparent hover:border-amber-500/10"
                              title="Config Repo (Rename, Privacy, Rename Files)"
                            >
                              <Sliders className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => triggerDeleteRepo(repo)}
                              className="p-2.5 bg-rose-500/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition border border-transparent hover:border-rose-500/10"
                              title="Delete Repository"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* --- SCREEN: REPO CONFIG PANEL --- */}
              {screen === 'repo-config' && configRepo && (
                <div className="space-y-6">
                  {/* Navigation Back */}
                  <button
                    onClick={() => setScreen('repos')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs font-semibold transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Repositories</span>
                  </button>

                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">Repository Configuration</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manage details and file settings for {configRepo.full_name}</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/10">
                      Config Active
                    </span>
                  </div>

                  {/* Config Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Repo Properties */}
                    <div className="p-5 bg-[#141418] border border-white/5 rounded-2xl space-y-4 text-left">
                      <div className="flex items-center gap-2 text-indigo-400">
                        <Settings className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">General Settings</h4>
                      </div>

                      {/* Name input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Repository Name</label>
                        <input
                          type="text"
                          value={newRepoName}
                          onChange={(e) => setNewRepoName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                          placeholder="e.g. portfolio"
                        />
                      </div>

                      {/* Privacy toggle */}
                      <div className="flex items-center justify-between p-3 bg-black/30 rounded-xl border border-white/5">
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-200">Private Repository</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Only you can see this repository</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsRepoPrivate(!isRepoPrivate)}
                          className={`relative inline-flex h-5.5 w-10.5 items-center rounded-colors focus:outline-none transition-colors ${
                            isRepoPrivate ? 'bg-indigo-600' : 'bg-slate-800'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              isRepoPrivate ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <button
                        onClick={handleUpdateRepoSettings}
                        disabled={repoUpdating}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                      >
                        {repoUpdating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating Repository...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Save General Settings</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Right Column: File Rename utility */}
                    <div className="p-5 bg-[#141418] border border-white/5 rounded-2xl space-y-4 text-left">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Edit2 className="w-4 h-4" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Rename / Replace File</h4>
                      </div>
                      
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Change the path or filename of any asset inside the repository. Useful for switching homepage setups or rewriting asset mappings (e.g., <code className="text-amber-300 font-mono text-[10px]">market.html</code> to <code className="text-amber-300 font-mono text-[10px]">Mykor.html</code>).
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Old File Path</label>
                          <input
                            type="text"
                            value={renameOldPath}
                            onChange={(e) => setRenameOldPath(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                            placeholder="e.g. market.html"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">New File Path</label>
                          <input
                            type="text"
                            value={renameNewPath}
                            onChange={(e) => setRenameNewPath(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-[#0A0A0B] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                            placeholder="e.g. Mykor.html"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleRenameFileInRepo}
                        disabled={fileRenaming || !renameOldPath.trim() || !renameNewPath.trim()}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                      >
                        {fileRenaming ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Renaming in progress...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Execute File Rename</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Section 3: File Preview, CDN & Direct Raw Deploy Links */}
                  <div className="p-5 bg-[#141418] border border-white/5 rounded-2xl text-left space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Globe className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Deploy & Preview File CDN URLs</h4>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-normal">
                      Select any compiled file inside the repository to view its direct server CDN link, deploy endpoint, or raw resource.
                    </p>

                    {loading ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                        <span className="text-[10px] text-slate-500 font-mono">Loading repository contents...</span>
                      </div>
                    ) : configRepoFiles.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-white/5 rounded-xl">
                        No files found in the root of this branch. Upload files or select another repository.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Select File from Repository</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-[#0A0A0B] border border-white/5 rounded-xl">
                            {configRepoFiles.map((file, idx) => {
                              const isSelected = selectedFileToDeploy?.path === file.path;
                              return (
                                <button
                                  key={`config-file-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedFileToDeploy(file);
                                    setRenameOldPath(file.path);
                                  }}
                                  className={`p-2 rounded-lg border text-left text-[11px] font-mono truncate transition ${
                                    isSelected
                                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                      : 'bg-[#141418]/60 border-white/5 hover:border-white/10 text-slate-300'
                                  }`}
                                >
                                  {file.type === 'dir' ? '📁 ' : '📄 '} {file.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {selectedFileToDeploy && (
                          <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-300 font-mono">{selectedFileToDeploy.path}</span>
                              <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-mono font-bold rounded-full">Target Selected</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              {/* Option A: JS Delivr CDN url */}
                              <div className="p-3 bg-[#0A0A0B] border border-white/5 rounded-lg space-y-1">
                                <p className="text-[9px] uppercase font-mono font-bold text-slate-500">Fast Edge CDN URL</p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    readOnly
                                    value={`https://cdn.jsdelivr.net/gh/${configRepo.owner?.login}/${configRepo.name}@${configRepo.default_branch || 'main'}/${selectedFileToDeploy.path}`}
                                    className="bg-transparent flex-1 text-[10px] font-mono text-indigo-400 border-none outline-none focus:ring-0 truncate"
                                  />
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`https://cdn.jsdelivr.net/gh/${configRepo.owner?.login}/${configRepo.name}@${configRepo.default_branch || 'main'}/${selectedFileToDeploy.path}`);
                                      alert('Copied CDN link!');
                                    }}
                                    className="text-[10px] text-indigo-400 hover:underline font-bold"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>

                              {/* Option B: Direct Raw Git url */}
                              <div className="p-3 bg-[#0A0A0B] border border-white/5 rounded-lg space-y-1">
                                <p className="text-[9px] uppercase font-mono font-bold text-slate-500">Raw GitHub Deployment Link</p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    readOnly
                                    value={`https://raw.githubusercontent.com/${configRepo.owner?.login}/${configRepo.name}/${configRepo.default_branch || 'main'}/${selectedFileToDeploy.path}`}
                                    className="bg-transparent flex-1 text-[10px] font-mono text-indigo-400 border-none outline-none focus:ring-0 truncate"
                                  />
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`https://raw.githubusercontent.com/${configRepo.owner?.login}/${configRepo.name}/${configRepo.default_branch || 'main'}/${selectedFileToDeploy.path}`);
                                      alert('Copied raw deploy link!');
                                    }}
                                    className="text-[10px] text-indigo-400 hover:underline font-bold"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2">
                              <a
                                href={`https://raw.githubusercontent.com/${configRepo.owner?.login}/${configRepo.name}/${configRepo.default_branch || 'main'}/${selectedFileToDeploy.path}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3.5 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                              >
                                <Play className="w-3.5 h-3.5" />
                                <span>Preview Deployment</span>
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- SCREEN 4: REPO DETAIL (FILE BROWSER) --- */}
              {screen === 'repo-detail' && selectedRepo && (
                <div className="space-y-6">
                  {/* Navigation Back */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setScreen('repos')}
                      className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs font-semibold transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Back to Repositories</span>
                    </button>

                    <button
                      onClick={() => triggerWipeRepo(selectedRepo)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 hover:border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      title="Wipe Repository (Delete All Files)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Wipe Repo</span>
                    </button>
                  </div>

                  {/* Header Brief */}
                  <div className="p-4 bg-[#141418] border border-white/5 rounded-2xl flex items-center justify-between">
                    <div className="text-left">
                      <h4 className="font-bold text-slate-100 text-base font-mono">{selectedRepo.name}</h4>
                      <p className="text-[10px] text-indigo-400 font-mono mt-0.5">/{currentPath || 'root'}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-white/5 text-[10px] text-slate-400 font-mono">
                        Branch: {selectedRepo.default_branch || 'main'}
                      </span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between gap-3 bg-[#0A0A0C] p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">DIRECTORY UTILITIES</span>
                    <div className="flex items-center gap-2">
                      {currentPath && (
                        <button
                          onClick={handleNavigateUp}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-semibold transition"
                        >
                          Up 1 Level
                        </button>
                      )}
                      <label className={`flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer transition ${uploadingSingle ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploadingSingle ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{uploadingSingle ? 'Uploading...' : 'Upload File'}</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleSingleFileSelect}
                          disabled={uploadingSingle}
                        />
                      </label>
                    </div>
                  </div>

                  {uploadSingleError && (
                    <p className="text-xs text-rose-400 font-medium px-2">{uploadSingleError}</p>
                  )}

                  {/* Contents Tree */}
                  <div className="bg-[#141418]/60 rounded-2xl border border-white/5 overflow-hidden max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {fetchingContents ? (
                      <div className="py-14 text-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
                        <p className="text-xs text-slate-500 font-mono">Downloading GitHub registry tree...</p>
                      </div>
                    ) : contentsError ? (
                      <p className="text-xs text-rose-400 text-center py-8">{contentsError}</p>
                    ) : repoContents.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">This folder has no files.</p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {repoContents.map((item, index) => (
                          <div
                            key={`content-${item.path || item.name || index}`}
                            className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition"
                          >
                            <div className="flex items-center gap-3 text-left overflow-hidden">
                              {item.type === 'dir' ? (
                                <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                              ) : (
                                <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              )}
                              
                              {item.type === 'dir' ? (
                                <button
                                  onClick={() => handleBrowseRepo(selectedRepo, item.path)}
                                  className="font-mono text-xs font-semibold text-slate-200 hover:text-indigo-400 hover:underline truncate"
                                >
                                  {item.name}/
                                </button>
                              ) : (
                                <span className="font-mono text-xs text-slate-300 truncate">
                                  {item.name}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {item.type !== 'dir' && (
                                <>
                                  <button
                                    onClick={() => handlePreviewFile(item)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition"
                                    title="Preview file"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleStartEditRepoFile(item)}
                                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition"
                                    title="Edit file inline"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <a
                                    href={item.download_url}
                                    download={item.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition"
                                    title="Download file"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </>
                              )}

                              {deletingFile === item.path ? (
                                <div className="flex items-center gap-1 bg-rose-500/5 p-0.5 border border-rose-500/10 rounded-lg">
                                  <button
                                    onClick={() => handleDeleteFile(item)}
                                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => setDeletingFile(null)}
                                    className="px-1.5 py-1 hover:bg-white/5 text-slate-400 rounded text-[9px]"
                                  >
                                    Esc
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingFile(item.path)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/5 rounded-lg transition"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* --- SCREEN 5: VERCEL DEPLOY PANEL --- */}
              {screen === 'deploy' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Navigation Back */}
                  <button
                    onClick={() => setScreen('home')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs font-semibold transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Control Center</span>
                  </button>

                  <div className="text-left">
                    <h3 className="text-lg font-bold text-slate-100">Vercel Instant Deployment</h3>
                    <p className="text-xs text-slate-400 mt-1">Host your digital assets on Vercel's global CDN network</p>
                  </div>

                  {!vercelToken ? (
                    /* Warning: Token Missing */
                    <div className="bg-[#141418] border border-white/5 rounded-2xl p-6 text-center space-y-4">
                      <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1.5 max-w-sm mx-auto">
                        <h4 className="font-bold text-slate-200 text-sm">Vercel Integration Token Required</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          To initiate direct serverless hostings and push packages to Vercel's global edge network, you must configure your Vercel Access Key first.
                        </p>
                      </div>
                      <button
                        onClick={() => setScreen('auth')}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-lg inline-flex items-center gap-2"
                      >
                        <Key className="w-4 h-4" />
                        <span>Configure Credentials</span>
                      </button>
                    </div>
                  ) : (
                    /* Core Deploy Forms */
                    <div className="space-y-5">
                      {/* Name Config */}
                      <div className="bg-[#141418] border border-white/5 rounded-2xl p-5 space-y-3 text-left">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Vercel Project Name</label>
                        <input
                          type="text"
                          value={vercelProjectName}
                          onChange={(e) => setVercelProjectName(e.target.value)}
                          className="w-full px-4 py-3 bg-[#0A0A0B] border border-white/10 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
                          placeholder="e.g. my-repostnow-app"
                        />
                      </div>

                      {/* Trigger Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Option 1: Deploy staged */}
                        <div className="p-5 bg-indigo-500/5 hover:bg-indigo-500/[0.08] border border-indigo-500/10 rounded-2xl text-left flex flex-col justify-between space-y-4 transition">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-slate-200 text-sm">Staged Local Files</h5>
                              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-mono px-2 py-0.5 rounded-full font-semibold">Staged</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Deploy the {stagedFiles.length} file(s) currently staged in your RepostNow offline workspace cache.
                            </p>
                          </div>
                          <button
                            onClick={handleDeployStagedToVercel}
                            disabled={stagedFiles.length === 0 || deployStatus === 'packing' || deployStatus === 'uploading' || deployStatus === 'queued' || deployStatus === 'building'}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl text-xs transition"
                          >
                            Deploy Staged Files
                          </button>
                        </div>

                        {/* Option 2: Deploy manual Zip */}
                        <div className="p-5 bg-teal-500/5 hover:bg-teal-500/[0.08] border border-teal-500/10 rounded-2xl text-left flex flex-col justify-between space-y-4 transition">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-slate-200 text-sm">Direct ZIP Package</h5>
                              <span className="text-[10px] bg-teal-500/10 text-teal-400 font-mono px-2 py-0.5 rounded-full font-semibold">ZIP Archive</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Upload a pre-built .zip folder archive to decompress and host immediately on Vercel's global CDN.
                            </p>
                          </div>
                          <label className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-center text-white font-bold rounded-xl text-xs transition cursor-pointer block">
                            Choose & Deploy ZIP
                            <input
                              type="file"
                              accept=".zip"
                              className="hidden"
                              onChange={handleDeployZipToVercel}
                              disabled={deployStatus === 'packing' || deployStatus === 'uploading' || deployStatus === 'queued' || deployStatus === 'building'}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Option 3: Deploy GitHub repository */}
                      {user && repos.length > 0 && (
                        <div className="bg-[#141418] border border-white/5 rounded-2xl p-5 space-y-4 text-left">
                          <div className="flex items-center gap-2">
                            <Github className="w-4 h-4 text-slate-400" />
                            <h5 className="font-bold text-slate-200 text-sm">Deploy Connected GitHub Repositories</h5>
                          </div>
                          <p className="text-xs text-slate-400">Select any repository in your GitHub account to compile and host on Vercel instantly.</p>
                          
                          <div className="max-h-[22vh] overflow-y-auto custom-scrollbar pr-1 divide-y divide-white/5 border border-white/5 rounded-xl bg-[#0A0A0B]/50">
                            {repos.map((repo, index) => (
                              <div key={`deploy-repo-${repo.id || repo.full_name || index}`} className="p-3 flex items-center justify-between text-xs hover:bg-white/[0.01] transition">
                                <span className="font-mono text-slate-300 font-semibold truncate max-w-[200px]">{repo.name}</span>
                                <button
                                  onClick={() => handleDeployRepoToVercel(repo)}
                                  disabled={deployStatus === 'packing' || deployStatus === 'uploading' || deployStatus === 'queued' || deployStatus === 'building'}
                                  className="px-3.5 py-1.5 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-white rounded-lg font-bold transition text-xs disabled:opacity-40 disabled:pointer-events-none"
                                >
                                  Deploy Repo
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* PROGRESS, STATUS & TERMINAL LOGS CONSOLE */}
                      {(deployStatus !== 'idle' || deployError || deployedUrl || deployLogs.length > 0) && (
                        <div className="p-5 bg-[#09090B] border border-white/10 rounded-2xl space-y-4 text-left shadow-2xl">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Terminal className="w-4 h-4 text-emerald-400" />
                              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Deployment Console</h4>
                            </div>
                            
                            {/* Live status badge */}
                            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border">
                              {deployStatus === 'packing' && (
                                <span className="text-amber-400 bg-amber-500/10 border-amber-500/20 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                                  Packing...
                                </span>
                              )}
                              {deployStatus === 'uploading' && (
                                <span className="text-indigo-400 bg-indigo-500/10 border-indigo-500/20 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></span>
                                  Uploading...
                                </span>
                              )}
                              {deployStatus === 'queued' && (
                                <span className="text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                                  Queued / Pending
                                </span>
                              )}
                              {deployStatus === 'building' && (
                                <span className="text-[#a855f7] bg-[#a855f7]/10 border-[#a855f7]/20 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-spin border-b border-purple-400"></span>
                                  Building...
                                </span>
                              )}
                              {deployStatus === 'success' && (
                                <span className="text-emerald-400 bg-emerald-500/10 border-emerald-500/20 flex items-center gap-1 px-1 py-0.5 rounded">
                                  ✓ Success
                                </span>
                              )}
                              {deployStatus === 'error' && (
                                <span className="text-rose-400 bg-rose-500/10 border-rose-500/20 flex items-center gap-1 px-1 py-0.5 rounded">
                                  ✗ Gagal
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Monospaced Log Console Screen */}
                          <div className="bg-[#050507] border border-white/5 rounded-xl p-4 h-[22vh] overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 custom-scrollbar select-all">
                            {deployLogs.length === 0 ? (
                              <p className="text-slate-600 italic">Waiting for compiler triggers...</p>
                            ) : (
                              deployLogs.map((log, index) => {
                                let textColor = 'text-slate-300';
                                if (log.includes('🎉') || log.includes('SUCCESS') || log.includes('✓')) {
                                  textColor = 'text-emerald-400 font-bold';
                                } else if (log.includes('❌') || log.includes('FAILED')) {
                                  textColor = 'text-rose-400 font-bold';
                                } else if (log.includes('⚠️') || log.includes('Warning')) {
                                  textColor = 'text-amber-400 font-medium';
                                } else if (log.includes('🚀') || log.includes('Initiating')) {
                                  textColor = 'text-indigo-400 font-medium';
                                }
                                return (
                                  <div key={`log-${index}`} className={`leading-relaxed break-all ${textColor}`}>
                                    {log}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Failures or Success Outcomes */}
                          {deployStatus === 'error' && (
                            <div className="p-4 bg-rose-500/5 border border-rose-500/15 rounded-xl text-rose-400 text-xs leading-relaxed flex items-start gap-2.5">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold">Pipeline compilation error ("Gagal"):</p>
                                <p className="mt-1">{deployError || 'Deployment failed to complete. Please double check API authorization keys.'}</p>
                              </div>
                            </div>
                          )}

                          {deployStatus === 'success' && deployedUrl && (
                            <div className="space-y-4 animate-scale-up">
                              <div className="p-4.5 bg-[#050507] border border-white/5 rounded-xl text-center space-y-3.5">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">Edge Landing Destination</p>
                                  <p className="font-mono text-indigo-400 text-sm font-semibold truncate select-all">{deployedUrl}</p>
                                </div>
                                <a
                                  href={deployedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/15"
                                >
                                  <span>Open Live Deployment Link</span>
                                  <ArrowRight className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* --- SCREEN 6: PROFILE PANEL --- */}
              {screen === 'profile' && user && (
                <div className="space-y-6 animate-fade-in text-left">
                  {/* Navigation Back */}
                  <button
                    onClick={() => setScreen('home')}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs font-semibold transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Control Center</span>
                  </button>

                  <div className="text-left">
                    <h3 className="text-lg font-bold text-slate-100">GitHub Profile Overview</h3>
                    <p className="text-xs text-slate-400 mt-1">Real-time statistics and connected account details</p>
                  </div>

                  {/* Profile Header Card */}
                  <div className="p-6 bg-[#141418] border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="w-20 h-20 rounded-full border-2 border-indigo-500/20 shadow-xl"
                    />
                    <div className="space-y-2 flex-1">
                      <div>
                        <h4 className="text-lg font-bold text-slate-100">{user.name || `@${user.login}`}</h4>
                        <p className="text-xs font-mono text-indigo-400 mt-0.5">@{user.login}</p>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                        {user.bio || 'This user has not added a bio to their GitHub profile.'}
                      </p>
                    </div>
                  </div>

                  {/* Stats Bento Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 bg-[#141418] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block">Repositories</span>
                      <span className="text-xl font-bold text-slate-100 font-mono mt-1 block">{user.public_repos + (user.total_private_repos || 0)}</span>
                    </div>
                    <div className="p-4 bg-[#141418] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block">Followers</span>
                      <span className="text-xl font-bold text-slate-100 font-mono mt-1 block">{user.followers}</span>
                    </div>
                    <div className="p-4 bg-[#141418] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block">Following</span>
                      <span className="text-xl font-bold text-slate-100 font-mono mt-1 block">{user.following || 0}</span>
                    </div>
                    <div className="p-4 bg-[#141418] border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block">Gists</span>
                      <span className="text-xl font-bold text-slate-100 font-mono mt-1 block">{user.public_gists || 0}</span>
                    </div>
                  </div>

                  {/* Detailed Information */}
                  <div className="bg-[#141418] border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden text-left font-sans">
                    {user.email && (
                      <div className="p-4 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Email Address</span>
                        <span className="font-mono text-slate-200">{user.email}</span>
                      </div>
                    )}
                    {user.location && (
                      <div className="p-4 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Location</span>
                        <span className="font-mono text-slate-200">{user.location}</span>
                      </div>
                    )}
                    {user.company && (
                      <div className="p-4 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Company</span>
                        <span className="font-mono text-slate-200">{user.company}</span>
                      </div>
                    )}
                    {user.blog && (
                      <div className="p-4 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Website / Blog</span>
                        <a
                          href={user.blog.startsWith('http') ? user.blog : `https://${user.blog}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-indigo-400 hover:underline truncate max-w-xs"
                        >
                          {user.blog}
                        </a>
                      </div>
                    )}
                    {user.created_at && (
                      <div className="p-4 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Account Created</span>
                        <span className="font-mono text-slate-200">
                          {new Date(user.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="p-4.5 border-t border-white/5 bg-[#0A0A0C] text-center flex items-center justify-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-500 animate-spin" />
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                RepostNow Core v1.2.0 • Decentralized Sandbox Environment
              </p>
            </div>
          </div>
        </motion.div>

          {/* Embedded File Previewer Modal */}
          {previewFile && (
            <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
          )}

          {/* Embedded Repository Code Editor Modal */}
          <AnimatePresence>
            {editingRepoFile && (
              <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setEditingRepoFile(null)}
                  className="absolute inset-0 bg-black/85 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ scale: 0.95, y: 15, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 15, opacity: 0 }}
                  className="relative w-full max-w-3xl h-[80vh] bg-[#0A0A0C] border border-white/10 rounded-2xl flex flex-col shadow-2xl z-10 overflow-hidden font-sans"
                >
                  {/* Editor Header */}
                  <div className="p-4 bg-[#111115] border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/10">
                        <Edit2 className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-amber-500 font-bold">REPOSTNOW GITHUB EDITOR</h3>
                        <p className="text-sm font-bold text-slate-100 font-mono truncate max-w-md">
                          {editingRepoFile.path}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingRepoFile(null)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Editor Body */}
                  <div className="flex-1 p-4 bg-[#070709] flex flex-col min-h-0">
                    <textarea
                      value={editingRepoFileContent}
                      onChange={(e) => setEditingRepoFileContent(e.target.value)}
                      className="w-full flex-1 p-4 bg-[#0A0A0C] border border-white/5 rounded-xl font-mono text-xs text-slate-300 focus:outline-none focus:border-amber-500/30 resize-none overflow-y-auto leading-relaxed"
                      placeholder="Write your code here..."
                      spellCheck={false}
                    />
                  </div>

                  {/* Editor Footer */}
                  <div className="p-4 bg-[#111115] border-t border-white/5 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setEditingRepoFile(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRepoFile}
                      disabled={savingRepoFile}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/10"
                    >
                      {savingRepoFile ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Pushing to GitHub...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Commit & Push Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* SECURE MATHEMATICAL CAPTCHA OVERLAY DIALOG */}
          <AnimatePresence>
            {captchaOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setCaptchaOpen(false)}
                  className="absolute inset-0 bg-black/85 backdrop-blur-md"
                />
                <motion.div
                  initial={{ scale: 0.95, y: 15, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.95, y: 15, opacity: 0 }}
                  className="relative w-full max-w-md bg-[#0F0F12] border border-rose-500/25 rounded-2xl p-6 shadow-[0_20px_50px_rgba(239,68,68,0.15)] text-center space-y-4 z-10"
                >
                  <div className="mx-auto w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-100">{captchaTitle}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-normal">{captchaSubtitle}</p>
                  </div>

                  <div className="bg-slate-950 border border-white/5 rounded-xl py-4 flex flex-col items-center justify-center space-y-1 select-none">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Verification Captcha Code</span>
                    <span className="text-3xl font-bold font-mono tracking-[8px] text-rose-400 bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent px-4 py-1">
                      {captchaCode}
                    </span>
                  </div>

                  <form onSubmit={handleCaptchaSubmit} className="space-y-3">
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Enter the 4-digit verification code"
                      value={captchaInput}
                      onChange={(e) => {
                        setCaptchaInput(e.target.value.replace(/\D/g, ''));
                        setCaptchaError(false);
                      }}
                      className="w-full text-center py-2.5 bg-black border border-white/10 rounded-xl text-slate-200 font-mono text-sm tracking-wider focus:outline-none focus:border-rose-500"
                      autoFocus
                    />

                    {captchaError && (
                      <p className="text-xs text-rose-400 font-medium">Verification failed. Code does not match.</p>
                    )}

                    <div className="flex gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setCaptchaOpen(false)}
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-white/5 rounded-xl text-xs font-semibold transition"
                      >
                        Cancel Action
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition"
                      >
                        Authorize permanent deletion
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  );
}
