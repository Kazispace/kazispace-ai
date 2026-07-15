'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Download, Eye, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { fetchCvVersions, getCvVersionDownloadUrl, type CvVersion } from '@/lib/cv-version-api';
import { formatFileDate, formatFileSize } from '@/lib/file-utils';
import { cn } from '@/lib/utils';

interface CvVersionListProps {
  className?: string;
}

export function CvVersionList({ className }: CvVersionListProps) {
  const t = useTranslations('cv');
  const [versions, setVersions] = useState<CvVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchCvVersions();
      if (cancelled) return;
      if (res.success && res.data) {
        setVersions(res.data.versions);
      } else {
        setError(res.error ?? 'Failed to load versions');
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDownload = useCallback(async (versionId: string) => {
    const res = await getCvVersionDownloadUrl(versionId);
    if (res.success && res.data) {
      window.open(res.data.download_url, '_blank', 'noopener');
    }
  }, []);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center py-12 text-sm text-red-500', className)}>
        {error}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <p className="text-sm text-gray-500">{t('noVersions')}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3 p-4', className)}>
      {versions.map((v) => (
        <div
          key={v.file_id}
          className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#1D2129]">
                v{v.version_number}
              </span>
              {v.is_current && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  <Badge className="h-3 w-3" />
                  {t('currentVersion')}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#86909C]">
              {formatFileDate(v.created_at)} · {formatFileSize(v.size_bytes)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => void handleDownload(v.file_id)}
              className="rounded-lg p-2 text-[#86909C] hover:bg-blue-50 hover:text-blue-600 transition-colors"
              aria-label={t('downloadPdf')}
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-[#86909C] hover:bg-gray-100 hover:text-[#1D2129] transition-colors"
              aria-label={t('previewTitle')}
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
