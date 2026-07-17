import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Terminal, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Layers, GitCommit, GitBranch, ArrowRight } from 'lucide-react';
import { UploadSession } from '../types';

interface UploadProgressPanelProps {
  session: UploadSession;
  owner: string;
  repoName: string;
  branch: string;
  onReset: () => void;
}

export default function UploadProgressPanel({
  session,
  owner,
  repoName,
  branch,
  onReset,
}: UploadProgressPanelProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Append logs based on session status changes
  useEffect(() => {
    const timestamp = () => new Date().toLocaleTimeString();
    
    switch (session.status) {
      case 'preparing':
        setLogs([
          `[${timestamp()}] [REPOSTNOW] Initializing Git upload session`,
          `[${timestamp()}] [GITHUB] Checking repository: ${owner}/${repoName}`,
          `[${timestamp()}] [GITHUB] Verifying branch ref: refs/heads/${branch}`,
        ]);
        break;
      case 'uploading_blobs':
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] [GIT] Creating file blobs on GitHub database API...`,
        ]);
        break;
      case 'creating_tree':
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] [GIT] Assembling directory tree with uploaded blobs...`,
        ]);
        break;
      case 'creating_commit':
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] [GIT] Generating new Git commit pointing to new tree...`,
        ]);
        break;
      case 'updating_ref':
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] [GIT] Updating ref: refs/heads/${branch} to point to new commit...`,
        ]);
        break;
      case 'success':
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] [SYSTEM] Push operation completed successfully! ✨`,
          `[${timestamp()}] [SYSTEM] Repository is live at https://github.com/${owner}/${repoName}`,
        ]);
        break;
      case 'error':
        setLogs((prev) => [
          ...prev,
          `[${timestamp()}] [ERROR] Upload failed: ${session.error || 'Unknown error'}`,
        ]);
        break;
    }
  }, [session.status, session.error]);

  // Log active file uploading updates
  useEffect(() => {
    if (session.status === 'uploading_blobs' && session.currentFileIndex >= 0 && session.totalFiles > 0) {
      const timestamp = () => new Date().toLocaleTimeString();
      setLogs((prev) => [
        ...prev,
        `[${timestamp()}] [BLOB] Uploading file [${session.currentFileIndex + 1}/${session.totalFiles}]`,
      ]);
    }
  }, [session.currentFileIndex]);

  // Auto scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getStatusMessage = () => {
    switch (session.status) {
      case 'preparing':
        return 'Analyzing repository & verifying git references...';
      case 'uploading_blobs':
        return `Uploading file blobs (${session.currentFileIndex + 1}/${session.totalFiles})...`;
      case 'creating_tree':
        return 'Structuring directories and assembly mapping...';
      case 'creating_commit':
        return 'Forging and authoring Git commit...';
      case 'updating_ref':
        return `Publishing commit to branch "${branch}"...`;
      case 'success':
        return 'Push Complete! Repository uploaded successfully.';
      case 'error':
        return 'Upload halted due to an error.';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    switch (session.status) {
      case 'success':
        return <CheckCircle2 className="w-12 h-12 text-indigo-400" />;
      case 'error':
        return <AlertTriangle className="w-12 h-12 text-rose-400" />;
      case 'uploading_blobs':
        return <Layers className="w-12 h-12 text-indigo-400 animate-pulse" />;
      case 'creating_commit':
        return <GitCommit className="w-12 h-12 text-indigo-400 animate-bounce" />;
      default:
        return <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin" />;
    }
  };

  const repoUrl = `https://github.com/${owner}/${repoName}`;

  return (
    <div className="bg-[#141417] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col items-center text-center py-4">
        <div className="mb-4">
          {getStatusIcon()}
        </div>
        <h3 className="text-xl font-bold text-slate-100">
          {session.status === 'success' ? 'Upload Successful!' : session.status === 'error' ? 'Upload Failed' : 'Pushing Repository to GitHub'}
        </h3>
        <p className="text-sm text-slate-400 mt-1 max-w-md">
          {getStatusMessage()}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Overall Progress</span>
          <span className="font-semibold text-indigo-400">{session.progress}%</span>
        </div>
        <div className="w-full bg-[#0A0A0B] rounded-full h-3.5 p-0.5 border border-white/5 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              session.status === 'error'
                ? 'bg-rose-500'
                : 'bg-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${session.progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Interactive Logs Terminal */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Process Logs</span>
          </span>
          <span className="font-mono text-slate-500">v1.0.0</span>
        </div>
        
        <div className="bg-[#0A0A0B] border border-white/10 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-1.5 h-44 overflow-y-auto custom-scrollbar shadow-inner">
          {logs.map((log, index) => {
            let colorClass = 'text-slate-300';
            if (log.includes('[ERROR]')) colorClass = 'text-rose-400 font-bold';
            if (log.includes('[SYSTEM]') || log.includes('successfully')) colorClass = 'text-indigo-400 font-bold';
            if (log.includes('[GITHUB]')) colorClass = 'text-sky-400';
            if (log.includes('[GIT]')) colorClass = 'text-indigo-400';
            if (log.includes('[BLOB]')) colorClass = 'text-slate-400';

            return (
              <div key={`log-${index}`} className={`leading-relaxed break-all ${colorClass}`}>
                {log}
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Actions / Success Footer */}
      {session.status === 'success' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row gap-3 pt-2"
        >
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition duration-200"
          >
            <span>Open Repository</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onReset}
            className="flex-1 py-3 bg-[#0A0A0B] hover:bg-[#141417] text-slate-200 font-bold rounded-xl border border-white/10 transition duration-200"
          >
            Upload Another Repository
          </button>
        </motion.div>
      )}

      {session.status === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-2"
        >
          <button
            onClick={onReset}
            className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl border border-rose-500/20 transition duration-200"
          >
            Go Back & Resolve Error
          </button>
        </motion.div>
      )}
    </div>
  );
}
