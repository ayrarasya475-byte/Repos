import React, { useState, useEffect } from 'react';
import { X, Eye, File, FileText, Image, AlertCircle, Info } from 'lucide-react';
import { UploadFile } from '../types';
import { formatBytes } from './FileTree';

interface FilePreviewModalProps {
  file: UploadFile | null;
  onClose: () => void;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    let active = true;
    const loadFile = async () => {
      setLoading(true);
      setError(null);
      setContent('');
      setImageUrl('');

      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(file.name);
      const isText = file.type.startsWith('text/') || 
                     file.name.endsWith('.md') ||
                     file.name.endsWith('.json') ||
                     /\.(txt|md|js|jsx|ts|tsx|json|css|html|xml|yaml|yml|sh|py|ini|conf|gitignore|env|example)$/i.test(file.name);

      try {
        if (isImage) {
          const url = URL.createObjectURL(file.file);
          if (active) setImageUrl(url);
        } else if (isText) {
          // Read first 50KB to avoid freezing browser on massive files
          const slice = file.file.slice(0, 50 * 1024);
          const text = await slice.text();
          let displayText = text;
          if (file.file.size > 50 * 1024) {
            displayText += '\n\n... [Content truncated, file exceeds 50KB] ...';
          }
          if (active) setContent(displayText);
        }
      } catch (err) {
        console.error('Failed to preview file:', err);
        if (active) setError('Failed to read file content.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFile();

    return () => {
      active = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [file]);

  if (!file) return null;

  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(file.name);
  const isText = file.type.startsWith('text/') || 
                 file.name.endsWith('.md') ||
                 file.name.endsWith('.json') ||
                 /\.(txt|md|js|jsx|ts|tsx|json|css|html|xml|yaml|yml|sh|py|ini|conf|gitignore|env|example)$/i.test(file.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A0B]/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#0E0E10]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              {isImage ? <Image className="w-5 h-5" /> : isText ? <FileText className="w-5 h-5" /> : <File className="w-5 h-5" />}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-100 text-sm truncate max-w-[280px] sm:max-w-md font-mono" title={file.path}>
                {file.name}
              </h3>
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

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#0A0A0B]/50 custom-scrollbar flex flex-col min-h-[250px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-slate-400">Reading file content...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-rose-400 gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : isImage && imageUrl ? (
            <div className="flex-1 flex items-center justify-center p-2 bg-[#0A0A0B] rounded-xl border border-white/5 overflow-hidden">
              <img
                src={imageUrl}
                alt={file.name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[50vh] object-contain rounded shadow-lg"
              />
            </div>
          ) : isText ? (
            <div className="flex-1 flex flex-col">
              <pre className="font-mono text-[11px] text-slate-300 p-4 bg-[#0A0A0B] border border-white/5 rounded-xl whitespace-pre-wrap overflow-x-auto select-text custom-scrollbar max-h-[55vh]">
                {content || <span className="text-slate-600 italic">[Empty File]</span>}
              </pre>
            </div>
          ) : (
            /* Binary / unsupported preview types */
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-[#141417] border border-white/5 rounded-2xl mb-4 text-slate-400">
                <Info className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
                <p className="font-semibold text-slate-200 text-sm mb-1">Preview Not Available</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  We cannot display previews for this file type directly in the browser.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-left bg-[#0A0A0B] border border-white/5 p-4 rounded-xl text-xs font-mono w-full max-w-sm">
                <span className="text-slate-500">Name:</span>
                <span className="text-slate-300 truncate">{file.name}</span>
                <span className="text-slate-500">Size:</span>
                <span className="text-slate-300">{formatBytes(file.size)}</span>
                <span className="text-slate-500">Type:</span>
                <span className="text-slate-300 truncate">{file.type || 'Unknown'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0E0E10] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
