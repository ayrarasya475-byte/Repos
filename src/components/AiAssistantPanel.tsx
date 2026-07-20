import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Bot, User, Trash2, Copy, Eye, Volume2, Download, RefreshCw,
  Sliders, Key, ToggleLeft, ToggleRight, Check, History, Paperclip, Search,
  Terminal, Code2, AlertCircle, Play, FileJson, Layers, Laptop, X
} from 'lucide-react';
import { UploadFile } from '../types';
import JSZip from 'jszip';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'thinking' | 'search' | 'studio' | 'default';
  isCode?: boolean;
  codeLanguage?: string;
  fileName?: string;
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
}

export default function AiAssistantPanel({
  stagedFiles,
  onUpdateStagedFiles
}: AiAssistantPanelProps) {
  // Navigation & Drawer states
  const [showHistory, setShowHistory] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);

  // Chat settings
  const [systemPrompt, setSystemPrompt] = useState('You are an expert full-stack developer in RepostNow Code Studio. Write elegant, production-ready code with detailed comments.');
  const [allowRepoAccess, setAllowRepoAccess] = useState(true);
  const [intelligence, setIntelligence] = useState<'default' | 'high' | 'max'>('high');

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
            content: 'Hello! I am your **RepostNow Code Studio AI Assistant**.\n\nI am fully connected to your workspace. You can ask me to write code, debug issues, or modify your repository.\n\nChoose your workflow mode above:\n- **Thinking**: In-depth logical analysis powered by web-search references.\n- **Search**: Scours online trends and APIs to get accurate documentation.\n- **Code Studio**: Unleashes max reasoning to write files and debug systems directly.',
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

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  // Text-To-Speech
  const handleListen = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Your browser does not support text-to-speech.');
      return;
    }
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    // Strip markdown code blocks/symbols for clearer speech
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
      // Remove previous matching file path if any
      const filtered = prev.filter(f => f.path !== fileName);
      return [...filtered, newUploadFile];
    });

    alert(`File "${fileName}" has been created/updated and staged in your workspace!`);
  };

  // Add custom public endpoint
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
      // Ensure at least one is active
      if (filtered.length > 0 && !filtered.some(e => e.isActive)) {
        filtered[0].isActive = true;
      }
      return filtered;
    });
  };

  // Send message to Pollinations/API
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;

    setLoading(true);
    const userPrompt = input;
    setInput('');

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

    const newUserMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userPrompt + (attachedFiles.length > 0 ? ` (with ${attachedFiles.length} attachments)` : ''),
      mode: aiMode
    };

    // Update session instantly
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

    setAttachedFiles([]); // Clear attachments

    // Call API
    try {
      const activeEp = customEndpoints.find(ep => ep.isActive) || customEndpoints[0];
      const modelParam = intelligence === 'max' ? 'claude' : intelligence === 'high' ? 'openai' : 'mistral';
      
      const payloadMessages = [
        { role: 'system', content: systemPrompt },
        ...currentSession.messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: finalPrompt }
      ];

      const response = await fetch(activeEp.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: payloadMessages,
          model: modelParam,
          temperature: aiMode === 'studio' ? 0.2 : 0.7
        })
      });

      let responseText = '';
      if (response.ok) {
        responseText = await response.text();
      } else {
        // Fallback to GET for simple pollinations text retrieval if POST fails
        const encoded = encodeURIComponent(finalPrompt);
        const fallbackRes = await fetch(`https://text.pollinations.ai/${encoded}?system=${encodeURIComponent(systemPrompt)}&model=${modelParam}`);
        if (fallbackRes.ok) {
          responseText = await fallbackRes.text();
        } else {
          throw new Error('All code-studio compilation endpoints timed out. Please check network routing.');
        }
      }

      const newAssistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText,
        mode: aiMode
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
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ **API Connection Error:** ${err.message || 'Failed to communicate with the Pollinations compiler.'}\n\nPlease check your Custom AI endpoints configuration or use standard Thinking Mode.`
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

  // Create new session
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

  // Add workspace staged files as chat attachment
  const handleAttachStagedFile = (file: UploadFile) => {
    setAttachedFiles(prev => {
      if (prev.some(f => f.id === file.id)) return prev;
      return [...prev, file];
    });
  };

  // Render markdown code parser in custom boxes with Copy & Install buttons
  const renderMessageContent = (msg: Message) => {
    const text = msg.content;
    const parts = [];
    const codeBlockRegex = /```(\w+)?\s*(?:\/\/\s*([\w\-.]+)\s*\n)?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      // Plain text before code block
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
              <div key={`msg-part-${pIdx}`} className="leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-300">
                {part.content}
              </div>
            );
          } else {
            const codeId = `code-block-${msg.id}-${pIdx}`;
            const determinedFileName = part.fileName || `code_block.${part.language === 'typescript' ? 'ts' : part.language === 'javascript' ? 'js' : part.language}`;

            return (
              <div key={codeId} className="border border-white/5 bg-[#050507] rounded-xl overflow-hidden my-4 text-left shadow-xl max-w-full">
                {/* Header bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#0E0E10] border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono text-xs text-slate-400">{part.language}</span>
                    {part.fileName && (
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-mono px-2 py-0.5 rounded border border-indigo-500/10 font-bold">
                        {part.fileName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopy(codeId, part.code || '')}
                      className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-100 transition text-[10px] flex items-center gap-1"
                      title="Copy code"
                    >
                      {copiedId === codeId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === codeId ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => setPreviewContent(part.code || '')}
                      className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-100 transition text-[10px] flex items-center gap-1"
                      title="Preview rendering"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Preview</span>
                    </button>
                    <button
                      onClick={() => handleDownloadFile(determinedFileName, part.code || '')}
                      className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-slate-100 transition text-[10px] flex items-center gap-1"
                      title="Download as File"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => handleInjectFileToWorkspace(determinedFileName, part.code || '')}
                      className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/20 rounded text-indigo-400 hover:text-white transition text-[10px] font-bold flex items-center gap-1"
                      title="Create file in your RepostNow workspace"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Stage File</span>
                    </button>
                  </div>
                </div>
                {/* Monospaced Body */}
                <div className="p-4 overflow-x-auto custom-scrollbar select-text max-h-[50vh]">
                  <pre className="font-mono text-[11px] text-slate-300 leading-relaxed whitespace-pre font-medium">{part.code}</pre>
                </div>
              </div>
            );
          }
        })}

        {/* Text Actions */}
        {msg.role === 'assistant' && (
          <div className="flex items-center gap-2 border-t border-white/5 pt-3.5 mt-2 text-[10px] text-slate-500 font-mono">
            <span>Actions:</span>
            <button
              onClick={() => handleCopy(msg.id, msg.content)}
              className="flex items-center gap-1 hover:text-slate-200 transition"
            >
              <Copy className="w-3 h-3" />
              <span>Copy Response</span>
            </button>
            <span className="text-white/5">•</span>
            <button
              onClick={() => handleListen(msg.content)}
              className="flex items-center gap-1 hover:text-slate-200 transition"
            >
              <Volume2 className="w-3 h-3 text-indigo-400" />
              <span>Listen</span>
            </button>
            {msg.content.includes('```') && (
              <>
                <span className="text-white/5">•</span>
                <button
                  onClick={() => handleDownloadResponseZip(msg.content)}
                  className="flex items-center gap-1 hover:text-emerald-400 transition font-bold"
                >
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
      
      {/* LEFT DRAWER (HISTORY) OR CONFIG OVERLAYS */}
      <div className={`w-full lg:w-72 bg-[#09090C] border-b lg:border-b-0 lg:border-r border-white/5 p-4 flex-shrink-0 flex flex-col gap-4 ${showHistory ? 'block' : 'hidden lg:block'}`}>
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
              <button
                key={sess.id}
                onClick={() => setCurrentSessionId(sess.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition flex items-center justify-between truncate ${
                  sess.id === currentSessionId
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <span className="truncate pr-2">{sess.title}</span>
                <span className="text-[9px] text-slate-600 font-mono font-medium">
                  {sess.messages.length} msg
                </span>
              </button>
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
                Click any file path to attach it to the AI prompt context directly.
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
              title="Show Sessions"
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
              title="Configure AI Parameters"
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
          <div className="px-5 py-2 bg-indigo-950/20 border-b border-indigo-500/15 flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-2 text-indigo-400 font-mono font-medium truncate max-w-sm">
              <Paperclip className="w-3.5 h-3.5 flex-shrink-0 animate-bounce" />
              <span>Staged in Prompt: {attachedFiles.map(f => f.name).join(', ')}</span>
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
            return (
              <div
                key={msg.id}
                className={`flex gap-4 p-4.5 rounded-2xl ${
                  isBot
                    ? 'bg-[#141417]/40 border border-white/5 text-left'
                    : 'bg-indigo-600/5 border border-indigo-500/10 text-left'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                  isBot
                    ? 'bg-[#0E0E10] text-indigo-400 border-white/5'
                    : 'bg-indigo-600 text-white border-indigo-500/30'
                }`}>
                  {isBot ? <Bot className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Mode badge */}
                  {msg.mode && msg.mode !== 'default' && (
                    <div className="mb-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 uppercase font-semibold border border-white/5">
                      {msg.mode} Mode
                    </div>
                  )}
                  {renderMessageContent(msg)}
                </div>
              </div>
            );
          })}

          {/* AI COMPILER LOADING STATE */}
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

        {/* INPUT FORM PANEL */}
        <form onSubmit={handleSendMessage} className="p-4 bg-[#0E0E10] border-t border-white/5 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={`Ask AI Studio in ${aiMode} mode... (e.g. "Create a package.json file")`}
            className="flex-1 px-4.5 py-3.5 bg-[#050507] border border-white/10 rounded-2xl text-slate-200 placeholder-slate-700 text-xs sm:text-sm font-medium focus:outline-none focus:border-indigo-500/50 transition"
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && attachedFiles.length === 0)}
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-2xl transition flex items-center gap-1.5 shadow-lg hover:shadow-indigo-500/15"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {/* AI CONFIGURATION SETTINGS MODAL LAYER */}
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
              {/* Prompt customization */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">System Roleplay Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full h-20 p-3 bg-[#0A0A0B] border border-white/10 rounded-xl font-mono text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="System rules..."
                />
              </div>

              {/* Toggles */}
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

              {/* Endpoint configurations */}
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
                      placeholder="API Name (e.g. Local Llama)"
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

      {/* CODE PREVIEW POPUP OVERLAY */}
      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0B]/90 backdrop-blur-md animate-fade-in text-left">
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
