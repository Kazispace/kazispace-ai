import { useCallback, useEffect, useState } from 'react';

import {
  deleteUserFile,
  fetchUserFiles,
  getFileDownloadUrl,
} from '@/lib/file-api';
import type { FileCategory, UserFile } from '@/types/user-files';

interface UseUserFilesOptions {
  /** Skip fetching until auth is ready / user is logged in. */
  enabled?: boolean;
}

interface UseUserFilesReturn {
  files: UserFile[];
  isLoading: boolean;
  error: string | null;
  activeCategory: FileCategory | undefined;
  setActiveCategory: (category: FileCategory | undefined) => void;
  refresh: () => Promise<void>;
  downloadFile: (fileId: string) => Promise<void>;
  removeFile: (fileId: string) => Promise<boolean>;
}

function normalizeItems(data: unknown): UserFile[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as UserFile[]) : [];
}

async function fetchWithRetry(
  category: FileCategory | undefined,
  attempts = 2
): Promise<Awaited<ReturnType<typeof fetchUserFiles>>> {
  let last = await fetchUserFiles(category);
  for (let i = 1; i < attempts; i++) {
    if (last.success && last.data) return last;
    const status = last.status;
    const retryable =
      last.errorCode === 'NETWORK_ERROR' ||
      (typeof status === 'number' && status >= 500) ||
      (typeof last.error === 'string' && /HTTP 5\d\d|Network|Failed to fetch/i.test(last.error));
    if (!retryable) return last;
    await new Promise((r) => setTimeout(r, 400 * i));
    last = await fetchUserFiles(category);
  }
  return last;
}

export function useUserFiles(
  initialCategory?: FileCategory,
  options?: UseUserFilesOptions
): UseUserFilesReturn {
  const enabled = options?.enabled ?? true;
  const [files, setFiles] = useState<UserFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FileCategory | undefined>(
    initialCategory
  );

  const loadFiles = useCallback(async () => {
    if (!enabled) {
      setFiles([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await fetchWithRetry(activeCategory);
    if (res.success && res.data) {
      setFiles(normalizeItems(res.data));
      setError(null);
    } else {
      setFiles([]);
      setError(res.error ?? 'Failed to load files');
    }
    setIsLoading(false);
  }, [activeCategory, enabled]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const downloadFile = useCallback(async (fileId: string) => {
    const res = await getFileDownloadUrl(fileId);
    if (res.success && res.data) {
      window.open(res.data.download_url, '_blank', 'noopener');
    }
  }, []);

  const removeFile = useCallback(
    async (fileId: string): Promise<boolean> => {
      setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
      const res = await deleteUserFile(fileId);
      if (!res.success) {
        void loadFiles();
        return false;
      }
      return true;
    },
    [loadFiles]
  );

  return {
    files,
    isLoading,
    error,
    activeCategory,
    setActiveCategory,
    refresh: loadFiles,
    downloadFile,
    removeFile,
  };
}
