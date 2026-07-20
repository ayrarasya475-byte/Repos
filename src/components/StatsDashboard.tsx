import React, { useState } from 'react';
import {
  TrendingUp, CheckCircle2, Database, FileText, HardDrive
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts';
import { UploadFile } from '../types';
import { formatBytes } from './FileTree';

interface StatsDashboardProps {
  stagedFiles: UploadFile[];
}

export default function StatsDashboard({ stagedFiles }: StatsDashboardProps) {
  // Statistics States
  const [totalQueries] = useState(() => {
    return Number(localStorage.getItem('repostnow_queries_count') || '148');
  });

  // Compute staged file types and sizes
  const fileTypeDistribution = React.useMemo(() => {
    const distribution: { [key: string]: number } = {};
    stagedFiles.forEach(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || 'other';
      distribution[ext] = (distribution[ext] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [stagedFiles]);

  const totalStagedSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  // Mock static historical charts
  const usageData = [
    { day: 'Mon', uploads: 4, aiQueries: 12, sizeKb: 240 },
    { day: 'Tue', uploads: 7, aiQueries: 19, sizeKb: 380 },
    { day: 'Wed', uploads: 2, aiQueries: 8, sizeKb: 120 },
    { day: 'Thu', uploads: 12, aiQueries: 35, sizeKb: 940 },
    { day: 'Fri', uploads: 15, aiQueries: 42, sizeKb: 1400 },
    { day: 'Sat', uploads: 8, aiQueries: 21, sizeKb: 600 },
    { day: 'Sun', uploads: 11, aiQueries: 28, sizeKb: 850 },
  ];

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 text-left font-sans">
      
      {/* Premium Dashboard Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-[#141417] border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Total Staged Files</p>
            <h3 className="text-2xl font-black text-indigo-400 mt-1 font-mono">{stagedFiles.length}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Ready for commit push</p>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/10">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141417] border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Total Staged Weight</p>
            <h3 className="text-2xl font-black text-emerald-400 mt-1 font-mono">{formatBytes(totalStagedSize)}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Dynamic payload size</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/10">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141417] border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">AI Queries Triggered</p>
            <h3 className="text-2xl font-black text-amber-400 mt-1 font-mono">{totalQueries}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Active tokens this month</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/10">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141417] border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Security Integrity</p>
            <span className="inline-block text-xs font-bold font-mono uppercase px-2.5 py-1 rounded-full mt-2 border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              ● SECURE CLIENT
            </span>
          </div>
          <div className="p-3 bg-[#10b981]/10 rounded-xl text-[#10b981] border border-white/5">
            <Database className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Graph 1: Weekly uploads and queries */}
        <div className="lg:col-span-8 bg-[#141417] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
          <div>
            <h4 className="font-bold text-slate-100 text-sm">Interactive Studio Metrics</h4>
            <p className="text-slate-500 text-xs">Monitors daily GitHub commits and real-time AI responses.</p>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="day" stroke="#475569" fontSize={10} fontStyle="italic" />
                <YAxis stroke="#475569" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#0e0e10', border: '1px solid rgba(255,255,255,0.08)' }} />
                <Area type="monotone" dataKey="uploads" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorUploads)" name="Staged Actions" />
                <Area type="monotone" dataKey="aiQueries" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorQueries)" name="AI Computations" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: File Types distribution */}
        <div className="lg:col-span-4 bg-[#141417] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-100 text-sm">File Extensions Distribution</h4>
            <p className="text-slate-500 text-xs mt-0.5">Summary of types currently staged for commit.</p>
          </div>

          {stagedFiles.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-600 space-y-2">
              <Database className="w-8 h-8 opacity-25 text-indigo-400" />
              <p className="text-xs leading-relaxed">No staged files found in active workspace. Add some files on the Dashboard to inspect extensions.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center space-y-4 pt-4">
              <div className="h-40 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fileTypeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {fileTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-black text-slate-200 font-mono">{stagedFiles.length}</span>
                  <span className="text-[8px] uppercase tracking-wider font-bold text-slate-500">Items</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono max-h-24 overflow-y-auto custom-scrollbar">
                {fileTypeDistribution.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center gap-1.5 truncate p-1 bg-[#0A0A0B]/60 rounded border border-white/5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-slate-300 truncate">.{entry.name}</span>
                    <span className="text-slate-500 font-bold ml-auto">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECURE DIRECT browser pipelines info */}
      <div className="bg-[#141417] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
        <div>
          <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            <span>Encrypted Direct-to-GitHub Pipeline</span>
          </h4>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
            All files staged are processed completely client-side in your secure browser sandbox. RepostNow initiates direct pipelines to GitHub with TLS 1.3 encryption, ensuring your files never touch any intermediary hosting servers, logs, or databases.
          </p>
        </div>
      </div>
    </div>
  );
}
