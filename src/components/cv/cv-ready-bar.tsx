'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

interface CvReadyBarProps {
  onDownload: () => void;
  disabled?: boolean;
  isExporting?: boolean;
  className?: string;
}

/** Prominent download CTA — visible without scrolling to preview footer. */
export function CvReadyBar({
  onDownload,
  disabled,
  isExporting,
  className = '',
}: CvReadyBarProps) {
  const t = useTranslations('cv');

  return (
    <div
      className={`px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${className}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-kazi-navy">{t('cvReadyTitle')}</p>
        <p className="text-xs text-gray-600 mt-0.5">{t('cvReadyHint')}</p>
      </div>
      <Button
        size="sm"
        className="shrink-0 w-full sm:w-auto bg-kazi-orange hover:bg-kazi-orange/90 text-white"
        disabled={disabled || isExporting}
        onClick={onDownload}
      >
        <Download className="h-4 w-4 mr-1.5" aria-hidden />
        {isExporting ? t('exportingPdf') : t('downloadPdf')}
      </Button>
    </div>
  );
}
