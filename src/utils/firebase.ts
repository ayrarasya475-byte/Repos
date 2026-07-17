import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPopup, GithubAuthProvider, Auth } from 'firebase/auth';
import { safeStorage } from './storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export function saveFirebaseConfig(config: FirebaseConfig) {
  safeStorage.setItem('REPOSTNOW_FB_API_KEY', config.apiKey);
  safeStorage.setItem('REPOSTNOW_FB_AUTH_DOMAIN', config.authDomain);
  safeStorage.setItem('REPOSTNOW_FB_PROJECT_ID', config.projectId);
  safeStorage.setItem('REPOSTNOW_FB_APP_ID', config.appId);
}

export function getFirebaseConfig(): FirebaseConfig | null {
  const metaEnv = (import.meta as any).env || {};
  const apiKey = safeStorage.getItem('REPOSTNOW_FB_API_KEY') || (metaEnv.VITE_FIREBASE_API_KEY as string) || '';
  const authDomain = safeStorage.getItem('REPOSTNOW_FB_AUTH_DOMAIN') || (metaEnv.VITE_FIREBASE_AUTH_DOMAIN as string) || '';
  const projectId = safeStorage.getItem('REPOSTNOW_FB_PROJECT_ID') || (metaEnv.VITE_FIREBASE_PROJECT_ID as string) || '';
  const appId = safeStorage.getItem('REPOSTNOW_FB_APP_ID') || (metaEnv.VITE_FIREBASE_APP_ID as string) || '';

  if (!apiKey || !authDomain || !projectId) {
    return null;
  }
  return { apiKey, authDomain, projectId, appId };
}

export function clearFirebaseConfig() {
  safeStorage.removeItem('REPOSTNOW_FB_API_KEY');
  safeStorage.removeItem('REPOSTNOW_FB_AUTH_DOMAIN');
  safeStorage.removeItem('REPOSTNOW_FB_PROJECT_ID');
  safeStorage.removeItem('REPOSTNOW_FB_APP_ID');
}

export function initFirebase(): FirebaseApp | null {
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    if (getApps().length > 0) {
      return getApp();
    }
    return initializeApp(config);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return null;
  }
}

export async function loginWithGitHubViaFirebase(): Promise<string> {
  const app = initFirebase();
  if (!app) {
    throw new Error('Firebase is not configured yet. Please enter your Firebase configuration in Config settings.');
  }

  const auth = getAuth(app);
  const provider = new GithubAuthProvider();
  
  // Set the 27 requested GitHub permission scopes (required, optional & power user scopes)
  const requiredScopes = [
    'repo',
    'public_repo',
    'read:org',
    'read:user',
    'admin:repo_hook',
    'workflow',
    'gist',
    'delete_repo',
    'admin:org',
    'admin:org_hook',
    'notifications',
    'user',
    'admin:public_key',
    'write:public_key',
    'read:public_key',
    'admin:gpg_key',
    'write:gpg_key',
    'read:gpg_key',
    'codespace',
    'read:discussion',
    'write:discussion',
    'audit_log',
    'read:audit_log',
    'project',
    'read:project',
    'copilot',
    'read:enterprise'
  ];

  requiredScopes.forEach(scope => {
    provider.addScope(scope);
  });

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GithubAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('Failed to retrieve GitHub access token from authentication.');
    }

    return token;
  } catch (error: any) {
    console.error('Firebase GitHub Sign-In Error:', error);
    let message = error.message || 'Authentication failed.';
    if (error.code === 'auth/popup-blocked') {
      message = 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    } else if (error.code === 'auth/unauthorized-domain') {
      message = 'This domain is not authorized in your Firebase project. Please add it to Authorized Domains in Firebase console.';
    }
    throw new Error(message);
  }
}
