import React, { useState, useEffect } from 'react';
import { X, Save, FileCode, AlertCircle, Sparkles } from 'lucide-react';
import { UploadFile } from '../types';
import { formatBytes } from './FileTree';

interface CodeEditorModalProps {
  file: UploadFile | null;
  onClose: () => void;
  onSave: (fileId: string, newContent: string) => void;
}

export default function CodeEditorModal({ file, onClose, onSave }: CodeEditorModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    const readFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const text = await file.file.text();
        setContent(text);
      } catch (err: any) {
        console.error('Failed to read file content for editing:', err);
        setError('Failed to load text content of this file.');
      } finally {
        setLoading(false);
      }
    };

    readFile();
  }, [file]);

  if (!file) return null;

  const handleSaveClick = () => {
    onSave(file.id, content);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0B]/90 backdrop-blur-md animate-fade-in text-left">
      <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0E0E10]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm font-mono truncate max-w-[200px] sm:max-w-md">
                  {file.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-mono border border-indigo-500/10">
                  Editing
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Path: <span className="text-indigo-400">{file.path}</span> • {formatBytes(file.size)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editor Body */}
        <div className="flex-1 flex flex-col bg-[#08080A]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-slate-400">Loading editor environment...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-rose-400 gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-4 relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full p-4 bg-[#050507] text-slate-200 border border-white/5 rounded-xl font-mono text-xs focus:outline-none focus:border-indigo-500/40 resize-none leading-relaxed select-text custom-scrollbar focus:ring-0"
                placeholder="Write your code here..."
                spellCheck={false}
              />
              <div className="absolute bottom-6 right-6 flex items-center gap-2 pointer-events-none select-none text-[10px] text-slate-500 font-mono bg-[#0E0E10]/90 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Live Workspace Compiler Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0E0E10] flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-mono">
            All edits are staged immediately inside your RepostNow session.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 hover:bg-white/5 text-slate-300 text-xs font-bold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/10"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save & Stage Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
