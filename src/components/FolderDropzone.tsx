import React, { useState, useRef } from 'react';
import { UploadCloud, Folder, File, AlertCircle } from 'lucide-react';
import { UploadFile } from '../types';
import { getFilesFromDataTransfer, getFilesFromFileInput } from '../utils/fileTraverser';

interface FolderDropzoneProps {
  onFilesSelected: (files: UploadFile[]) => void;
  disabled: boolean;
  unpackZip: boolean;
  onToggleUnpackZip: () => void;
}

export default function FolderDropzone({ onFilesSelected, disabled, unpackZip, onToggleUnpackZip }: FolderDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    setError(null);
    try {
      if (e.dataTransfer.items) {
        const files = await getFilesFromDataTransfer(e.dataTransfer.items);
        if (files.length > 0) {
          onFilesSelected(files);
        } else {
          setError('No valid files or directories found in the selection.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred while reading the dropped folder/files.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setError(null);
    
    if (e.target.files && e.target.files.length > 0) {
      const files = getFilesFromFileInput(e.target.files);
      onFilesSelected(files);
    }
  };

  const triggerFileInput = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  const triggerFolderInput = () => {
    if (disabled) return;
    folderInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">File Import Staging</span>
        
        {/* Toggle Switch */}
        <button
          type="button"
          onClick={onToggleUnpackZip}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/5 rounded-full hover:bg-white/10 transition"
          title="Toggle whether ZIP files should be fully unpacked/extracted or kept as a raw .zip archive"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${unpackZip ? 'bg-indigo-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[10px] font-mono text-slate-400">
            ZIP handling: <strong className={unpackZip ? 'text-indigo-300' : 'text-amber-300'}>{unpackZip ? 'Unpack' : 'Keep Packed'}</strong>
          </span>
        </button>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFolderInput}
        className={`relative group border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer select-none transition duration-300 min-h-[220px] ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/5 text-indigo-400'
            : disabled
            ? 'border-white/5 bg-[#0A0A0B]/20 text-slate-600 cursor-not-allowed'
            : 'border-white/10 bg-[#141417] text-slate-400 hover:border-indigo-500/30 hover:bg-[#141417]/80'
        }`}
      >
        <div className={`p-4 rounded-full mb-4 transition duration-300 ${
          isDragActive
            ? 'bg-indigo-500/10 text-indigo-400 scale-110'
            : 'bg-[#0A0A0B] text-slate-400 group-hover:bg-[#141417] group-hover:text-slate-300 group-hover:scale-105 border border-white/5'
        }`}>
          <UploadCloud className="w-8 h-8 text-indigo-400" />
        </div>

        <h4 className="font-semibold text-slate-200 text-base mb-1.5 group-hover:text-slate-100 transition">
          {isDragActive ? 'Drop your files now!' : 'Drag & Drop a Folder or Files here'}
        </h4>
        
        <p className="text-slate-500 text-xs max-w-sm mb-5 leading-normal">
          Supports any file format. Drop an entire directory or a ZIP file to automatically extract and preserve its nested structures!
        </p>

        <div className="flex flex-wrap gap-3 justify-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={triggerFolderInput}
            disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0A0A0B] hover:bg-[#141417] disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl border border-white/10 transition duration-200"
          >
            <Folder className="w-4 h-4 text-indigo-400" />
            <span>Select Folder</span>
          </button>
          
          <button
            type="button"
            onClick={triggerFileInput}
            disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0A0A0B] hover:bg-[#141417] disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl border border-white/10 transition duration-200"
          >
            <File className="w-4 h-4 text-indigo-400" />
            <span>Select Files</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl text-rose-400 text-sm">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
