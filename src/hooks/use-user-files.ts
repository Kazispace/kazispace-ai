import { useCallback, useEffect, useState } from 'react';

import {
  deleteUserFile,
  fetchUserFiles,
  getFileDownloadUrl,
} from '@/lib/file-api';
import type { FileCategory, UserFile } from '@/types/user-files';

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

export function useUserFiles(
  initialCategory?: FileCategory
): UseUserFilesReturn {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FileCategory | undefined>(
    initialCategory
  );

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await fetchUserFiles(activeCategory);
    if (res.success && res.data) {
      setFiles(res.data.items);
    } else {
      setError(res.error ?? 'Failed to load files');
    }
    setIsLoading(false);
  }, [activeCategory]);

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
