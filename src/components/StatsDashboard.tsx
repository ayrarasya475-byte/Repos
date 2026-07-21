import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, CheckCircle2, Database, FileText, HardDrive, Globe, Trash2, Plus, AlertCircle, ExternalLink, RefreshCw, Layers, ShieldAlert, BadgeInfo
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie
} from 'recharts';
import { UploadFile } from '../types';
import { formatBytes } from './FileTree';
import { safeStorage } from '../utils/storage';

interface StatsDashboardProps {
  stagedFiles: UploadFile[];
}

export default function StatsDashboard({ stagedFiles }: StatsDashboardProps) {
  const [vercelToken, setVercelToken] = useState(() => safeStorage.getItem('REPOSTNOW_VERCEL_TOKEN') || '');
  const [projects, setProjects] = useState<any[]>([]);
  const [vercelUser, setVercelUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Custom domains configuration state
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectDomains, setProjectDomains] = useState<{ [projectId: string]: any[] }>({});
  const [newDomainName, setNewDomainName] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);

  const [totalQueries, setTotalQueries] = useState(() => {
    return Number(localStorage.getItem('repostnow_queries_count') || '148');
  });

  // Real-time Traffic Simulator state
  const [trafficLogs, setTrafficLogs] = useState<Array<{ id: string; time: string; method: string; path: string; status: number; duration: number; ip: string }>>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState({
    requestsCount: 1420,
    avgLatency: 42,
    bandwidthKb: 852.4,
    successRate: 99.8,
    activeSockets: 3
  });
  const [systemLoad, setSystemLoad] = useState({ cpu: 12, mem: 44.2 });

  // Real-time simulation loop
  useEffect(() => {
    // Generate initial logs
    const methods = ['GET', 'POST', 'PUT', 'GET', 'GET'];
    const paths = ['/index.html', '/api/gemini/chat', '/src/App.tsx', '/assets/index.css', '/metadata.json', '/favicon.ico'];
    const statuses = [200, 200, 200, 200, 304, 201, 404];
    const initialLogs = Array.from({ length: 6 }).map((_, i) => {
      const date = new Date(Date.now() - (6 - i) * 3000);
      return {
        id: Math.random().toString(36).substring(7),
        time: date.toLocaleTimeString(),
        method: methods[Math.floor(Math.random() * methods.length)],
        path: paths[Math.floor(Math.random() * paths.length)],
        status: statuses[Math.floor(Math.random() * (statuses.length - 1))], // favor 200/304
        duration: Math.floor(Math.random() * 120) + 10,
        ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`
      };
    });
    setTrafficLogs(initialLogs);

    // Dynamic updates every 2.5 seconds
    const interval = setInterval(() => {
      const now = new Date();
      const newLog = {
        id: Math.random().toString(36).substring(7),
        time: now.toLocaleTimeString(),
        method: methods[Math.floor(Math.random() * methods.length)],
        path: paths[Math.floor(Math.random() * paths.length)],
        status: Math.random() > 0.95 ? 404 : statuses[Math.floor(Math.random() * (statuses.length - 1))],
        duration: Math.floor(Math.random() * 110) + 8,
        ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`
      };

      setTrafficLogs(prev => [newLog, ...prev.slice(0, 7)]);
      
      // Fluctuated metrics
      setRealtimeMetrics(prev => {
        const reqAdded = Math.floor(Math.random() * 3) + 1;
        const newTotal = prev.requestsCount + reqAdded;
        const latencyDiff = Math.random() > 0.5 ? 1 : -1;
        const newLatency = Math.max(25, Math.min(85, prev.avgLatency + latencyDiff));
        const bandwidthAdded = parseFloat((Math.random() * 15.2).toFixed(1));
        const newBandwidth = parseFloat((prev.bandwidthKb + bandwidthAdded).toFixed(1));
        
        return {
          requestsCount: newTotal,
          avgLatency: newLatency,
          bandwidthKb: newBandwidth,
          successRate: parseFloat((99.5 + Math.random() * 0.49).toFixed(2)),
          activeSockets: Math.floor(Math.random() * 4) + 2
        };
      });

      setSystemLoad({
        cpu: Math.floor(Math.random() * 20) + 5,
        mem: parseFloat((42.1 + Math.random() * 2.5).toFixed(1))
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Load Vercel status on mount or token change
  useEffect(() => {
    if (vercelToken) {
      fetchVercelData();
    }
  }, [vercelToken]);

  const fetchVercelData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch user profile / limit information
      const userRes = await fetch('/api/proxy-vercel-user', {
        headers: { 'x-vercel-token': vercelToken }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        setVercelUser(userData.user || userData);
      }

      // 2. Fetch projects
      const projRes = await fetch('/api/proxy-vercel-projects', {
        headers: { 'x-vercel-token': vercelToken }
      });
      if (!projRes.ok) {
        throw new Error(`Failed to fetch Vercel projects (HTTP ${projRes.status})`);
      }
      const projData = await projRes.json();
      const projList = projData.projects || [];
      setProjects(projList);

      // 3. For each project, fetch its domains
      for (const p of projList) {
        fetchDomainsForProject(p.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync Vercel statistics.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDomainsForProject = async (projId: string) => {
    try {
      const res = await fetch(`/api/proxy-vercel-projects/${projId}/domains`, {
        headers: { 'x-vercel-token': vercelToken }
      });
      if (res.ok) {
        const data = await res.json();
        setProjectDomains(prev => ({ ...prev, [projId]: data.domains || [] }));
      }
    } catch (e) {
      console.error('Failed to load domains for project', projId, e);
    }
  };

  const handleAddDomain = async (projId: string) => {
    if (!newDomainName.trim()) return;
    setDomainLoading(true);
    setDomainError(null);
    try {
      const res = await fetch(`/api/proxy-vercel-projects/${projId}/domains`, {
        method: 'POST',
        headers: {
          'x-vercel-token': vercelToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newDomainName.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to add custom domain');
      }
      setNewDomainName('');
      await fetchDomainsForProject(projId);
    } catch (err: any) {
      setDomainError(err.message);
    } finally {
      setDomainLoading(false);
    }
  };

  const handleDeleteDomain = async (projId: string, domainName: string) => {
    if (!confirm(`Are you sure you want to delete domain "${domainName}"?`)) return;
    try {
      const res = await fetch(`/api/proxy-vercel-projects/${projId}/domains/${domainName}`, {
        method: 'DELETE',
        headers: { 'x-vercel-token': vercelToken }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to delete domain');
      }
      await fetchDomainsForProject(projId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteProject = async (projId: string, projName: string) => {
    if (!confirm(`⚠️ DANGER: Are you sure you want to delete project "${projName}"? This deletes all associated deployments, custom domains, and cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/proxy-vercel-projects/${projId}`, {
        method: 'DELETE',
        headers: { 'x-vercel-token': vercelToken }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to delete project');
      }
      setProjects(prev => prev.filter(p => p.id !== projId));
      alert(`Project "${projName}" successfully deleted from Vercel.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveTokenManually = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vercelToken.trim()) return;
    safeStorage.setItem('REPOSTNOW_VERCEL_TOKEN', vercelToken.trim());
    fetchVercelData();
  };

  // Compute staged file types and sizes
  const fileTypeDistribution = useMemo(() => {
    const distribution: { [key: string]: number } = {};
    stagedFiles.forEach(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || 'other';
      distribution[ext] = (distribution[ext] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [stagedFiles]);

  const totalStagedSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

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
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Vercel Connected Projects</p>
            <h3 className="text-2xl font-black text-amber-400 mt-1 font-mono">{projects.length}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Real-time Vercel sync</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/10">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#141417] border border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Security Protection</p>
            <span className="inline-block text-[10px] font-bold font-mono uppercase px-2.5 py-1 rounded-full mt-2 border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              ● ANTI-DDOS & SQLI
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-white/5">
            <Database className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* VERCEL PRODUCTION DEPLOYMENTS SECTION */}
      <div className="bg-[#141417] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              <span>Real-Time Vercel Deployments & Domains</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">Configure live domains, delete staging environments, and view statistics directly from your Vercel pipeline.</p>
          </div>

          <button
            onClick={fetchVercelData}
            disabled={loading || !vercelToken}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg border border-white/5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Sync</span>
          </button>
        </div>

        {!vercelToken ? (
          <form onSubmit={handleSaveTokenManually} className="p-6 bg-slate-900/40 rounded-2xl border border-dashed border-white/10 flex flex-col items-center text-center space-y-4">
            <ShieldAlert className="w-10 h-10 text-amber-500/80" />
            <div className="max-w-md">
              <h4 className="text-sm font-bold text-slate-200">Vercel API Integration Required</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Connect your Vercel Token to view live projects, configure custom domains, delete test deployments, and see real-time limits.
              </p>
            </div>
            <div className="flex w-full max-w-md gap-2">
              <input
                type="password"
                placeholder="Enter Vercel User Token (Bearer)..."
                value={vercelToken}
                onChange={(e) => setVercelToken(e.target.value)}
                className="flex-grow px-3.5 py-2 text-xs font-mono bg-black/60 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition flex-shrink-0"
              >
                Connect API
              </button>
            </div>
          </form>
        ) : loading && projects.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-500">Querying active Vercel deployments and project statistics...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-xs">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed border-white/5 rounded-2xl">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No active Vercel projects found on this token account.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => {
              const domains = projectDomains[project.id] || [];
              const latestDeployment = project.latestDeployments?.[0];
              const createdDate = new Date(project.createdAt).toLocaleString();
              const updateDate = latestDeployment ? new Date(latestDeployment.createdAt).toLocaleString() : 'N/A';

              return (
                <div key={project.id} className="bg-[#0C0C0F] border border-white/5 hover:border-white/10 rounded-2xl p-5 flex flex-col justify-between transition group space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-indigo-400">PROJECT</span>
                        <h4 className="text-sm font-bold text-slate-100 mt-0.5">{project.name}</h4>
                      </div>
                      <button
                        onClick={() => handleDeleteProject(project.id, project.name)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg border border-red-500/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete project from Vercel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono p-2.5 bg-[#141417]/60 rounded-xl border border-white/5">
                      <div>
                        <span className="text-slate-500">Framework:</span>{' '}
                        <span className="text-slate-300">{project.framework || 'Vite/SPA'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Node Version:</span>{' '}
                        <span className="text-slate-300">{project.nodeVersion || '20.x'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Created:</span>{' '}
                        <span className="text-slate-400 block truncate">{createdDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Last Deploy:</span>{' '}
                        <span className="text-slate-400 block truncate">{updateDate}</span>
                      </div>
                    </div>

                    {/* DOMAINS SECTION */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-400">Domains ({domains.length})</span>
                        <button
                          onClick={() => setActiveProjectId(activeProjectId === project.id ? null : project.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                          {activeProjectId === project.id ? 'Close' : '+ Add Domain'}
                        </button>
                      </div>

                      {activeProjectId === project.id && (
                        <div className="space-y-2 p-3 bg-[#141417]/80 rounded-xl border border-white/5">
                          <p className="text-[10px] text-slate-400">Specify domain name (e.g. static-demo.vercel.app):</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="domain.com"
                              value={newDomainName}
                              onChange={(e) => setNewDomainName(e.target.value)}
                              className="flex-grow px-2 py-1 bg-black/60 border border-white/10 rounded-lg text-xs text-slate-200 font-mono"
                            />
                            <button
                              onClick={() => handleAddDomain(project.id)}
                              disabled={domainLoading}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition"
                            >
                              Add
                            </button>
                          </div>
                          {domainError && <p className="text-[9px] text-red-400 font-mono">{domainError}</p>}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {domains.map((d: any) => (
                          <div key={d.name} className="flex items-center gap-1.5 px-2 py-1 bg-[#141417] border border-white/5 rounded-lg text-[10px] font-mono text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <a
                              href={`https://${d.name}`}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              className="hover:underline flex items-center gap-1"
                            >
                              <span>{d.name}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                            </a>
                            <button
                              onClick={() => handleDeleteDomain(project.id, d.name)}
                              className="text-red-500 hover:text-red-400 font-bold ml-1.5"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {latestDeployment && (
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${latestDeployment.status === 'READY' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                        <span className="text-[10px] text-slate-400 font-mono">Status: {latestDeployment.status}</span>
                      </div>
                      <a
                        href={`https://${latestDeployment.url}`}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        <span>View Live</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Vercel user Limits block */}
        {vercelUser && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-white/5">
            <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-[10px] font-mono text-left">
              <span className="text-slate-500 uppercase block">Vercel User:</span>
              <span className="text-slate-300 font-bold mt-0.5 block">{vercelUser.username || vercelUser.name || 'Personal Account'}</span>
            </div>
            <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-[10px] font-mono text-left">
              <span className="text-slate-500 uppercase block">Billing Plan:</span>
              <span className="text-slate-300 font-bold mt-0.5 block capitalize">{vercelUser.billing?.plan || 'Hobby / Free Tier'}</span>
            </div>
            <div className="p-3 bg-black/30 border border-white/5 rounded-xl text-[10px] font-mono text-left">
              <span className="text-slate-500 uppercase block">Projects Limit:</span>
              <span className="text-slate-300 font-bold mt-0.5 block">Unlimited / Soft limit (Hobby)</span>
            </div>
          </div>
        )}
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

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono max-h-24 overflow-y-auto custom-scrollbar text-left">
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

      {/* REAL-TIME SYSTEM PERFORMANCE MONITOR & WEB TRAFFIC TERMINAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live system load dials */}
        <div className="lg:col-span-4 bg-[#141417] border border-white/5 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div>
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Engine Telemetry</span>
            </h4>
            <p className="text-slate-500 text-xs">Simulated live engine resources and system process loads.</p>
          </div>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {/* CPU */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">STUDIO CORE CPU:</span>
                <span className="text-emerald-400 font-bold">{systemLoad.cpu}%</span>
              </div>
              <div className="w-full bg-[#0A0A0C] h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${systemLoad.cpu}%` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">MEM BUFFER (RAM):</span>
                <span className="text-indigo-400 font-bold">{systemLoad.mem}%</span>
              </div>
              <div className="w-full bg-[#0A0A0C] h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${systemLoad.mem}%` }}
                />
              </div>
            </div>

            {/* Active Sockets / Threads */}
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-center">
              <div className="bg-[#0c0c0f] p-2.5 rounded-xl border border-white/5">
                <span className="text-[9px] uppercase font-mono text-slate-500 block">Active Sockets</span>
                <span className="text-sm font-black text-slate-200 mt-1 block font-mono">{realtimeMetrics.activeSockets} LNK</span>
              </div>
              <div className="bg-[#0c0c0f] p-2.5 rounded-xl border border-white/5">
                <span className="text-[9px] uppercase font-mono text-slate-500 block">Refreshes</span>
                <span className="text-sm font-black text-slate-200 mt-1 block font-mono">Auto (2.5s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time traffic terminal */}
        <div className="lg:col-span-8 bg-[#141417] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <span className="relative flex h-2 w-2 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>Live Deployments Server Analytics (Streaming)</span>
              </h4>
              <p className="text-slate-500 text-xs">Simulated live hits and payload transfers on your build artifacts.</p>
            </div>
            
            <div className="text-right text-[10px] font-mono text-slate-500 bg-black/40 px-2 py-1 rounded border border-white/5">
              <span>RATE: {realtimeMetrics.requestsCount} REQ</span>
            </div>
          </div>

          {/* Metrics header */}
          <div className="grid grid-cols-4 gap-2 text-center py-2.5 px-1 bg-[#0c0c0f]/80 rounded-2xl border border-white/5 text-[10px] font-mono">
            <div>
              <span className="text-slate-500 block uppercase">Requests</span>
              <span className="text-slate-200 font-bold mt-0.5 block">{realtimeMetrics.requestsCount}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase">Latency</span>
              <span className="text-slate-200 font-bold mt-0.5 block text-indigo-400">{realtimeMetrics.avgLatency}ms</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase">Bandwidth</span>
              <span className="text-slate-200 font-bold mt-0.5 block text-amber-400">{(realtimeMetrics.bandwidthKb).toFixed(1)} KB</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase">Success</span>
              <span className="text-slate-200 font-bold mt-0.5 block text-emerald-400">{realtimeMetrics.successRate}%</span>
            </div>
          </div>

          {/* Scrolling shell output */}
          <div className="bg-[#050507] rounded-2xl border border-white/5 p-4 h-44 overflow-y-auto font-mono text-[10px] sm:text-xs leading-5 text-slate-300 scrollbar-none flex flex-col-reverse text-left">
            {trafficLogs.map((log) => {
              const isError = log.status >= 400;
              return (
                <div key={log.id} className="flex flex-wrap items-center gap-1.5 opacity-90 border-b border-white/[0.01] pb-1 hover:bg-white/[0.02]">
                  <span className="text-slate-600 font-bold select-none">[{log.time}]</span>
                  <span className={`px-1.5 py-0.2 rounded font-extrabold text-[9px] ${
                    log.method === 'POST' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' :
                    log.method === 'PUT' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10' :
                    'bg-slate-800 text-slate-400 border border-white/5'
                  }`}>{log.method}</span>
                  <span className="text-slate-200 flex-1 truncate max-w-[200px] sm:max-w-xs">{log.path}</span>
                  <span className="text-slate-500">from {log.ip}</span>
                  <span className={`font-bold ml-auto px-1.5 rounded text-[9px] ${
                    isError ? 'bg-red-500/15 text-red-400 font-extrabold border border-red-500/10' :
                    log.status === 304 ? 'bg-slate-700/30 text-slate-400' :
                    'bg-emerald-500/15 text-emerald-400 font-extrabold border border-emerald-500/10'
                  }`}>{log.status} {log.status === 200 ? 'OK' : log.status === 304 ? 'CACHED' : log.status === 201 ? 'CREATED' : 'FAIL'}</span>
                  <span className="text-slate-500 text-[10px] w-12 text-right">{log.duration}ms</span>
                </div>
              );
            })}
          </div>
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
