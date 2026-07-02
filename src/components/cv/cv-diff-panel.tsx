'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { CvDiffPayload } from '@/types/cv-contract';

interface CvDiffPanelProps {
  diff: CvDiffPayload;
  onConfirm: () => void;
  onRegenerate: () => void;
  disabled?: boolean;
}

function DiffList({
  title,
  items,
  variant,
}: {
  title: string;
  items: CvDiffPayload['added'];
  variant: 'added' | 'removed' | 'modified';
}) {
  if (!items?.length) return null;

  const color =
    variant === 'added'
      ? 'text-green-700 bg-green-50 border-green-100'
      : variant === 'removed'
        ? 'text-red-700 bg-red-50 border-red-100'
        : 'text-amber-800 bg-amber-50 border-amber-100';

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.section}-${i}`}
            className={`text-sm rounded-lg border px-3 py-2 ${color}`}
          >
            <span className="font-medium">{item.section}</span>
            {variant === 'modified' && item.before && item.after ? (
              <div className="mt-1 text-xs space-y-1">
                <p className="line-through opacity-70">{item.before}</p>
                <p>{item.after}</p>
              </div>
            ) : item.text ? (
              <p className="mt-1 text-xs">{item.text}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CvDiffPanel({ diff, onConfirm, onRegenerate, disabled }: CvDiffPanelProps) {
  const t = useTranslations('cv');
  const hasChanges =
    (diff.added?.length ?? 0) > 0 ||
    (diff.removed?.length ?? 0) > 0 ||
    (diff.modified?.length ?? 0) > 0;

  if (!hasChanges) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-kazi-navy text-sm">{t('diffTitle')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('diffSubtitle')}</p>
      </div>

      <DiffList title={t('diffAdded')} items={diff.added} variant="added" />
      <DiffList title={t('diffRemoved')} items={diff.removed} variant="removed" />
      <DiffList title={t('diffModified')} items={diff.modified} variant="modified" />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={onConfirm} disabled={disabled}>
          {t('confirmChanges')}
        </Button>
        <Button size="sm" variant="outline" onClick={onRegenerate} disabled={disabled}>
          {t('regenerate')}
        </Button>
      </div>
    </div>
  );
}
