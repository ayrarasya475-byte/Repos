export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  total_private_repos?: number;
  followers: number;
  following?: number;
  email?: string | null;
  created_at?: string;
  location?: string | null;
  company?: string | null;
  blog?: string | null;
  public_gists?: number;
}

export interface GitHubOrg {
  login: string;
  id: number;
  avatar_url: string;
  description: string | null;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  language?: string | null;
  owner?: {
    login: string;
  };
}

export interface UploadFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  sha?: string;
}

export interface UploadSession {
  status: 'idle' | 'preparing' | 'uploading_blobs' | 'creating_tree' | 'creating_commit' | 'updating_ref' | 'success' | 'error';
  progress: number;
  currentFileIndex: number;
  totalFiles: number;
  error?: string;
}
