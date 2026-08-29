'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import type { IrpProfileHistoryItem } from '@/types';

interface IrpGrowthHistoryProps {
  items: IrpProfileHistoryItem[];
  badges?: Array<{ badge_id: string; label: string; earned_at?: string }>;
  isPro?: boolean;
}

function buildPoints(items: IrpProfileHistoryItem[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted.map((item, index) => ({
    x: index,
    level: item.level ?? 0,
    score: item.composite_score ?? 0,
    version: item.version,
    createdAt: item.created_at,
  }));
}

export function IrpGrowthHistory({ items, badges = [], isPro = false }: IrpGrowthHistoryProps) {
  const t = useTranslations('interview.irp');

  const points = useMemo(() => buildPoints(items), [items]);

  const width = 320;
  const height = 140;
  const padding = { top: 12, right: 12, bottom: 24, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxLevel = Math.max(5, ...points.map((p) => p.level), 1);
  const pathD =
    points.length > 0
      ? points
          .map((p, i) => {
            const x = padding.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
            const y = padding.top + innerH - (p.level / maxLevel) * innerH;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          })
          .join(' ')
      : '';

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-center">
          <p className="text-sm text-gray-600">{t('growth.empty')}</p>
        </CardContent>
      </Card>
    );
  }

  const sortedItems = [...items].sort((a, b) => b.version - a.version);
  const showChart = points.length >= 3;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-4">
          {showChart ? (
            <>
              <div>
                <h3 className="text-sm font-semibold text-kazi-navy">{t('growth.levelCurve')}</h3>
                <p className="text-xs text-gray-500">{t('growth.levelCurveHint')}</p>
              </div>
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full max-w-md mx-auto"
                role="img"
                aria-label={t('growth.levelCurve')}
              >
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const y = padding.top + innerH - (lvl / maxLevel) * innerH;
                  return (
                    <g key={lvl}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <text x={4} y={y + 4} fontSize="9" fill="#9ca3af">
                        L{lvl}
                      </text>
                    </g>
                  );
                })}
                {pathD && (
                  <>
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {points.map((p, i) => {
                      const x =
                        padding.left +
                        (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
                      const y = padding.top + innerH - (p.level / maxLevel) * innerH;
                      return (
                        <g key={p.version}>
                          <circle cx={x} cy={y} r="4" fill="#f97316" />
                          <text
                            x={x}
                            y={height - 4}
                            fontSize="8"
                            fill="#9ca3af"
                            textAnchor="middle"
                          >
                            {t('growth.roundLabel', { n: i + 1 })}
                          </text>
                        </g>
                      );
                    })}
                  </>
                )}
              </svg>
            </>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-kazi-navy">{t('growth.recentRounds')}</h3>
              <p className="text-xs text-gray-500">{t('growth.chartNeedsMore')}</p>
            </div>
          )}
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {sortedItems.map((item, index) => (
              <li
                key={item.version}
                className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
              >
                <span className="text-gray-600">
                  {t('growth.roundLabel', { n: sortedItems.length - index })}
                </span>
                <span className="font-medium text-kazi-navy">
                  {t('growth.levelScore', {
                    level: item.level ?? '—',
                    score: item.composite_score?.toFixed(1) ?? '—',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isPro && badges.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-kazi-navy mb-3">{t('growth.badges')}</h3>
            <ul className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <li
                  key={badge.badge_id}
                  className="text-xs bg-primary/10 text-kazi-navy border border-primary/20 rounded-full px-3 py-1"
                >
                  {badge.label}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!isPro && (
        <p className="text-xs text-gray-500 text-center px-4">{t('growth.proHint')}</p>
      )}
    </div>
  );
}
