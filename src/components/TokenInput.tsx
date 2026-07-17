import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, CheckCircle, AlertCircle, HelpCircle, LogOut, ChevronDown, ChevronUp, Github, ExternalLink, Loader2 } from 'lucide-react';
import { GitHubUser } from '../types';
import { loginWithGitHubViaFirebase, getFirebaseConfig } from '../utils/firebase';

interface TokenInputProps {
  token: string;
  user: GitHubUser | null;
  loading: boolean;
  error: string | null;
  onConnect: (token: string) => void;
  onDisconnect: () => void;
}

export default function TokenInput({
  token,
  user,
  loading,
  error,
  onConnect,
  onDisconnect,
}: TokenInputProps) {
  const [inputToken, setInputToken] = useState(token);
  const [showHelp, setShowHelp] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputToken.trim()) {
      onConnect(inputToken.trim());
    }
  };

  const handleOAuthLogin = async () => {
    setOauthLoading(true);
    setOauthError(null);
    try {
      const isConfigured = getFirebaseConfig();
      if (!isConfigured) {
        throw new Error(
          'Firebase Authentication is not configured yet. Developers: Add VITE_FIREBASE_ env variables in AI Studio Settings menu, or set them up in the drawer settings tab.'
        );
      }
      const ghToken = await loginWithGitHubViaFirebase();
      onConnect(ghToken);
    } catch (err: any) {
      console.error(err);
      setOauthError(err.message || 'Failed to authenticate via GitHub OAuth.');
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div id="github-token-section" className="bg-[#141417] border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      {/* Visual background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {!user ? (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-white/5">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-lg">Connect GitHub Account</h3>
              <p className="text-slate-400 text-sm">Sign in with one click or enter a Personal Access Token.</p>
            </div>
          </div>

          {/* Primary Action: Direct GitHub OAuth Login */}
          <div className="space-y-4 mb-6">
            <button
              onClick={handleOAuthLogin}
              disabled={loading || oauthLoading}
              className="w-full py-3 bg-[#24292F] hover:bg-[#24292F]/90 text-white border border-white/10 hover:border-white/20 font-semibold rounded-xl text-sm transition duration-200 shadow-lg flex items-center justify-center gap-2.5 active:scale-[0.99]"
            >
              {oauthLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                  <span>Authorizing Github...</span>
                </>
              ) : (
                <>
                  <Github className="w-4 h-4 text-white" />
                  <span>Sign in with GitHub</span>
                </>
              )}
            </button>

            {oauthError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-xs leading-normal"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{oauthError}</span>
              </motion.div>
            )}
          </div>

          {/* Separator */}
          <div className="relative flex py-3 items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-slate-600 font-mono text-[10px] uppercase tracking-wider">or connect via token</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 mt-3">
            <div className="relative">
              <input
                id="github-token-input"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                className="w-full pl-4 pr-24 py-3 bg-[#0A0A0B] border border-white/10 rounded-xl text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 font-mono text-sm transition duration-200"
                disabled={loading || oauthLoading}
              />
              <button
                type="submit"
                disabled={loading || oauthLoading || !inputToken.trim()}
                className="absolute right-2 top-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-lg text-sm transition duration-200 shadow-md"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded-lg p-3 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </form>

          {/* Collapsible Help Section */}
          <div className="mt-4 border-t border-white/5 pt-3">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm font-medium transition duration-200"
            >
              <HelpCircle className="w-4 h-4" />
              <span>How do I generate a GitHub Token?</span>
              {showHelp ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>

            <AnimatePresence>
              {showHelp && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 bg-[#0A0A0B] border border-white/5 rounded-xl p-4 text-xs text-slate-400 leading-relaxed space-y-2.5">
                    <p>
                      RepostNow requires a <strong className="text-slate-200 font-medium">GitHub Personal Access Token (Classic)</strong> to communicate with GitHub's REST API. Your token remains safely stored in your browser's local storage and is never sent to any external server besides GitHub.
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                      <li>
                        Go to the{' '}
                        <a
                          href="https://github.com/settings/tokens/new?description=RepostNow&scopes=repo"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-medium"
                        >
                          GitHub Token Creation page <ExternalLink className="w-3 h-3 inline" />
                        </a>.
                      </li>
                      <li>
                        Set the expiration to your preferred duration (e.g., <strong className="text-slate-200 font-medium">30 days</strong> or <strong className="text-slate-200 font-medium">No expiration</strong> for convenience).
                      </li>
                      <li>
                        Under select scopes, make sure <strong className="text-indigo-400 font-medium">"repo"</strong> is checked (this is required to create repositories and push file blobs). If you want to be able to delete repos, check <strong className="text-indigo-400 font-medium">"delete_repo"</strong> too.
                      </li>
                      <li>
                        Click <strong className="text-slate-200 font-medium">"Generate token"</strong> at the bottom of the page.
                      </li>
                      <li>
                        Copy the generated token starting with <code className="text-indigo-400 bg-indigo-950/30 px-1 py-0.5 rounded border border-indigo-900/40 font-mono">ghp_...</code> and paste it above!
                      </li>
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={user?.avatar_url}
              alt={user?.login}
              className="w-12 h-12 rounded-full border-2 border-indigo-500/30 flex-shrink-0"
            />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-lg">
                  {user?.name || user?.login}
                </h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-white/5 text-indigo-400 text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              </div>
              <p className="text-slate-400 text-sm font-mono">
                @{user?.login}
              </p>
              
              <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-mono">
                <span>Repos: <strong className="text-slate-300">{user?.public_repos}</strong></span>
                <span>•</span>
                <span>Followers: <strong className="text-slate-300">{user?.followers}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-medium transition duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
