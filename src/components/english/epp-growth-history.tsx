'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import type { EnglishProfileHistoryItem } from '@/types';

interface EppGrowthHistoryProps {
  items: EnglishProfileHistoryItem[];
}

function buildPoints(items: EnglishProfileHistoryItem[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted.map((item, index) => ({
    x: index,
    level: item.display_level,
    score: item.composite_score ?? 0,
    version: item.version,
  }));
}

export function EppGrowthHistory({ items }: EppGrowthHistoryProps) {
  const t = useTranslations('english.growth');
  const points = useMemo(() => buildPoints(items), [items]);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <p className="text-sm text-gray-600">{t('empty')}</p>
        </CardContent>
      </Card>
    );
  }

  const sortedItems = [...items].sort((a, b) => b.version - a.version);
  const maxLevel = Math.max(5, ...points.map((p) => p.level), 1);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-kazi-navy">{t('levelCurve')}</h3>
          <p className="text-xs text-gray-500">{t('levelCurveHint')}</p>
        </div>

        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {sortedItems.map((item, index) => (
            <li
              key={item.version}
              className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
            >
              <span className="text-gray-600">
                {t('eventLabel', { n: sortedItems.length - index, type: item.source_type })}
              </span>
              <span className="font-medium text-kazi-navy">
                {t('levelScore', {
                  level: item.display_level,
                  score: item.composite_score?.toFixed(1) ?? '—',
                })}
              </span>
            </li>
          ))}
        </ul>

        {points.length >= 2 && (
          <p className="text-[10px] text-gray-400 text-center">
            {t('maxLevelHint', { max: maxLevel })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
