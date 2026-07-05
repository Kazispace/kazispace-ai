'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { IrpDimensionBars } from '@/components/interview/irp-dimension-bars';
import { useInterviewProfile } from '@/hooks/use-interview-profile';
import type { InterviewProfile } from '@/types';

interface IrpDiagnosisUpdateProps {
  enabled: boolean;
  baselineUpdatedAt?: string | null;
}

const MAX_POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2000;

export function IrpDiagnosisUpdate({ enabled, baselineUpdatedAt }: IrpDiagnosisUpdateProps) {
  const t = useTranslations('interview.irp');
  const { profile, loadProfileFresh, profileStatus } = useInterviewProfile({
    enabled,
  });
  const [polledProfile, setPolledProfile] = useState<InterviewProfile | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    attemptsRef.current = 0;
    setIsPolling(true);
    setPolledProfile(null);

    const poll = async () => {
      attemptsRef.current += 1;
      try {
        const next = await loadProfileFresh();
        const hasDelta =
          next.dimensions &&
          Object.values(next.dimensions).some(
            (d) => d?.delta_last_round != null && d.delta_last_round !== 0
          );
        const updated =
          baselineUpdatedAt != null
            ? next.updated_at != null && next.updated_at !== baselineUpdatedAt
            : hasDelta;

        if (updated || attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setPolledProfile(next);
          setIsPolling(false);
          return;
        }
      } catch {
        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setIsPolling(false);
          return;
        }
      }

      timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [baselineUpdatedAt, enabled, loadProfileFresh]);

  const displayProfile = polledProfile ?? profile;
  const status = displayProfile?.profile_status ?? profileStatus;

  if (!enabled) return null;

  if (isPolling && !displayProfile?.dimensions) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-xl self-start">
        <p className="text-xs text-gray-500">{t('diagnosis.updating')}</p>
      </div>
    );
  }

  if (!displayProfile?.dimensions) return null;

  const hasDeltas = Object.values(displayProfile.dimensions).some(
    (d) => d?.delta_last_round != null && d.delta_last_round !== 0
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 max-w-xl self-start space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase">{t('diagnosis.title')}</h4>
        {status === 'provisional' && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 mt-2">
            {t('provisionalBannerShort')}
          </p>
        )}
        {hasDeltas && (
          <p className="text-xs text-gray-600 mt-1">{t('diagnosis.deltaHint')}</p>
        )}
      </div>
      <IrpDimensionBars
        dimensions={displayProfile.dimensions}
        profileStatus={status ?? 'formal'}
        showDelta
        compact
      />
    </div>
  );
}
