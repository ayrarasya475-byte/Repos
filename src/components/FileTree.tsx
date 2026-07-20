import React, { useState } from 'react';
import { FileCode, Search, Trash2, X, ShieldAlert, CheckCircle, RefreshCw, Eye, Edit2 } from 'lucide-react';
import { UploadFile } from '../types';
import FilePreviewModal from './FilePreviewModal';

interface FileTreeProps {
  files: UploadFile[];
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  disabled: boolean;
  onEditFile?: (file: UploadFile) => void;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function FileTree({
  files,
  onRemoveFile,
  onClearAll,
  disabled,
  onEditFile,
}: FileTreeProps) {
  const [search, setSearch] = useState('');
  const [previewFile, setPreviewFile] = useState<UploadFile | null>(null);

  const filteredFiles = files.filter((file) =>
    file.path.toLowerCase().includes(search.toLowerCase())
  );

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  if (files.length === 0) return null;

  return (
    <div className="bg-[#141417] border border-white/5 rounded-2xl p-6 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <h3 className="font-semibold text-slate-100 text-lg flex items-center gap-2">
            <span>Staged Files</span>
            <span className="px-2 py-0.5 text-xs bg-indigo-500/10 border border-white/5 text-indigo-400 font-bold rounded-full">
              {files.length}
            </span>
          </h3>
          <p className="text-slate-400 text-sm">
            Total size: <strong className="text-slate-300 font-medium">{formatBytes(totalSize)}</strong>
          </p>
        </div>

        <button
          onClick={onClearAll}
          disabled={disabled}
          className="flex items-center gap-1 px-3.5 py-1.5 bg-[#0A0A0B] hover:bg-[#141417] disabled:opacity-40 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/20 rounded-xl text-xs font-semibold transition duration-200 self-start sm:self-center"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
        <input
          type="text"
          placeholder="Filter staged files by path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500/50 text-xs font-mono transition placeholder-slate-700"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* File List Table */}
      <div className="border border-white/10 bg-[#0A0A0B] rounded-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#141417] border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="px-4 py-3">File Path</th>
              <th className="px-4 py-3 text-right">Size</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-medium">
                  No files match search filter
                </td>
              </tr>
            ) : (
              filteredFiles.map((file, index) => (
                <tr key={`tree-file-${file.id || file.path || index}`} className="hover:bg-[#141417]/40 transition">
                  <td className="px-4 py-2.5 font-mono text-slate-300 max-w-xs sm:max-w-md truncate flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400/80 flex-shrink-0" />
                    <span title={file.path}>{file.path}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                    {formatBytes(file.size)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {file.status === 'pending' && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold border border-white/5">
                        Staged
                      </span>
                    )}
                    {file.status === 'uploading' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[10px] font-semibold border border-sky-500/20">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        <span>Uploading</span>
                      </span>
                    )}
                    {file.status === 'success' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20">
                        <CheckCircle className="w-2.5 h-2.5" />
                        <span>Uploaded</span>
                      </span>
                    )}
                    {file.status === 'error' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-semibold border border-rose-500/20" title={file.error}>
                        <ShieldAlert className="w-2.5 h-2.5" />
                        <span>Error</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="p-1.5 hover:bg-indigo-500/15 text-slate-400 hover:text-indigo-400 rounded-lg transition duration-150"
                        title="Preview file content"
                        type="button"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {onEditFile && !disabled && (
                        <button
                          onClick={() => onEditFile(file)}
                          className="p-1.5 hover:bg-amber-500/15 text-slate-400 hover:text-amber-400 rounded-lg transition duration-150"
                          title="Edit file inline"
                          type="button"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!disabled && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove ${file.name} from staged files?`)) {
                              onRemoveFile(file.id);
                            }
                          }}
                          className="p-1.5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 rounded-lg transition duration-150"
                          title="Remove file"
                          type="button"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
