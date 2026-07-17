import { GitHubUser, GitHubRepo, GitHubOrg, UploadFile, UploadSession } from '../types';

const GITHUB_API_URL = 'https://api.github.com';

interface RequestOptions {
  token: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function githubFetch(path: string, { token, method = 'GET', body, headers = {} }: RequestOptions) {
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };
  }

  const response = await fetch(`${GITHUB_API_URL}${path}`, options);

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // If it's not JSON
    }
    const message = errorData.message || response.statusText || 'GitHub API error';
    throw new Error(message);
  }

  // Some endpoints return no content (e.g. 204)
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function verifyToken(token: string): Promise<GitHubUser> {
  return githubFetch('/user', { token });
}

export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  // Fetch up to 100 repositories where the user is an owner or collaborator, sorted by updated
  return githubFetch('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator', { token });
}

export async function fetchUserOrgs(token: string): Promise<GitHubOrg[]> {
  return githubFetch('/user/orgs', { token });
}

export async function createRepository(
  token: string,
  owner: string,
  name: string,
  description: string,
  isPrivate: boolean,
  initReadme: boolean
): Promise<GitHubRepo> {
  const currentUser = await verifyToken(token);
  
  const body = {
    name,
    description: description || undefined,
    private: isPrivate,
    auto_init: initReadme, // True to create an empty README and initialize the repo with a main branch
  };

  if (owner === currentUser.login) {
    // Create in user's personal account
    return githubFetch('/user/repos', { token, method: 'POST', body });
  } else {
    // Create in organization
    return githubFetch(`/orgs/${owner}/repos`, { token, method: 'POST', body });
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip off the data:URI header, keeping only base64 data
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

interface UploadProgressCallbacks {
  onSessionChange: (session: Partial<UploadSession>) => void;
  onFileChange: (id: string, updates: Partial<UploadFile>) => void;
}

export async function uploadFilesToGithub(
  token: string,
  owner: string,
  repoName: string,
  branch: string,
  files: UploadFile[],
  commitMessage: string,
  callbacks: UploadProgressCallbacks
) {
  const { onSessionChange, onFileChange } = callbacks;

  try {
    onSessionChange({ status: 'preparing', progress: 5, currentFileIndex: 0, totalFiles: files.length });

    // Step 1: Check if the branch exists to find the parent commit
    let parentCommitSha: string | null = null;
    let baseTreeSha: string | null = null;
    let isNewBranch = false;

    try {
      const refResponse = await githubFetch(`/repos/${owner}/${repoName}/git/ref/heads/${branch}`, { token });
      parentCommitSha = refResponse.object.sha;
      
      // Get the tree SHA of that commit
      const commitResponse = await githubFetch(`/repos/${owner}/${repoName}/git/commits/${parentCommitSha}`, { token });
      baseTreeSha = commitResponse.tree.sha;
    } catch (err: any) {
      // Branch or ref might not exist yet (empty repo or completely new branch)
      console.log('Branch does not exist, checking if repo has any commit...', err);
      isNewBranch = true;
    }

    // If it's a completely new or empty repo, we need to initialize it first.
    // We can do this by using the Content API to put a dummy file or the README, or just create the first file directly.
    // Let's create a quick "README.md" or first file to establish a branch if parentCommitSha is null.
    if (!parentCommitSha) {
      onSessionChange({ status: 'preparing', progress: 10 });
      // Let's check if there are any files. If so, initialize with a simple commit
      const initMessage = "Initialize repository";
      const readmeContent = `# ${repoName}\n\nRepository uploaded using RepostNow.`;
      
      try {
        // Create README.md to initialize the branch
        const initResponse = await githubFetch(`/repos/${owner}/${repoName}/contents/README.md`, {
          token,
          method: 'PUT',
          body: {
            message: initMessage,
            content: btoa(unescape(encodeURIComponent(readmeContent))),
            branch,
          }
        });
        parentCommitSha = initResponse.commit.sha;
        baseTreeSha = initResponse.commit.tree.sha;
        isNewBranch = false;
        console.log('Initialized repository with README.md. Parent Commit:', parentCommitSha);
      } catch (err: any) {
        throw new Error(`Failed to initialize empty repository: ${err.message}`);
      }
    }

    onSessionChange({ status: 'uploading_blobs', progress: 15 });

    // Step 2: Upload all files as blobs
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];
      onFileChange(uploadFile.id, { status: 'uploading', progress: 10 });
      onSessionChange({ currentFileIndex: i, progress: 15 + Math.floor((i / files.length) * 70) });

      try {
        const base64Content = await fileToBase64(uploadFile.file);
        
        onFileChange(uploadFile.id, { progress: 50 });

        const blobResponse = await githubFetch(`/repos/${owner}/${repoName}/git/blobs`, {
          token,
          method: 'POST',
          body: {
            content: base64Content,
            encoding: 'base64',
          },
        });

        const sha = blobResponse.sha;
        onFileChange(uploadFile.id, { status: 'success', progress: 100, sha });

        // Standard file mode: '100644'. Executables or script files can be '100755'.
        // Let's check common shell script extensions to mark them as executable
        const isExecutable = uploadFile.name.endsWith('.sh') || uploadFile.name.endsWith('.py') || uploadFile.name.endsWith('.js');
        const mode = isExecutable ? '100755' : '100644';

        treeItems.push({
          path: uploadFile.path,
          mode,
          type: 'blob',
          sha,
        });
      } catch (err: any) {
        onFileChange(uploadFile.id, { status: 'error', error: err.message || 'Upload failed' });
        throw new Error(`Failed to upload ${uploadFile.path}: ${err.message}`);
      }
    }

    // Step 3: Create a new git tree pointing to these blobs
    onSessionChange({ status: 'creating_tree', progress: 85 });
    const treeBody: any = {
      tree: treeItems,
    };
    if (baseTreeSha) {
      treeBody.base_tree = baseTreeSha;
    }

    const treeResponse = await githubFetch(`/repos/${owner}/${repoName}/git/trees`, {
      token,
      method: 'POST',
      body: treeBody,
    });
    const newTreeSha = treeResponse.sha;

    // Step 4: Create a commit
    onSessionChange({ status: 'creating_commit', progress: 90 });
    const commitResponse = await githubFetch(`/repos/${owner}/${repoName}/git/commits`, {
      token,
      method: 'POST',
      body: {
        message: commitMessage,
        tree: newTreeSha,
        parents: parentCommitSha ? [parentCommitSha] : [],
      },
    });
    const newCommitSha = commitResponse.sha;

    // Step 5: Update the branch ref
    onSessionChange({ status: 'updating_ref', progress: 95 });
    
    if (isNewBranch) {
      // Create new ref
      await githubFetch(`/repos/${owner}/${repoName}/git/refs`, {
        token,
        method: 'POST',
        body: {
          ref: `refs/heads/${branch}`,
          sha: newCommitSha,
        },
      });
    } else {
      // Update existing ref
      await githubFetch(`/repos/${owner}/${repoName}/git/refs/heads/${branch}`, {
        token,
        method: 'PATCH',
        body: {
          sha: newCommitSha,
          force: true,
        },
      });
    }

    onSessionChange({ status: 'success', progress: 100 });
  } catch (err: any) {
    onSessionChange({ status: 'error', error: err.message || 'An error occurred during upload' });
    throw err;
  }
}

/**
 * Fetch contents of a repository path
 */
export async function fetchRepoContents(
  token: string,
  owner: string,
  repo: string,
  path: string = '',
  ref: string = 'main'
): Promise<any> {
  const cleanPath = path ? `/${path}` : '';
  const query = ref ? `?ref=${ref}` : '';
  return githubFetch(`/repos/${owner}/${repo}/contents${cleanPath}${query}`, { token });
}

/**
 * Delete a repository from GitHub
 */
export async function deleteRepository(
  token: string,
  owner: string,
  repo: string
): Promise<void> {
  return githubFetch(`/repos/${owner}/${repo}`, { token, method: 'DELETE' });
}

/**
 * Delete a specific file from a repository
 */
export async function deleteFileFromRepo(
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string,
  branch: string = 'main',
  commitMessage: string = 'Delete file via RepostNow'
): Promise<any> {
  const body = {
    message: commitMessage,
    sha,
    branch,
  };
  return githubFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    token,
    method: 'DELETE',
    body,
  });
}

/**
 * Upload a single file directly to a repository
 */
export async function uploadSingleFileToRepo(
  token: string,
  owner: string,
  repo: string,
  path: string,
  contentBase64: string,
  branch: string = 'main',
  commitMessage: string = 'Upload file via RepostNow',
  sha?: string
): Promise<any> {
  const body: any = {
    message: commitMessage,
    content: contentBase64,
    branch,
  };
  if (sha) {
    body.sha = sha;
  }
  return githubFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    token,
    method: 'PUT',
    body,
  });
}

/**
 * Wipe all files and folders in a repository by replacing them with a single README
 */
export async function wipeRepositoryContents(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main',
  commitMessage: string = 'Wipe all files via RepostNow'
): Promise<any> {
  // Step 1: Get the parent commit SHA of the current branch
  const refResponse = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, { token });
  const parentCommitSha = refResponse.object.sha;

  // Step 2: Create a NEW tree with ONLY a README.md (Do NOT set base_tree so it overwrites everything!)
  const readmeContent = `# ${repo}\n\nRepository wiped using RepostNow.`;
  const base64Content = btoa(unescape(encodeURIComponent(readmeContent)));
  
  // First, create the blob for README.md
  const blobResponse = await githubFetch(`/repos/${owner}/${repo}/git/blobs`, {
    token,
    method: 'POST',
    body: {
      content: base64Content,
      encoding: 'base64',
    },
  });
  const readmeSha = blobResponse.sha;

  // Now create the tree containing ONLY README.md
  const treeResponse = await githubFetch(`/repos/${owner}/${repo}/git/trees`, {
    token,
    method: 'POST',
    body: {
      tree: [
        {
          path: 'README.md',
          mode: '100644',
          type: 'blob',
          sha: readmeSha,
        },
      ],
    },
  });
  const newTreeSha = treeResponse.sha;

  // Step 3: Create a commit pointing to this new tree
  const commitResponse = await githubFetch(`/repos/${owner}/${repo}/git/commits`, {
    token,
    method: 'POST',
    body: {
      message: commitMessage,
      tree: newTreeSha,
      parents: [parentCommitSha],
    },
  });
  const newCommitSha = commitResponse.sha;

  // Step 4: Update the ref
  return githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    token,
    method: 'PATCH',
    body: {
      sha: newCommitSha,
      force: true,
      },
    });
}

/**
 * Delete a folder recursively from a repository (by creating a new tree that excludes all files inside that folder)
 */
export async function deleteDirectoryFromRepo(
  token: string,
  owner: string,
  repo: string,
  dirPath: string,
  branch: string = 'main',
  commitMessage: string = 'Delete folder via RepostNow'
): Promise<any> {
  // Step 1: Get the parent commit SHA of the current branch
  const refResponse = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, { token });
  const parentCommitSha = refResponse.object.sha;

  // Step 2: Get the tree of that commit
  const commitResponse = await githubFetch(`/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, { token });
  const baseTreeSha = commitResponse.tree.sha;

  // Step 3: Get the full recursive tree to find all items
  const treeResponse = await githubFetch(`/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=true`, { token });
  const fullTree = treeResponse.tree;

  // Step 4: Filter out any items that are inside the directory we want to delete
  const cleanDirPath = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
  const filteredTree = fullTree.filter((item: any) => {
    return item.path !== dirPath && !item.path.startsWith(cleanDirPath);
  });

  // Step 5: Post the new tree
  const treePayload = filteredTree.map((item: any) => ({
    path: item.path,
    mode: item.mode,
    type: item.type,
    sha: item.sha
  }));

  const newTreeResponse = await githubFetch(`/repos/${owner}/${repo}/git/trees`, {
    token,
    method: 'POST',
    body: {
      tree: treePayload
    }
  });
  const newTreeSha = newTreeResponse.sha;

  // Step 6: Create a commit
  const newCommitResponse = await githubFetch(`/repos/${owner}/${repo}/git/commits`, {
    token,
    method: 'POST',
    body: {
      message: commitMessage,
      tree: newTreeSha,
      parents: [parentCommitSha]
    }
  });
  const newCommitSha = newCommitResponse.sha;

  // Step 7: Update the ref
  return githubFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    token,
    method: 'PATCH',
    body: {
      sha: newCommitSha,
      force: true
    }
  });
}


