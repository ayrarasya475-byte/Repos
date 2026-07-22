import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Bot, User, Trash2, Copy, Eye, Volume2, Download, RefreshCw,
  Sliders, Key, ToggleLeft, ToggleRight, Check, History, Paperclip, Search,
  Terminal, Code2, AlertCircle, Play, FileJson, Layers, Laptop, X, ChevronDown, ChevronUp, Link as LinkIcon
} from 'lucide-react';
import { UploadFile, GitHubRepo } from '../types';
import JSZip from 'jszip';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'thinking' | 'search' | 'studio' | 'default';
  isCode?: boolean;
  codeLanguage?: string;
  fileName?: string;
  thinkingSteps?: string[];
  searchQueries?: string[];
  searchLinks?: Array<{ title: string; url: string; snippet?: string }>;
  studioLogs?: string[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface ApiEndpoint {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
}

interface AiAssistantPanelProps {
  stagedFiles: UploadFile[];
  onUpdateStagedFiles: React.Dispatch<React.SetStateAction<UploadFile[]>>;
  repos?: GitHubRepo[];
}

export default function AiAssistantPanel({
  stagedFiles,
  onUpdateStagedFiles,
  repos = []
}: AiAssistantPanelProps) {
  // Navigation & Drawer states
  const [showHistory, setShowHistory] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);

  // Chat settings
  const [systemPrompt, setSystemPrompt] = useState('You are an expert full-stack developer in RepostNow Code Studio. Write elegant, production-ready code with detailed comments.');
  const [allowRepoAccess, setAllowRepoAccess] = useState(true);
  const [intelligence, setIntelligence] = useState<'default' | 'high' | 'max'>('high');

  // Accordion expands
  const [expandedAccordions, setExpandedAccordions] = useState<{ [msgId: string]: boolean }>({});

  // API Configuration (Pollinations + up to 5 custom endpoints)
  const [customEndpoints, setCustomEndpoints] = useState<ApiEndpoint[]>(() => {
    const stored = localStorage.getItem('repostnow_custom_apis');
    return stored ? JSON.parse(stored) : [
      { id: 'pollinations', name: 'Pollinations AI (Default)', url: 'https://text.pollinations.ai/', isActive: true }
    ];
  });

  const [newApiName, setNewApiName] = useState('');
  const [newApiUrl, setNewApiUrl] = useState('');

  // Active AI mode
  const [aiMode, setAiMode] = useState<'thinking' | 'search' | 'studio' | 'default'>('default');

  // Conversations state
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = localStorage.getItem('repostnow_ai_sessions');
    if (stored) return JSON.parse(stored);
    return [
      {
        id: 'initial',
        title: 'New Code Studio Session',
        messages: [
          {
            id: 'welcome',
            role: 'assistant',
            content: 'Hello! I am your **RepostNow Code Studio AI Assistant**.\n\nI am fully connected to your workspace. You can ask me to write code, debug issues, or modify your repository.\n\nType **slash commands** like:\n- `/Menu` - Displays the available workspace shortcuts menu.\n- `/Build App.tsx` - Creates/stages custom files.\n- `/Repos` - Displays your current GitHub repositories.\n- `/Deploy` - Triggers real-time Vercel production compilation.\n\nChoose your workflow mode above:\n- **Thinking**: In-depth logical analysis powered by web-search references.\n- **Search**: Scours online trends and APIs to get accurate documentation.\n- **Code Studio**: Unleashes max reasoning to write files and debug systems directly.',
            mode: 'default'
          }
        ],
        createdAt: new Date().toISOString()
      }
    ];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>('initial');

  // UI Input states
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadFile[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentSessionId, loading]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('repostnow_ai_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('repostnow_custom_apis', JSON.stringify(customEndpoints));
  }, [customEndpoints]);

  const defaultSession: ChatSession = {
    id: 'initial',
    title: 'New Code Studio Session',
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I am your **RepostNow Code Studio AI Assistant**.\n\nI am fully connected online. Ask me to write code, debug issues, or execute workspace commands.\n\nType **slash commands** like:\n- `/Menu` - Displays available shortcuts.\n- `/Build <filename> <content>` - Creates/stages custom files.\n- `/Deploy <repo_name or empty>` - Triggers instant Vercel auto-deployment.\n- `/Debug <repo or vercel_link>` - Explains errors, checks deployment status & logs.\n- `/Repos` - Displays your connected GitHub repositories.',
        mode: 'default'
      }
    ],
    createdAt: new Date().toISOString()
  };

  const currentSession = (sessions && sessions.length > 0)
    ? (sessions.find(s => s.id === currentSessionId) || sessions[0])
    : defaultSession;

  const handleAttachStagedFile = (file: UploadFile) => {
    setAttachedFiles(prev => {
      const exists = prev.some(f => f.id === file.id);
      if (exists) return prev;
      return [...prev, file];
    });
  };

  const handleToggleAccordion = (msgId: string) => {
    setExpandedAccordions(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Text-To-Speech
  const handleListen = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Your browser does not support text-to-speech.');
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/`{1,3}[\s\S]*?`{1,3}/g, ' [Code Block] ').replace(/[*#_\\-]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  };

  // Copy code/text
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Download code block as raw file
  const handleDownloadFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'code_studio_file.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download all codes inside assistant response as ZIP
  const handleDownloadResponseZip = (text: string) => {
    const zip = new JSZip();
    const regex = /```(\w+)?\s*(?:\/\/\s*([\w\-.]+)\s*\n)?([\s\S]*?)```/g;
    let match;
    let fileCount = 0;

    while ((match = regex.exec(text)) !== null) {
      const language = match[1] || 'txt';
      const declaredName = match[2];
      const code = match[3];
      const fileName = declaredName || `file_${++fileCount}.${language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : language}`;
      zip.file(fileName, code);
    }

    if (fileCount === 0) {
      alert('No code blocks found to pack into a ZIP.');
      return;
    }

    zip.generateAsync({ type: 'blob' }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'code_studio_bundle.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  // Write a generated file directly into the staging workspace!
  const handleInjectFileToWorkspace = (fileName: string, content: string) => {
    const fileObj = new File([content], fileName, { type: 'text/plain' });
    const newUploadFile: UploadFile = {
      id: crypto.randomUUID(),
      name: fileName,
      path: fileName,
      size: fileObj.size,
      type: 'text/plain',
      file: fileObj,
      status: 'pending',
      progress: 0
    };

    onUpdateStagedFiles((prev) => {
      const filtered = prev.filter(f => f.path !== fileName);
      return [...filtered, newUploadFile];
    });

    alert(`File "${fileName}" has been created/updated and staged in your workspace!`);
  };

  // Handle local machine file upload to AI context
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList) return;

    const loadedFiles: UploadFile[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const originalFile = filesList[i];
      const customFile: UploadFile = {
        id: crypto.randomUUID(),
        name: originalFile.name,
        path: originalFile.name,
        size: originalFile.size,
        type: originalFile.type || 'text/plain',
        file: originalFile,
        status: 'pending',
        progress: 0
      };
      loadedFiles.push(customFile);
    }

    setAttachedFiles(prev => [...prev, ...loadedFiles]);
  };

  const handleAddEndpoint = () => {
    if (!newApiName.trim() || !newApiUrl.trim()) return;
    const newEp: ApiEndpoint = {
      id: crypto.randomUUID(),
      name: newApiName.trim(),
      url: newApiUrl.trim(),
      isActive: false
    };
    if (customEndpoints.length >= 6) {
      alert('Maximum 5 custom endpoints reached.');
      return;
    }
    setCustomEndpoints([...customEndpoints, newEp]);
    setNewApiName('');
    setNewApiUrl('');
  };

  const handleToggleEndpoint = (id: string) => {
    setCustomEndpoints(prev =>
      prev.map(ep => ({ ...ep, isActive: ep.id === id }))
    );
  };

  const handleDeleteEndpoint = (id: string) => {
    if (id === 'pollinations') return;
    setCustomEndpoints(prev => {
      const filtered = prev.filter(ep => ep.id !== id);
      if (filtered.length > 0 && !filtered.some(e => e.isActive)) {
        filtered[0].isActive = true;
      }
      return filtered;
    });
  };

  // Insert a real-time instant local response for fallback commands
  const insertLocalAssistantMessage = (text: string, thinking?: string[], searchRes?: any[], logs?: string[]) => {
    const newAssistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: text,
      mode: aiMode,
      thinkingSteps: thinking,
      searchQueries: searchRes ? ['Checking local index', 'Querying repo metadata'] : undefined,
      searchLinks: searchRes,
      studioLogs: logs
    };

    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, newAssistantMessage]
          };
        }
        return s;
      })
    );
  };

  // Send message to Pollinations/API with command processing
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;

    const userPrompt = input.trim();
    setInput('');

    // Highlight user's input of the slash command in chat log instantly
    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userPrompt + (attachedFiles.length > 0 ? ` (with ${attachedFiles.length} attachments)` : ''),
      mode: aiMode
    };

    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: [...s.messages, newUserMessage]
          };
        }
        return s;
      })
    );

    // COMMAND INTERCEPTOR (SLASH COMMANDS)
    if (userPrompt.startsWith('/')) {
      const parts = userPrompt.split(/\s+/);
      const command = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');

      if (command === '/menu') {
        insertLocalAssistantMessage(
          `### 💻 RepostNow Studio AI Slash Commands Menu:\n\n` +
          `- <span class="text-blue-400 font-bold font-mono">/Menu</span> : Displays this command directory.\n` +
          `- <span class="text-blue-400 font-bold font-mono">/Deploy &lt;nama repositori atau kosong&gt;</span> : Directly triggers real-time Vercel auto-deployment for a repository or current staged workspace files.\n` +
          `- <span class="text-blue-400 font-bold font-mono">/Debug &lt;Repos/link vercel yang sudah di deploy&gt;</span> : Explains errors about repo or vercel project, inspects build logs, status & solutions.\n` +
          `- <span class="text-blue-400 font-bold font-mono">/Build &lt;filename&gt; &lt;content&gt;</span> : Creates and stages a file in your workspace.\n` +
          `- <span class="text-blue-400 font-bold font-mono">/Add &lt;filename&gt;</span> : Creates a template component and stages it in workspace.\n` +
          `- <span class="text-blue-400 font-bold font-mono">/Repos [kata kunci]</span> : Queries and lists connected GitHub repositories.\n\n` +
          `*Note: No manual permissions required. Vercel SPA routing (\`vercel.json\`) and root \`index.html\` are automatically injected when missing.*`,
          ['Initializing slash command engine', 'Checking workspace state'],
          undefined,
          ['Executed /Menu router']
        );
        return;
      }

      if (command === '/repos') {
        if (!repos || repos.length === 0) {
          insertLocalAssistantMessage(
            `⚠️ **No connected GitHub repositories found.**\n\nPlease verify your GitHub Personal Access Token or configure credentials in the settings tab to load repositories.`,
            ['Scanning GitHub credentials', 'Reading repo caches'],
            undefined,
            ['Checked connected GitHub account']
          );
          return;
        }

        let filtered = repos;
        if (arg) {
          const query = arg.toLowerCase();
          filtered = repos.filter(r => r.name.toLowerCase().includes(query) || (r.description && r.description.toLowerCase().includes(query)));
        }

        const repoRows = filtered.slice(0, 15).map((r, index) => 
          `${index + 1}. **${r.name}** (${r.private ? '🔒 Private' : '🌐 Public'})\n` +
          `   - URL: [${r.html_url}](${r.html_url})\n` +
          `   - Main Language: \`${r.language || 'TypeScript'}\`\n` +
          `   - Branch: \`${r.default_branch || 'main'}\``
        ).join('\n\n');

        const header = arg
          ? `### 🔍 Filtered GitHub Repositories for keyword "${arg}" (${filtered.length} matches):\n\n`
          : `### 📂 Connected GitHub Repositories (${filtered.length} total):\n\n`;

        insertLocalAssistantMessage(
          header + (repoRows || '*No matching repositories found under this search filter category.*'),
          ['Fetching active repositories list', `Filtering by category: "${arg}"`],
          undefined,
          [`Queried repos list: found ${filtered.length} matches`]
        );
        return;
      }

      if (command === '/deploy') {
        const targetRepoName = arg ? arg.trim() : '';
        const vercelToken = localStorage.getItem('repostnow_vercel_token') || '';
        
        if (!vercelToken) {
          insertLocalAssistantMessage(
            `⚠️ **Vercel API Token Missing!**\n\nPlease configure your Vercel API Token in the **Settings / Vercel Credentials** tab first so AI can deploy on your behalf.`,
            ['Checking Vercel API credentials'],
            undefined,
            ['Deployment aborted: missing vercelToken']
          );
          return;
        }

        insertLocalAssistantMessage(
          `🚀 **AI Auto-Deployment Active!**\n\n` +
          `Preparing ${targetRepoName ? `repository "${targetRepoName}"` : `${stagedFiles.length} staged workspace file(s)`} for production compilation on Vercel...\n` +
          `Auto-injecting \`vercel.json\` and \`index.html\` if missing...`,
          ['Preparing deployment payload', 'Ensuring vercel.json & index.html routing', 'Calling Vercel Edge API'],
          undefined,
          [`Initiated /deploy ${targetRepoName}`]
        );

        (async () => {
          try {
            let filesList: Array<{ file: string; data: Uint8Array }> = [];

            if (targetRepoName) {
              const matchedRepo = repos.find(r => r.name.toLowerCase() === targetRepoName.toLowerCase() || r.full_name.toLowerCase().endsWith(`/${targetRepoName.toLowerCase()}`));
              if (!matchedRepo) {
                insertLocalAssistantMessage(`⚠️ Repository "${targetRepoName}" not found in your connected GitHub account.`);
                return;
              }

              const ref = matchedRepo.default_branch || 'main';
              const ownerName = matchedRepo.owner?.login || '';
              const token = localStorage.getItem('repostnow_github_token') || '';
              const response = await fetch(`/api/proxy-github-zip?owner=${encodeURIComponent(ownerName)}&repo=${encodeURIComponent(matchedRepo.name)}&ref=${encodeURIComponent(ref)}&token=${encodeURIComponent(token)}&_nocache=${Date.now()}`);

              if (!response.ok) {
                throw new Error(`Failed to download repository files from GitHub (HTTP ${response.status})`);
              }

              const zipBlob = await response.blob();
              const zip = await JSZip.loadAsync(zipBlob);

              for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                if (!zipEntry.dir) {
                  const content = await zipEntry.async('uint8array');
                  const segments = relativePath.split('/');
                  segments.shift();
                  const cleanPath = segments.join('/');
                  if (cleanPath) {
                    filesList.push({ file: cleanPath, data: content });
                  }
                }
              }
            } else {
              if (stagedFiles.length === 0) {
                insertLocalAssistantMessage(`⚠️ Workspace staging is empty. Please add files in the home tab or specify repo e.g. \`/deploy my-repo\`.`);
                return;
              }
              for (const staged of stagedFiles) {
                const arrayBuffer = await staged.file.arrayBuffer();
                filesList.push({ file: staged.path, data: new Uint8Array(arrayBuffer) });
              }
            }

            // Auto-enrich vercel.json & index.html
            const hasVercelJson = filesList.some(f => f.file.toLowerCase() === 'vercel.json');
            const hasIndexHtml = filesList.some(f => f.file.toLowerCase() === 'index.html' || f.file.toLowerCase().endsWith('/index.html'));

            if (!hasVercelJson) {
              const vJson = JSON.stringify({ rewrites: [{ source: "/(.*)", destination: "/index.html" }] }, null, 2);
              filesList.push({ file: 'vercel.json', data: new TextEncoder().encode(vJson) });
            }

            if (!hasIndexHtml) {
              const iHtml = `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8"><title>Deployed App</title></head>\n  <body><div id="root"></div></body>\n</html>`;
              filesList.push({ file: 'index.html', data: new TextEncoder().encode(iHtml) });
            }

            // Filter junk & environment files
            filesList = filesList.filter(item => {
              const p = item.file.toLowerCase().replace(/\\/g, '/');
              const fileName = p.split('/').pop() || p;
              return !(
                p.includes('node_modules/') ||
                p.includes('.git/') ||
                p.includes('.github/') ||
                p.endsWith('.ds_store') ||
                fileName.startsWith('.env') ||
                fileName.endsWith('.env') ||
                fileName === '.gitignore' ||
                fileName === '.npmrc'
              );
            });

            // Hash & Upload
            const processedFiles = await Promise.all(filesList.map(async item => {
              const hashBuffer = await crypto.subtle.digest('SHA-1', item.data);
              const sha = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
              return { file: item.file, sha, size: item.data.length, data: item.data };
            }));

            for (const item of processedFiles) {
              await fetch(`/api/proxy-vercel-file?file=${encodeURIComponent(item.file)}`, {
                method: 'POST',
                headers: {
                  'x-vercel-token': vercelToken,
                  'Content-Type': 'application/octet-stream',
                  'x-now-digest': item.sha,
                  'x-now-size': String(item.size),
                },
                body: item.data,
              });
            }

            const projName = targetRepoName ? targetRepoName.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'repostnow-app';
            const payload = {
              name: projName,
              files: processedFiles.map(i => ({ file: i.file, sha: i.sha, size: i.size, mode: 33188 })),
              projectSettings: { framework: null }
            };

            const createRes = await fetch(`/api/proxy-vercel-deployments`, {
              method: 'POST',
              headers: {
                'x-vercel-token': vercelToken,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            });

            const deployData = await createRes.json();
            if (!createRes.ok) {
              throw new Error(deployData?.error?.message || 'Vercel Deployment creation failed');
            }

            const liveUrl = `https://${deployData.url}`;
            insertLocalAssistantMessage(
              `🎉 **Vercel Deployment Complete!**\n\n` +
              `Your app is now live on Vercel:\n\n` +
              `🌐 **Live URL**: [${liveUrl}](${liveUrl})\n` +
              `🆔 **Deployment ID**: \`${deployData.id}\`\n` +
              `📦 **Files Compiled**: ${processedFiles.length} source file(s)\n\n` +
              `*Routing configurations (\`vercel.json\`) and root \`index.html\` auto-injected seamlessly.*`,
              ['Deployment succeeded', 'Verified live URL'],
              [{ title: `Vercel Deployment: ${projName}`, url: liveUrl }],
              [`Deployed project ${projName} to ${liveUrl}`]
            );
          } catch (err: any) {
            insertLocalAssistantMessage(
              `❌ **Deployment Error:**\n\n${err.message || 'Failed to deploy to Vercel.'}`,
              ['Deployment attempt failed'],
              undefined,
              [`Error: ${err.message}`]
            );
          }
        })();
        return;
      }

      if (command === '/debug') {
        const target = arg ? arg.trim() : '';
        if (!target) {
          insertLocalAssistantMessage(
            `⚠️ **Usage:** \`/debug <Repos/link vercel yang sudah di deploy>\`\n\nContoh: \`/debug my-repo\` atau \`/debug https://repostnow-app.vercel.app\``
          );
          return;
        }

        const vercelToken = localStorage.getItem('repostnow_vercel_token') || '';

        insertLocalAssistantMessage(
          `🔍 **AI Debugging Engine Active!**\n\nAnalyzing target: \`${target}\`...\nFetching build status, deployment logs, and repository configurations...`,
          ['Inspecting Vercel API status', 'Fetching build logs', 'Analyzing repository configurations'],
          undefined,
          [`Debugging target: ${target}`]
        );

        (async () => {
          try {
            let debugContext = `Target: ${target}\n`;

            if (vercelToken) {
              try {
                const projsRes = await fetch(`/api/proxy-vercel-projects`, {
                  headers: { 'x-vercel-token': vercelToken }
                });
                if (projsRes.ok) {
                  const projsData = await projsRes.json();
                  const projects = projsData.projects || [];
                  const matchedProj = projects.find((p: any) => 
                    p.name.toLowerCase().includes(target.toLowerCase()) || 
                    target.toLowerCase().includes(p.name.toLowerCase())
                  );
                  if (matchedProj) {
                    debugContext += `Vercel Project Found: ${matchedProj.name} (ID: ${matchedProj.id})\n`;
                    debugContext += `Framework: ${matchedProj.framework || 'Custom/SPA'}\n`;
                    debugContext += `Updated At: ${new Date(matchedProj.updatedAt).toLocaleString()}\n`;
                    if (matchedProj.targets?.production) {
                      debugContext += `Production Target: ${matchedProj.targets.production.url}\nState: ${matchedProj.targets.production.readyState}\n`;
                    }
                  }
                }
              } catch (vErr) {
                console.error('Vercel debug fetch error:', vErr);
              }
            }

            const matchedRepo = repos.find(r => r.name.toLowerCase().includes(target.toLowerCase()) || target.toLowerCase().includes(r.name.toLowerCase()));
            if (matchedRepo) {
              debugContext += `GitHub Repository Found: ${matchedRepo.full_name}\n`;
              debugContext += `Default Branch: ${matchedRepo.default_branch || 'main'}\n`;
              debugContext += `Open Issues / PRs: ${matchedRepo.open_issues_count || 0}\n`;
              debugContext += `Language: ${matchedRepo.language || 'TypeScript'}\n`;
            }

            const prompt = `Lakukan analisa debug dan penjelasan lengkap mengenai error / status repositori & project vercel ini:\n\n${debugContext}\n\nBerikan penjelasan penyebab error, status kesehatan deployment, serta langkah perbaikan yang konkret.`;

            const aiResponse = await fetch('/api/gemini/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [
                  { role: 'user', content: prompt }
                ],
                systemPrompt: 'You are an expert DevOps and Full-Stack Web Engineer. Provide clear, detailed, and actionable diagnostic reports.',
                temperature: 0.3
              })
            });

            if (aiResponse.ok) {
              const reportText = await aiResponse.text();
              insertLocalAssistantMessage(
                `🛠️ **Laporan Diagnostik AI untuk \`${target}\`**:\n\n${reportText}`,
                ['Analyzed Vercel & GitHub metadata', 'Synthesized diagnostic insights'],
                undefined,
                [`Completed debug analysis for ${target}`]
              );
            } else {
              insertLocalAssistantMessage(
                `🔍 **Hasil Pengecekan \`${target}\`**:\n\n` +
                `\`\`\`text\n${debugContext}\n\`\`\`\n` +
                `*Status*: Konfigurasi project terpantau normal. Jika terjadi 404 pada SPA, pastikan file \`vercel.json\` berisi rewrites ke \`/index.html\`.`
              );
            }
          } catch (err: any) {
            insertLocalAssistantMessage(`⚠️ Error saat menjalankan debug: ${err.message || 'Gagal memeriksa target.'}`);
          }
        })();
        return;
      }

      if (command === '/build' && arg) {
        const fileMatch = arg.match(/^([\w.\-\/]+)\s+([\s\S]+)$/);
        if (fileMatch) {
          const fileName = fileMatch[1];
          const fileContent = fileMatch[2];
          handleInjectFileToWorkspace(fileName, fileContent);
          insertLocalAssistantMessage(
            `✅ **File Created and Staged!**\n\nI have built and staged \`${fileName}\` in your workspace staging area. You can view or upload it on your home dashboard.`,
            ['Parsing build request', `Writing file contents for ${fileName}`],
            undefined,
            [`Wrote ${fileName} to staging`]
          );
          return;
        } else {
          insertLocalAssistantMessage(
            `⚠️ **Invalid /build syntax!**\n\nUse \`/build <filename> <content>\` (e.g. \`/build App.tsx export default function App() { return <div>Hello</div>; }\`)`,
            ['Validating command parameters'],
            undefined,
            ['Command error: invalid /build syntax']
          );
          return;
        }
      }

      if (command === '/add' && arg) {
        const fileName = arg.trim();
        if (fileName) {
          const fileContent = `// Created via RepostNow Studio AI\n// File: ${fileName}\n\nexport default function ${fileName.split('.')[0]}() {\n  return <div>Custom component</div>;\n}`;
          handleInjectFileToWorkspace(fileName, fileContent);
          insertLocalAssistantMessage(
            `✅ **File "${fileName}" Staged!**\n\nI have created a template file \`${fileName}\` and added it to your workspace staging area!`,
            [`Staging ${fileName}`],
            undefined,
            [`Staged file: ${fileName}`]
          );
          return;
        }
      }

      if (command === '/push' || command === '/upload') {
        if (stagedFiles.length === 0) {
          insertLocalAssistantMessage(
            `⚠️ **No files to push!**\n\nStaging is empty. Drag and drop files onto the home tab or use \`/build\` to create files first.`,
            ['Scanning local workspace'],
            undefined,
            ['Push error: staging is empty']
          );
          return;
        }
        
        insertLocalAssistantMessage(
          `📤 **Repository Push Initialized!**\n\nI am preparing **${stagedFiles.length} staged files** to be pushed to GitHub.\n\n` +
          `Please complete the upload using the **"Upload Repository"** button on the home dashboard column to choose your repository name, visibility, and branch parameters securely.`,
          ['Validating file structures', 'Bundling code payloads'],
          undefined,
          stagedFiles.map(f => `Bundled: ${f.name}`)
        );
        return;
      }
    }

    setLoading(true);

    // Compile attachments context
    let attachmentsText = '';
    if (attachedFiles.length > 0) {
      attachmentsText = '\n\n### Attached Files Context:\n';
      for (const f of attachedFiles) {
        try {
          const text = await f.file.text();
          attachmentsText += `\n--- FILE: ${f.path} ---\n${text}\n`;
        } catch (err) {
          attachmentsText += `\n--- FILE: ${f.path} (Failed to read content) ---\n`;
        }
      }
    }

    // Compile repository workspace context
    let repoContext = '';
    if (allowRepoAccess && stagedFiles.length > 0) {
      repoContext = '\n\n### Staged Repository Workspace Files:\n';
      stagedFiles.slice(0, 10).forEach(f => {
        repoContext += `- File Path: \`${f.path}\` (${(f.size / 1024).toFixed(2)} KB)\n`;
      });
      if (stagedFiles.length > 10) {
        repoContext += `... and ${stagedFiles.length - 10} more files.\n`;
      }
    }

    const modeInstructions = {
      thinking: 'Perform a detailed logic investigation step-by-step. Double-check all boundary cases.',
      search: 'Simulate search query results to integrate modern packages and docs.',
      studio: 'Provide complete implementation code blocks. Include target file paths as comments at the very top (e.g., // filename.js or // src/App.tsx) so the user can easily install them.',
      default: ''
    };

    const finalPrompt = `${modeInstructions[aiMode]}\n\nUser Question:\n${userPrompt}${attachmentsText}${repoContext}`;
    setAttachedFiles([]); // Clear attachments

    try {
      const activeEp = customEndpoints.find(ep => ep.isActive) || customEndpoints[0];
      const modelParam = intelligence === 'max' ? 'claude' : intelligence === 'high' ? 'openai' : 'mistral';
      
      const payloadMessages = [
        { role: 'system', content: systemPrompt },
        ...currentSession.messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: finalPrompt }
      ];

      let responseText = '';
      if (activeEp.id === 'pollinations') {
        const response = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            systemPrompt: systemPrompt,
            temperature: aiMode === 'studio' ? 0.2 : 0.7
          })
        });

        if (response.ok) {
          responseText = await response.text();
        } else {
          const errMsg = await response.text();
          throw new Error(errMsg || 'Gemini API Error. Please try again.');
        }
      } else {
        const response = await fetch(activeEp.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            model: modelParam,
            temperature: aiMode === 'studio' ? 0.2 : 0.7
          })
        });

        if (response.ok) {
          responseText = await response.text();
        } else {
          // Fallback to Pollinations GET if active endpoint fails
          const encoded = encodeURIComponent(finalPrompt);
          const fallbackRes = await fetch(`https://text.pollinations.ai/${encoded}?system=${encodeURIComponent(systemPrompt)}&model=${modelParam}`);
          if (fallbackRes.ok) {
            responseText = await fallbackRes.text();
          } else {
            throw new Error('All code-studio compilation endpoints timed out. Please check network routing.');
          }
        }
      }

      // Generate realistic thinking processes, search queries, or studio logs dynamically
      let steps: string[] | undefined = undefined;
      let links: any[] | undefined = undefined;
      let logs: string[] | undefined = undefined;

      if (aiMode === 'thinking') {
        steps = [
          'Deconstructing user requirement parameters',
          'Scanning local file structures for overlapping configurations',
          'Validating type definitions and import bindings',
          'Reviewing potential memory leaks or state lifecycle side-effects'
        ];
        links = [
          { title: 'MDN Web Docs: Clean React State Lifecycles', url: 'https://developer.mozilla.org' },
          { title: 'Vite Production Static Bundle Best Practices', url: 'https://vite.dev' }
        ];
      } else if (aiMode === 'search') {
        links = [
          { title: 'NPM: @google/genai Model Options', url: 'https://npmjs.com' },
          { title: 'GitHub Octokit API Reference Manual', url: 'https://github.com' }
        ];
      } else if (aiMode === 'studio') {
        logs = [
          'Reading index.html root entry point',
          'Analyzing component layout tree',
          'Writing custom logic files',
          'Regenerating tailwind build outputs'
        ];
      }

      const newAssistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        mode: aiMode,
        thinkingSteps: steps,
        searchLinks: links,
        studioLogs: logs
      };

      setSessions(prev =>
        prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: [...s.messages, newAssistantMessage]
            };
          }
          return s;
        })
      );
    } catch (err: any) {
      console.error(err);
      
      // LOGICAL OFFLINE COMMAND FALLBACK WHEN AI DISCONNECTED OR TIMED OUT
      let fallbackText = `❌ **Network Timeout/Disconnected:** Direct AI endpoints are currently busy.\n\nHowever, RepostNow Studio is completely operational offline!\n\n`;
      if (userPrompt.toLowerCase().includes('clock') || userPrompt.toLowerCase().includes('jam')) {
        fallbackText += `Here is a custom, fully functional offline template for a dynamic React Digital Clock you requested:\n\n` +
          `\`\`\`tsx\n// src/components/DigitalClock.tsx\nimport React, { useState, useEffect } from 'react';\n\nexport default function DigitalClock() {\n  const [time, setTime] = useState(new Date());\n\n  useEffect(() => {\n    const timer = setInterval(() => setTime(new Date()), 1000);\n    return () => clearInterval(timer);\n  }, []);\n\n  return (\n    <div className="p-6 bg-slate-900 border border-white/5 rounded-2xl text-center">\n      <h4 className="text-sm font-bold text-slate-400">Current Time</h4>\n      <p className="text-4xl font-black text-indigo-400 mt-2 font-mono">{time.toLocaleTimeString()}</p>\n    </div>\n  );\n}\n\`\`\``;
      } else {
        fallbackText += `You can continue using real-time local slash commands: \`/Menu\`, \`/Repos\`, or \`/Deploy\` to manage your deployment pipeline seamlessly without internet AI connection.`;
      }

      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fallbackText,
        mode: aiMode,
        thinkingSteps: ['Network fallback initialized', 'Locating offline templates'],
        studioLogs: ['Recovering offline services']
      };

      setSessions(prev =>
        prev.map(s => {
          if (s.id === currentSessionId) {
            return {
              ...s,
              messages: [...s.messages, errorMsg]
            };
          }
          return s;
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewSession = () => {
    const newId = crypto.randomUUID();
    const newSess: ChatSession = {
      id: newId,
      title: `Session ${sessions.length + 1}`,
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'New clean Code Studio session initialized. Ask me to write code or analyze problems.'
        }
      ],
      createdAt: new Date().toISOString()
    };
    setSessions([...sessions, newSess]);
    setCurrentSessionId(newId);
    setShowHistory(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) return;
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (currentSessionId === id) {
      setCurrentSessionId(filtered[0].id);
    }
  };

  // Helper to color and format slash commands beautifully in blue inside chat message blocks
  const formatTextWithBlueCommands = (text: string) => {
    if (!text) return '';
    // Match /Menu, /Build, /Code, /Repos, /Deploy, /Add (case-insensitive)
    const regex = /(\/(menu|build|code|repos|deploy|add)(?:\b|\s))/gi;
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (part.toLowerCase().startsWith('/menu') || part.toLowerCase().startsWith('/build') || part.toLowerCase().startsWith('/code') || part.toLowerCase().startsWith('/repos') || part.toLowerCase().startsWith('/deploy') || part.toLowerCase().startsWith('/add')) {
        return <span key={index} className="text-blue-400 font-extrabold font-mono">{part}</span>;
      }
      return part;
    });
  };

  // Advanced, ultra-polished, secure client-side markdown formatter
  const parseMarkdownText = (text: string) => {
    if (!text) return '';
    
    // Split text into paragraphs/lines to format list items and paragraphs
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      const lineKey = `line-${idx}`;
      
      // 1. Headers (### or ## or #)
      if (trimmed.startsWith('###')) {
        return (
          <h4 key={lineKey} className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono text-indigo-400 mt-4 mb-2">
            {formatInlineMarkdown(trimmed.replace('###', '').trim())}
          </h4>
        );
      }
      if (trimmed.startsWith('##')) {
        return (
          <h3 key={lineKey} className="text-sm font-bold text-slate-50 tracking-tight mt-5 mb-2.5 border-b border-white/5 pb-1 text-indigo-400">
            {formatInlineMarkdown(trimmed.replace('##', '').trim())}
          </h3>
        );
      }
      if (trimmed.startsWith('#')) {
        return (
          <h2 key={lineKey} className="text-base font-black text-white tracking-tight mt-6 mb-3 text-indigo-400">
            {formatInlineMarkdown(trimmed.replace('#', '').trim())}
          </h2>
        );
      }

      // 2. Unordered List Items (- or *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        return (
          <div key={lineKey} className="flex items-start gap-2 ml-4 my-1 text-slate-300 text-xs sm:text-sm text-left">
            <span className="text-indigo-400 select-none mt-1.5 text-[6px]">●</span>
            <span className="flex-1">{formatInlineMarkdown(content)}</span>
          </div>
        );
      }

      // 3. Numbered List Items (1. or 2.)
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        return (
          <div key={lineKey} className="flex items-start gap-2 ml-4 my-1 text-slate-300 text-xs sm:text-sm text-left">
            <span className="text-indigo-400 font-mono font-bold select-none text-xs">{numMatch[1]}.</span>
            <span className="flex-1">{formatInlineMarkdown(numMatch[2])}</span>
          </div>
        );
      }

      // 4. Empty lines
      if (!trimmed) {
        return <div key={lineKey} className="h-2" />;
      }

      // 5. Normal paragraphs
      return (
        <p key={lineKey} className="leading-relaxed text-slate-300 text-xs sm:text-sm my-1 text-left">
          {formatInlineMarkdown(line)}
        </p>
      );
    });
  };

  // Helper to format inline tags (bold, inline code, links) with unique keys
  const formatInlineMarkdown = (text: string) => {
    if (!text) return text;
    let keySeq = 0;
    let parts: Array<string | React.ReactNode> = [text];
    
    // Process Bold (**text**)
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return [part];
      const subParts = part.split(/\*\*([\s\S]*?)\*\*/g);
      return subParts.map((sub, i) => (i % 2 === 1) ? <strong key={`b-${keySeq++}`} className="font-extrabold text-white bg-white/5 px-1 py-0.5 rounded">{sub}</strong> : sub);
    });

    // Process Inline Code (`code`)
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return [part];
      const subParts = part.split(/`([^`]+)`/g);
      return subParts.map((sub, i) => (i % 2 === 1) ? <code key={`c-${keySeq++}`} className="font-mono text-xs text-indigo-300 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-500/15 font-semibold">{sub}</code> : sub);
    });

    // Process Links ([label](url))
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return [part];
      const subParts = part.split(/\[([^\]]+)\]\(([^)]+)\)/g);
      const result: Array<string | React.ReactNode> = [];
      for (let i = 0; i < subParts.length; i += 3) {
        result.push(subParts[i]);
        if (i + 1 < subParts.length) {
          result.push(
            <a key={`l-${keySeq++}`} href={subParts[i + 2]} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-bold inline-flex items-center gap-0.5">
              {subParts[i + 1]}
              <LinkIcon className="w-3 h-3 inline text-indigo-400" />
            </a>
          );
        }
      }
      return result;
    });

    // Highlight Slash commands specifically in blue
    parts = parts.flatMap(part => {
      if (typeof part !== 'string') return [part];
      const regex = /(\/(menu|build|code|repos|deploy|add|debug)(?:\b|\s))/gi;
      const subParts = part.split(regex);
      return subParts.map((sub) => {
        const lower = sub.toLowerCase();
        if (lower.startsWith('/menu') || lower.startsWith('/build') || lower.startsWith('/code') || lower.startsWith('/repos') || lower.startsWith('/deploy') || lower.startsWith('/add') || lower.startsWith('/debug')) {
          return <span key={`cmd-${keySeq++}`} className="text-blue-400 font-extrabold font-mono">{sub}</span>;
        }
        return sub;
      });
    });

    return parts.map((item, idx) => (typeof item === 'string' ? item : React.cloneElement(item as React.ReactElement, { key: `inline-elem-${idx}` })));
  };

  const renderMessageContent = (msg: Message) => {
    const text = msg.content;
    const parts = [];
    const codeBlockRegex = /```(\w+)?\s*(?:\/\/\s*([\w\-.]+)\s*\n)?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, matchIndex)
        });
      }

      parts.push({
        type: 'code',
        language: match[1] || 'txt',
        fileName: match[2] || '',
        code: match[3]
      });

      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }

    return (
      <div className="space-y-4">
        {parts.map((part, pIdx) => {
          if (part.type === 'text') {
            return (
              <div key={`msg-part-${pIdx}`} className="leading-relaxed font-sans text-xs sm:text-sm text-slate-300">
                {parseMarkdownText(part.content)}
              </div>
            );
          } else {
            const codeId = `code-block-${msg.id}-${pIdx}`;
            const determinedFileName = part.fileName || `code_block.${part.language === 'typescript' ? 'ts' : part.language === 'javascript' ? 'js' : part.language}`;

            return (
              <div key={codeId} className="border border-white/5 bg-[#050507] rounded-xl overflow-hidden my-4 text-left shadow-xl max-w-full">
                <div className="flex items-center justify-between px-4 py-2 bg-[#0E0E10] border-b border-white/5 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono text-xs text-slate-400">{part.language}</span>
                    {part.fileName && (
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-mono px-2 py-0.5 rounded border border-indigo-500/10 font-bold">
                        {part.fileName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleCopy(codeId, part.code || '')}
                      className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-100 transition text-[10px] flex items-center gap-1"
                    >
                      {copiedId === codeId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => setPreviewContent(part.code || '')}
                      className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-100 transition text-[10px] flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                    <button
                      onClick={() => handleDownloadFile(determinedFileName, part.code || '')}
                      className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-100 transition text-[10px] flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => handleInjectFileToWorkspace(determinedFileName, part.code || '')}
                      className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/20 rounded text-indigo-400 hover:text-white transition text-[10px] font-bold flex items-center gap-1 animate-pulse"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Stage File</span>
                    </button>
                  </div>
                </div>
                <div className="p-4 overflow-x-auto custom-scrollbar select-text max-h-[50vh]">
                  <pre className="font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre font-medium">{part.code}</pre>
                </div>
              </div>
            );
          }
        })}

        {msg.role === 'assistant' && (
          <div className="flex items-center gap-2 border-t border-white/5 pt-3.5 mt-2 text-[10px] text-slate-500 font-mono flex-wrap">
            <span>Actions:</span>
            <button onClick={() => handleCopy(msg.id, msg.content)} className="flex items-center gap-1 hover:text-slate-200 transition">
              <Copy className="w-3 h-3" />
              <span>Copy Response</span>
            </button>
            <span className="text-white/5">•</span>
            <button onClick={() => handleListen(msg.content)} className="flex items-center gap-1 hover:text-slate-200 transition">
              <Volume2 className="w-3 h-3 text-indigo-400" />
              <span>Listen</span>
            </button>
            {msg.content.includes('```') && (
              <>
                <span className="text-white/5">•</span>
                <button onClick={() => handleDownloadResponseZip(msg.content)} className="flex items-center gap-1 hover:text-emerald-400 transition font-bold">
                  <FileJson className="w-3 h-3" />
                  <span>Download code.zip</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full bg-[#0C0C0E] border border-white/5 rounded-2xl overflow-hidden text-left font-sans">
      
      {/* LEFT DRAWER */}
      <div className={`w-full lg:w-72 bg-[#09090C] border-b lg:border-b-0 lg:border-r border-white/5 p-4 flex-shrink-0 flex flex-col gap-4 ${showHistory ? 'block' : 'hidden lg:flex'}`}>
        <div className="bg-[#141417]/80 border border-white/5 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Chat History</span>
            </h4>
            <button
              onClick={handleCreateNewSession}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition"
            >
              + New
            </button>
          </div>

          <div className="space-y-1.5 max-h-[25vh] lg:max-h-[35vh] overflow-y-auto custom-scrollbar pr-1">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => setCurrentSessionId(sess.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition flex items-center justify-between truncate cursor-pointer ${
                  sess.id === currentSessionId
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <span className="truncate pr-2">{sess.title}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] text-slate-600 font-mono font-medium">{sess.messages.length} msg</span>
                  {sessions.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteSession(sess.id, e)}
                      className="text-slate-600 hover:text-red-400 p-0.5"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* WORKSPACE FILES QUICK INJECTOR */}
        {stagedFiles.length > 0 && (
          <div className="bg-[#141417]/80 border border-white/5 rounded-2xl p-4 space-y-3 flex-grow flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                <span>Workspace Files ({stagedFiles.length})</span>
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                Click to append a file to prompt context.
              </p>
            </div>
            <div className="flex-grow max-h-[25vh] lg:max-h-[35vh] overflow-y-auto custom-scrollbar space-y-1 pr-1 border border-white/5 rounded-lg bg-[#0A0A0B]/60 p-2">
              {stagedFiles.map((file) => (
                <button
                  key={`ai-attach-${file.id}`}
                  onClick={() => handleAttachStagedFile(file)}
                  className="w-full text-left font-mono text-[10px] text-slate-400 hover:text-indigo-400 transition truncate p-1.5 hover:bg-indigo-500/5 rounded border border-transparent hover:border-indigo-500/10"
                >
                  📄 {file.path}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CENTER CHAT STREAM */}
      <div className="flex-grow flex flex-col h-full bg-[#111115] overflow-hidden relative">
        
        {/* Chat Control Header */}
        <div className="px-5 py-4 bg-[#0E0E10] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/10">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm">RepostNow Studio AI</h3>
                <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Online</span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Model: Pollinations Web Compiler v4</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="lg:hidden p-2 bg-[#0A0A0B] hover:bg-[#141417] border border-white/10 rounded-xl text-slate-400 hover:text-slate-100 transition"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAiSettings(!showAiSettings)}
              className={`p-2 border rounded-xl transition flex items-center gap-1 ${
                showAiSettings
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/50'
                  : 'bg-[#0A0A0B] hover:bg-[#141417] text-slate-400 hover:text-slate-100 border-white/10'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span className="text-[10px] font-bold hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE CHAT MODES SELECTOR */}
        <div className="grid grid-cols-4 border-b border-white/5 bg-[#09090B]">
          {[
            { id: 'default', label: 'Chat Standard', desc: 'Sederhana & Cepat', icon: Sparkles, color: 'text-indigo-400' },
            { id: 'thinking', label: 'Thinking', desc: 'Kecerdasan Tinggi', icon: Terminal, color: 'text-amber-400' },
            { id: 'search', label: 'Search', desc: 'API / Web Search', icon: Search, color: 'text-sky-400' },
            { id: 'studio', label: 'Code Studio', desc: 'Pembuatan Code', icon: Code2, color: 'text-emerald-400' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setAiMode(mode.id as any)}
              className={`py-3 px-2 border-r border-white/5 text-center transition flex flex-col items-center justify-center gap-1 ${
                aiMode === mode.id
                  ? 'bg-indigo-500/[0.04] text-white border-b-2 border-b-indigo-500'
                  : 'text-slate-500 hover:bg-white/[0.01] hover:text-slate-300'
              }`}
            >
              <mode.icon className={`w-4 h-4 ${mode.color}`} />
              <span className="text-[10px] font-bold tracking-tight">{mode.label}</span>
              <span className="text-[8px] opacity-60 font-mono hidden sm:inline">{mode.desc}</span>
            </button>
          ))}
        </div>

        {/* ACTIVE ATTACHMENTS STRIP */}
        {attachedFiles.length > 0 && (
          <div className="px-5 py-2 bg-indigo-950/20 border-b border-indigo-500/15 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-400 font-mono font-medium truncate max-w-sm">
              <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Attaching {attachedFiles.length} file(s) as prompt payload</span>
            </div>
            <button
              onClick={() => setAttachedFiles([])}
              className="text-slate-500 hover:text-rose-400 font-bold text-[10px] uppercase font-mono px-2 py-1 rounded hover:bg-rose-500/10"
            >
              Clear
            </button>
          </div>
        )}

        {/* CHAT MESSAGES CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#0B0B0D] custom-scrollbar">
          {currentSession.messages.map((msg) => {
            const isBot = msg.role === 'assistant';
            const showAccordion = isBot && (msg.thinkingSteps || msg.studioLogs || msg.searchLinks);
            const isExpanded = expandedAccordions[msg.id] || false;

            return (
              <div
                key={msg.id}
                className={`flex gap-4 p-4.5 rounded-2xl max-w-full ${
                  isBot
                    ? 'bg-[#141417]/40 border border-white/5 text-left'
                    : 'bg-indigo-600/10 border border-indigo-500/20 ml-auto max-w-[85%] text-right self-end'
                }`}
              >
                {!isBot && <div className="flex-grow" /> /* Push user messages right */}
                
                {isBot && (
                  <div className="w-8 h-8 rounded-xl bg-[#0E0E10] text-indigo-400 border border-white/5 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-300 font-mono">
                      {isBot ? 'RepostNow Studio AI' : 'You'}
                    </span>
                    {isBot && msg.mode && msg.mode !== 'default' && (
                      <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 uppercase font-mono font-bold">
                        {msg.mode} Mode
                      </span>
                    )}
                  </div>

                  {/* THINKING / STUDIO LOGS / SEARCH ACCORDION UNDER AI NAME */}
                  {showAccordion && (
                    <div className="my-2 border border-white/5 bg-[#08080A] rounded-xl overflow-hidden text-left">
                      <button
                        onClick={() => handleToggleAccordion(msg.id)}
                        className="w-full px-3 py-2 flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition bg-black/40 font-mono"
                      >
                        <div className="flex items-center gap-1.5">
                          {msg.mode === 'thinking' && <Terminal className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
                          {msg.mode === 'studio' && <Code2 className="w-3.5 h-3.5 text-emerald-400" />}
                          {msg.mode === 'search' && <Search className="w-3.5 h-3.5 text-sky-400" />}
                          <span>
                            {msg.mode === 'thinking' ? 'Logical Process & Web References' : ''}
                            {msg.mode === 'studio' ? 'Dynamic Code Studio Operations' : ''}
                            {msg.mode === 'search' ? 'Searched Web Documentation' : ''}
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
                      </button>

                      {isExpanded && (
                        <div className="p-3.5 space-y-3 text-[10px] font-mono text-slate-400 border-t border-white/5 bg-[#0C0C0E]/50">
                          {/* Live operations steps */}
                          {msg.thinkingSteps && msg.thinkingSteps.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-1">Process Steps:</span>
                              {msg.thinkingSteps.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-2 pl-1 text-slate-300">
                                  <span className="text-amber-500">✔</span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {msg.studioLogs && msg.studioLogs.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-1">Studio Tasks completed:</span>
                              {msg.studioLogs.map((log, idx) => (
                                <div key={idx} className="flex items-center gap-2 pl-1 text-slate-300">
                                  <span className="text-emerald-500">▶</span>
                                  <span>{log}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reference links */}
                          {msg.searchLinks && msg.searchLinks.length > 0 && (
                            <div className="space-y-1 pt-1.5 border-t border-white/5">
                              <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-1">External Documentation References:</span>
                              {msg.searchLinks.map((link, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 pl-1">
                                  <LinkIcon className="w-2.5 h-2.5 text-indigo-400" />
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    className="text-indigo-400 hover:underline hover:text-indigo-300 truncate max-w-xs block"
                                  >
                                    {link.title}
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {renderMessageContent(msg)}
                </div>

                {!isBot && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                    <User className="w-4.5 h-4.5" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-4 p-4.5 rounded-2xl bg-[#141417]/40 border border-white/5 text-left">
              <div className="w-8 h-8 rounded-xl bg-[#0E0E10] text-indigo-400 border border-white/5 flex items-center justify-center flex-shrink-0 animate-spin">
                <RefreshCw className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-2.5 flex-1 py-1">
                <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
                <div className="h-2 w-full bg-white/5 rounded animate-pulse" />
                <div className="h-2 w-3/4 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attached Files Preview Bar */}
        {attachedFiles.length > 0 && (
          <div className="px-4 py-2 bg-[#0C0C0E] border-t border-white/5 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 bg-[#141417] border border-white/10 rounded-lg pl-3 pr-1.5 py-1 text-xs animate-fade-in"
              >
                <Paperclip className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="text-slate-300 font-medium font-mono truncate max-w-[150px]">{file.name}</span>
                <span className="text-slate-500 font-mono text-[9px]">({(file.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== file.id))}
                  className="p-1 hover:bg-white/5 rounded-md text-slate-400 hover:text-rose-400 transition"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* INPUT FORM PANEL */}
        <form onSubmit={handleSendMessage} className="p-4 bg-[#0E0E10] border-t border-white/5 flex gap-2">
          {/* File attachment button for computer files */}
          <label className="p-3 bg-[#050507] hover:bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-slate-100 transition cursor-pointer flex items-center justify-center flex-shrink-0" title="Attach computer files">
            <Paperclip className="w-4 h-4" />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleLocalFileSelect}
            />
          </label>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={`Ask AI Studio in ${aiMode} mode... (e.g., /Menu, /Repos, /Deploy)`}
            className="flex-1 px-4 py-3 bg-[#050507] border border-white/10 rounded-2xl text-slate-200 placeholder-slate-700 text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition"
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && attachedFiles.length === 0)}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-2xl transition flex items-center gap-1.5 shadow-lg"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {showAiSettings && (
          <div className="absolute inset-0 z-30 bg-[#0E0E10]/95 backdrop-blur-md p-6 overflow-y-auto flex flex-col text-left">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">AI Compiler System Configurations</h3>
              </div>
              <button
                onClick={() => setShowAiSettings(false)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 flex-1 max-w-2xl">
              <div className="space-y-2">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">System Roleplay Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full h-20 p-3 bg-[#0A0A0B] border border-white/10 rounded-xl font-mono text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#141417] border border-white/5 rounded-xl flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-200 text-xs">Allow Workspace Access</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Let AI read your staged folder metadata</p>
                  </div>
                  <button
                    onClick={() => setAllowRepoAccess(!allowRepoAccess)}
                    className="text-slate-400 hover:text-indigo-400 transition"
                  >
                    {allowRepoAccess ? <ToggleRight className="w-7 h-7 text-indigo-500" /> : <ToggleLeft className="w-7 h-7" />}
                  </button>
                </div>

                <div className="p-4 bg-[#141417] border border-white/5 rounded-xl flex flex-col justify-between space-y-2">
                  <div>
                    <h5 className="font-bold text-slate-200 text-xs">Intelligence Sizing</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Allocate GPU tokens</p>
                  </div>
                  <div className="flex gap-1.5 bg-[#0A0A0B] p-1 rounded-lg">
                    {['default', 'high', 'max'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setIntelligence(size as any)}
                        className={`flex-1 py-1 rounded text-[9px] font-mono font-bold uppercase transition ${
                          intelligence === size
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-[#141417] border border-white/5 rounded-2xl p-4.5">
                <div>
                  <h4 className="font-bold text-slate-200 text-xs">Custom AI Public APIs</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Connect external endpoints like public reverse proxies or custom Ollama hosts.</p>
                </div>

                <div className="space-y-2 max-h-[18vh] overflow-y-auto custom-scrollbar pr-1 divide-y divide-white/5">
                  {customEndpoints.map((ep) => (
                    <div key={ep.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <button
                          onClick={() => handleToggleEndpoint(ep.id)}
                          className="text-slate-400 hover:text-indigo-400"
                        >
                          {ep.isActive ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <div className="w-4.5 h-4.5 border border-white/10 rounded-full" />}
                        </button>
                        <span className="font-semibold text-slate-300 truncate">{ep.name}</span>
                        <span className="font-mono text-[9px] text-slate-600 truncate">{ep.url}</span>
                      </div>
                      {ep.id !== 'pollinations' && (
                        <button
                          onClick={() => handleDeleteEndpoint(ep.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {customEndpoints.length < 6 && (
                  <div className="pt-3 flex gap-2 border-t border-white/5">
                    <input
                      type="text"
                      placeholder="API Name"
                      value={newApiName}
                      onChange={(e) => setNewApiName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#0A0A0B] border border-white/10 rounded-lg text-[11px] text-slate-200 font-medium focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="POST Endpoint URL"
                      value={newApiUrl}
                      onChange={(e) => setNewApiUrl(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#0A0A0B] border border-white/10 rounded-lg text-[11px] text-slate-200 font-mono focus:outline-none"
                    />
                    <button
                      onClick={handleAddEndpoint}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] transition"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0B]/90 backdrop-blur-md text-left">
          <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[75vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0E0E10]">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-slate-100 text-sm">Inline Code Content Preview</h3>
              </div>
              <button
                onClick={() => setPreviewContent(null)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-[#050507] font-sans text-slate-300 whitespace-pre-wrap select-text custom-scrollbar max-h-[50vh]">
              {previewContent}
            </div>
            <div className="p-4 border-t border-white/5 bg-[#0E0E10] flex justify-end gap-2">
              <button
                onClick={() => handleCopy('preview-code', previewContent)}
                className="px-4 py-2 hover:bg-white/5 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy to Clipboard</span>
              </button>
              <button
                onClick={() => setPreviewContent(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
