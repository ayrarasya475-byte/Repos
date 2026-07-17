import JSZip from 'jszip';
import { UploadFile } from '../types';

function mimeTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': case 'htm': return 'text/html';
    case 'css': return 'text/css';
    case 'js': case 'mjs': return 'application/javascript';
    case 'jsx': return 'text/jsx';
    case 'ts': return 'application/typescript';
    case 'tsx': return 'text/tsx';
    case 'json': return 'application/json';
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'md': return 'text/markdown';
    case 'txt': return 'text/plain';
    case 'zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

/**
 * Extracts files from a ZIP UploadFile using JSZip.
 */
export async function extractZipFile(zipUploadFile: UploadFile): Promise<UploadFile[]> {
  const extractedFiles: UploadFile[] = [];
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipUploadFile.file);
    const promises: Promise<void>[] = [];

    loadedZip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;

      const promise = zipEntry.async('blob').then((blob) => {
        const fileObject = new File([blob], zipEntry.name, {
          type: mimeTypeFromName(zipEntry.name),
        });

        extractedFiles.push({
          id: crypto.randomUUID(),
          name: fileObject.name,
          path: relativePath,
          size: fileObject.size,
          type: fileObject.type,
          file: fileObject,
          status: 'pending',
          progress: 0,
        });
      });
      promises.push(promise);
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to extract ZIP file:', error);
    throw new Error(`Failed to parse ZIP file: ${(error as Error).message}`);
  }
  return extractedFiles;
}

/**
 * Checks a list of selected files and extracts any files that are ZIP files.
 * Returns a flattened array of non-ZIP files and extracted files.
 */
export async function processSelectedFiles(files: UploadFile[]): Promise<UploadFile[]> {
  const processed: UploadFile[] = [];
  
  for (const file of files) {
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    if (isZip) {
      try {
        const extracted = await extractZipFile(file);
        processed.push(...extracted);
      } catch (err: any) {
        console.error('Failed to auto-extract ZIP file:', err);
        // Fallback: keep the ZIP file as-is if extraction failed
        processed.push(file);
      }
    } else {
      processed.push(file);
    }
  }

  return processed;
}

/**
 * Recursively extracts files from a FileSystemEntry (file or directory)
 * and keeps track of their relative paths.
 */
export async function traverseEntry(
  entry: FileSystemEntry,
  path: string = ''
): Promise<UploadFile[]> {
  const files: UploadFile[] = [];

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });

    const relativePath = path ? `${path}/${file.name}` : file.name;

    files.push({
      id: crypto.randomUUID(),
      name: file.name,
      path: relativePath,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file,
      status: 'pending',
      progress: 0,
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();

    // Read all entries in this directory (handling pagination if needed)
    const readAllEntries = async (): Promise<FileSystemEntry[]> => {
      const allEntries: FileSystemEntry[] = [];
      const readBatch = (): Promise<FileSystemEntry[]> => {
        return new Promise((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
      };

      let batch = await readBatch();
      while (batch.length > 0) {
        allEntries.push(...batch);
        batch = await readBatch();
      }
      return allEntries;
    };

    const entries = await readAllEntries();
    const newPath = path ? `${path}/${entry.name}` : entry.name;

    for (const subEntry of entries) {
      const subFiles = await traverseEntry(subEntry, newPath);
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Handles drag and drop DataTransferItemList to recursively extract all files
 */
export async function getFilesFromDataTransfer(
  items: DataTransferItemList
): Promise<UploadFile[]> {
  const files: UploadFile[] = [];
  const entries: FileSystemEntry[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        entries.push(entry);
      }
    }
  }

  for (const entry of entries) {
    const entryFiles = await traverseEntry(entry);
    files.push(...entryFiles);
  }

  return files;
}

/**
 * Handles files selected via <input type="file" webkitdirectory>
 */
export function getFilesFromFileInput(
  fileList: FileList
): UploadFile[] {
  const files: UploadFile[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    
    // webkitRelativePath contains the full relative path from the selected root folder, e.g., "my-folder/src/App.tsx"
    // If it's not defined, fall back to file name
    const relativePath = file.webkitRelativePath || file.name;

    files.push({
      id: crypto.randomUUID(),
      name: file.name,
      path: relativePath,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file,
      status: 'pending',
      progress: 0,
    });
  }

  return files;
}
