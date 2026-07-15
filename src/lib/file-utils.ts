import type { FileCategory } from '@/types/user-files';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatFileDate(isoDate: string, locale?: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString(locale || undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type FileIconType = 'pdf' | 'doc' | 'audio' | 'image' | 'other';

export function resolveFileIconType(mimeType: string): FileIconType {
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/plain'
  )
    return 'doc';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

/** Maps backend categories to UI filter tabs */
export const FILE_CATEGORY_TABS: {
  id: FileCategory | 'all';
  labelKey: string;
}[] = [
  { id: 'all', labelKey: 'allFiles' },
  { id: 'cv/uploads', labelKey: 'categoryCvUploads' },
  { id: 'cv/generated', labelKey: 'categoryCvGenerated' },
  { id: 'documents', labelKey: 'categoryDocument' },
  { id: 'interview/audio', labelKey: 'categoryRecording' },
];
