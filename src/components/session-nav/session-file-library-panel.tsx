'use client';

import { useCallback, useState } from 'react';
import {
  Download,
  FileAudio,
  FileText,
  FolderOpen,
  Loader2,
  PanelLeftClose,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useUserFiles } from '@/hooks/use-user-files';
import { FILE_CATEGORY_TABS, formatFileDate, formatFileSize, resolveFileIconType } from '@/lib/file-utils';
import { cn } from '@/lib/utils';
import type { FileCategory, UserFile } from '@/types/user-files';

interface SessionFileLibraryPanelProps {
  locale: string;
  open: boolean;
  mobileDrawer: boolean;
  onClose: () => void;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const type = resolveFileIconType(mimeType);
  const base = 'h-9 w-9 shrink-0 rounded-lg p-1.5';
  switch (type) {
    case 'pdf':
      return (
        <div className={cn(base, 'bg-red-50 text-red-500')}>
          <FileText className="h-full w-full" />
        </div>
      );
    case 'doc':
      return (
        <div className={cn(base, 'bg-blue-50 text-blue-500')}>
          <FileText className="h-full w-full" />
        </div>
      );
    case 'audio':
      return (
        <div className={cn(base, 'bg-purple-50 text-purple-500')}>
          <FileAudio className="h-full w-full" />
        </div>
      );
    default:
      return (
        <div className={cn(base, 'bg-gray-50 text-gray-400')}>
          <FileText className="h-full w-full" />
        </div>
      );
  }
}

function DeleteConfirm({
  fileName,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('sessionNav');
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-xs font-medium text-red-700">{t('deleteConfirmTitle')}</p>
      <p className="text-xs text-red-600">
        {t('deleteConfirmBody', { name: fileName })}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1D2129] hover:bg-gray-50"
        >
          {t('deleteConfirmCancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
        >
          {t('deleteConfirmAction')}
        </button>
      </div>
    </div>
  );
}

function FileRow({
  file,
  onDownload,
  onDelete,
}: {
  file: UserFile;
  onDownload: (fileId: string) => void;
  onDelete: (fileId: string) => Promise<boolean>;
}) {
  const t = useTranslations('sessionNav');
  const [confirming, setConfirming] = useState(false);

  const handleDelete = useCallback(async () => {
    const ok = await onDelete(file.file_id);
    if (!ok) setConfirming(false);
  }, [file.file_id, onDelete]);

  if (confirming) {
    return (
      <DeleteConfirm
        fileName={file.filename}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#F7F8FA] transition-colors">
      <FileIcon mimeType={file.mime_type} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#1D2129]">{file.filename}</p>
        <p className="text-xs text-[#86909C]">
          {formatFileSize(file.size_bytes)} · {formatFileDate(file.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onDownload(file.file_id)}
          className="rounded p-1.5 text-[#86909C] hover:bg-[#E8F3FF] hover:text-blue-600"
          aria-label={t('downloadFile')}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded p-1.5 text-[#86909C] hover:bg-red-50 hover:text-red-500"
          aria-label={t('deleteFile')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="h-9 w-9 rounded-lg bg-gray-100" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/4 rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export function SessionFileLibraryPanel({
  open,
  mobileDrawer,
  onClose,
}: SessionFileLibraryPanelProps) {
  const t = useTranslations('sessionNav');
  const { files, isLoading, error, activeCategory, setActiveCategory, downloadFile, removeFile } =
    useUserFiles();

  const handleCategoryChange = useCallback(
    (catId: string) => {
      setActiveCategory(catId === 'all' ? undefined : (catId as FileCategory));
    },
    [setActiveCategory]
  );

  const panelBody = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[#E5E6EB] px-3 py-2">
        <h2 className="text-sm font-semibold text-[#1D2129]">{t('globalFileLibrary')}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#86909C] hover:bg-[#F2F3F5]"
          aria-label={t('collapsePanel')}
        >
          {mobileDrawer ? <X className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 border-b border-[#E5E6EB] px-3 py-1.5">
        {FILE_CATEGORY_TABS.map((tab) => {
          const isActive =
            tab.id === 'all' ? activeCategory === undefined : activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleCategoryChange(tab.id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-[#1D2129] text-white'
                  : 'text-[#86909C] hover:bg-[#F2F3F5] hover:text-[#1D2129]'
              )}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {isLoading ? (
          <div className="space-y-1">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-xs text-red-500">{t('loadFilesFailed')}</p>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <FolderOpen className="h-10 w-10 text-[#C9CDD4]" />
            <p className="text-sm font-medium text-[#86909C]">{t('noFiles')}</p>
            <p className="text-xs text-[#C9CDD4]">{t('noFilesHint')}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => (
              <FileRow
                key={file.file_id}
                file={file}
                onDownload={downloadFile}
                onDelete={removeFile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (mobileDrawer) {
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label={t('collapsePanel')}
          onClick={onClose}
        />
        <aside className="fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] shadow-xl md:hidden">
          {panelBody}
        </aside>
      </>
    );
  }

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        'hidden shrink-0 overflow-hidden border-r border-[#E5E6EB] transition-[width] duration-200 ease-out md:block',
        open ? 'w-[260px]' : 'w-0'
      )}
    >
      <div className="h-full w-[260px]">{panelBody}</div>
    </aside>
  );
}
