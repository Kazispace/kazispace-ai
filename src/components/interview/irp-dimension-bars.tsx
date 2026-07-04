'use client';

import { useTranslations } from 'next-intl';

import { IRP_DIMENSION_ORDER } from '@/types';
import type { IrpDimensions, InterviewProfileStatus } from '@/types';

interface IrpDimensionBarsProps {
  dimensions?: Partial<IrpDimensions>;
  profileStatus?: InterviewProfileStatus;
  showDelta?: boolean;
  compact?: boolean;
}

function barTone(score: number) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-400';
}

function deltaTone(delta: number) {
  if (delta > 0) return 'text-green-600';
  if (delta < 0) return 'text-red-600';
  return 'text-gray-400';
}

function formatDelta(delta: number) {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}`;
}

export function IrpDimensionBars({
  dimensions,
  profileStatus = 'formal',
  showDelta = false,
  compact = false,
}: IrpDimensionBarsProps) {
  const t = useTranslations('interview.irp');

  const isMuted = profileStatus === 'provisional' || profileStatus === 'empty';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {IRP_DIMENSION_ORDER.map((key) => {
        const dim = dimensions?.[key];
        const score = dim?.score ?? 0;
        const label = dim?.label ?? t(`dimensions.${key}`);
        const delta = dim?.delta_last_round;

        return (
          <div key={key}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span
                className={`text-xs font-medium ${isMuted ? 'text-gray-400' : 'text-gray-700'}`}
              >
                {label}
              </span>
              <div className="flex items-center gap-2">
                {showDelta && delta != null && delta !== 0 && (
                  <span className={`text-[10px] font-semibold ${deltaTone(delta)}`}>
                    {formatDelta(delta)}
                  </span>
                )}
                <span
                  className={`text-xs tabular-nums ${isMuted ? 'text-gray-400' : 'text-kazi-navy font-semibold'}`}
                >
                  {isMuted ? '—' : score}
                </span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isMuted ? 'bg-gray-300' : barTone(score)
                }`}
                style={{ width: isMuted ? '0%' : `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
