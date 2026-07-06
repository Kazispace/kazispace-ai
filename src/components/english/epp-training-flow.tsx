'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useEnglishTraining } from '@/hooks/use-english-training';
import { invalidateEnglishEppCaches } from '@/hooks/use-english-profile';
import { DEFAULT_ENGLISH_SCENARIO_ID } from '@/types';

interface EppTrainingFlowProps {
  locale: string;
}

export function EppTrainingFlow({ locale }: EppTrainingFlowProps) {
  const t = useTranslations('english.training');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const scenarioId = searchParams.get('scenario') ?? DEFAULT_ENGLISH_SCENARIO_ID;
  const startAttemptedRef = useRef(false);
  const recorder = useAudioRecorder();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    session,
    startTraining,
    submitResponse,
    retryPollFeedback,
    resetTraining,
    audioPosted,
    phase,
    error,
    isCreating,
    isScoring,
  } = useEnglishTraining();

  useEffect(() => {
    if (session || isCreating || phase === 'error' || startAttemptedRef.current) {
      return;
    }
    startAttemptedRef.current = true;
    void startTraining(scenarioId).catch(() => {
      startAttemptedRef.current = false;
    });
  }, [session, isCreating, phase, scenarioId, startTraining]);

  const promptText =
    session?.prompt ??
    session?.items?.[0]?.prompt ??
    t('prompt');

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!recorder.blob) {
      setSubmitError(t('recordingRequired'));
      return;
    }
    try {
      await submitResponse({
        item_index: 0,
        audio: recorder.blob,
        transcript: undefined,
      });
      await invalidateEnglishEppCaches(queryClient);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('submitFailed'));
    }
  };

  const handleRetry = async () => {
    if (audioPosted) {
      setSubmitError(null);
      try {
        await retryPollFeedback();
        await invalidateEnglishEppCaches(queryClient);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : t('submitFailed'));
      }
      return;
    }
    await handleSubmit();
  };

  const handleRetryStart = () => {
    startAttemptedRef.current = false;
    resetTraining();
    recorder.reset();
    setSubmitError(null);
  };

  if (isCreating || (!session && phase !== 'error')) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === 'error' && !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 text-center">
        <p className="text-sm text-red-600">{error ?? submitError ?? t('submitFailed')}</p>
        <Button size="sm" onClick={handleRetryStart}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (isScoring) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
        <p className="text-sm text-gray-600">{t('scoring')}</p>
      </div>
    );
  }

  if (phase === 'done') {
    if (session?.feedback) {
      return (
        <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
          <Card>
            <CardContent className="p-5 space-y-3">
              <h2 className="text-sm font-semibold text-kazi-navy">{t('feedbackTitle')}</h2>
              <p className="text-sm text-gray-700">{session.feedback.summary}</p>
              {session.profile_delta?.dimensions?.speaking?.delta_last_event != null && (
                <p className="text-xs text-green-600">
                  {t('speakingDelta', {
                    delta: session.profile_delta.dimensions.speaking.delta_last_event.toFixed(1),
                  })}
                </p>
              )}
            </CardContent>
          </Card>
          <Button className="w-full" onClick={() => router.push(`/${locale}/english`)}>
            {t('backToPassport')}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 text-center">
        <p className="text-sm text-gray-600">{t('submitFailed')}</p>
        <Button size="sm" onClick={() => router.push(`/${locale}/english`)}>
          {t('backToPassport')}
        </Button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 text-center">
        <p className="text-sm text-red-600">{submitError ?? error ?? t('submitFailed')}</p>
        <Button size="sm" onClick={() => void handleRetry()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
      <div>
        <h1 className="text-lg font-bold text-kazi-navy">{t('title')}</h1>
        <p className="text-xs text-gray-500 mt-1">{t('scenarioHint')}</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm text-kazi-navy">{promptText}</p>
          <div className="flex gap-2">
            {!recorder.isRecording ? (
              <Button type="button" variant="secondary" onClick={() => void recorder.start()}>
                {t('startRecording')}
              </Button>
            ) : (
              <Button type="button" onClick={recorder.stop}>
                {t('stopRecording')}
              </Button>
            )}
          </div>
          {recorder.blob && <p className="text-xs text-green-600">{t('recordingReady')}</p>}
          {recorder.micError && (
            <p className="text-xs text-red-600">{t('micDenied')}</p>
          )}
          {(submitError || error) && (
            <p className="text-xs text-red-600">{submitError ?? error}</p>
          )}
          <Button className="w-full" onClick={() => void handleSubmit()}>
            {t('submit')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
