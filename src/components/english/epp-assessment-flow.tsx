'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EppSampleJobsPanel } from '@/components/english/epp-sample-jobs-panel';
import { useEnglishAssessment } from '@/hooks/use-english-assessment';
import { invalidateEnglishProfile } from '@/hooks/use-english-profile';
import type { EnglishAssessmentItem, EnglishOnboardingRequest } from '@/types';

interface EppAssessmentFlowProps {
  locale: string;
  onboarding?: EnglishOnboardingRequest;
}

type Step = 'items' | 'scoring' | 'aha';

function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      setBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setBlob(null);
  }, []);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    setIsRecording(false);
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setIsRecording(false);
  }, []);

  return { isRecording, blob, start, stop, reset };
}

export function EppAssessmentFlow({ locale, onboarding }: EppAssessmentFlowProps) {
  const t = useTranslations('english.assessment');
  const router = useRouter();
  const queryClient = useQueryClient();
  const recorder = useAudioRecorder();
  const [itemIndex, setItemIndex] = useState(0);
  const [writingText, setWritingText] = useState('');
  const [textFallback, setTextFallback] = useState('');
  const [step, setStep] = useState<Step>('items');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    session,
    startQuickAssessment,
    submitItem,
    completeAssessment,
    result,
    isCreating,
    isScoring,
    error,
  } = useEnglishAssessment();

  useEffect(() => {
    if (!session && !isCreating) {
      void startQuickAssessment(onboarding);
    }
  }, [session, isCreating, onboarding, startQuickAssessment]);

  const items = session?.items ?? [];
  const current: EnglishAssessmentItem | undefined = items[itemIndex];
  const total = items.length || 3;

  const handleNext = async () => {
    if (!current) return;
    setSubmitError(null);
    try {
      if (current.type === 'speaking') {
        const audio = recorder.blob;
        if (!audio && !textFallback.trim()) {
          setSubmitError(t('recordingRequired'));
          return;
        }
        if (audio) {
          await submitItem({
            item_index: current.index,
            type: 'speaking',
            audio,
            transcript: textFallback.trim() || undefined,
          });
        }
        recorder.reset();
        setTextFallback('');
      } else {
        await submitItem({
          item_index: current.index,
          type: 'writing',
          text: writingText,
        });
      }

      if (itemIndex + 1 < items.length) {
        setItemIndex(itemIndex + 1);
        return;
      }

      setStep('scoring');
      await completeAssessment();
      await invalidateEnglishProfile(queryClient);
      setStep('aha');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('submitFailed'));
    }
  };

  if (isCreating || !session) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (step === 'scoring' || isScoring) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
        <p className="text-sm text-gray-600">{t('scoring')}</p>
      </div>
    );
  }

  if (step === 'aha' && result) {
    return (
      <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
        <Card>
          <CardContent className="p-5 text-center space-y-3">
            <p className="text-xs text-gray-500">{t('ahaTitle')}</p>
            <p className="text-4xl font-bold text-kazi-navy">
              L{result.profile.display_level}
            </p>
            <p className="text-sm text-gray-600">{result.profile.level_name}</p>
            <p className="text-xs text-amber-700">{t('quickDisclaimer')}</p>
          </CardContent>
        </Card>
        {result.sample_jobs && <EppSampleJobsPanel sampleJobs={result.sample_jobs} />}
        <Button
          className="w-full"
          onClick={() => router.push(`/${locale}/english/training`)}
        >
          {t('startTraining')}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.push(`/${locale}/english`)}
        >
          {t('viewPassport')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
      <div>
        <p className="text-xs text-gray-500">
          {t('progress', { current: itemIndex + 1, total })}
        </p>
        <h1 className="text-lg font-bold text-kazi-navy mt-1">{t('title')}</h1>
      </div>

      {current && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-kazi-navy">{current.prompt}</p>

            {current.type === 'speaking' ? (
              <div className="space-y-3">
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
                {recorder.blob && (
                  <p className="text-xs text-green-600">{t('recordingReady')}</p>
                )}
                <textarea
                  className="w-full text-sm border border-gray-200 rounded-lg p-3 min-h-[80px]"
                  placeholder={t('textFallbackPlaceholder')}
                  value={textFallback}
                  onChange={(e) => setTextFallback(e.target.value)}
                />
              </div>
            ) : (
              <textarea
                className="w-full text-sm border border-gray-200 rounded-lg p-3 min-h-[120px]"
                placeholder={t('writingPlaceholder')}
                value={writingText}
                onChange={(e) => setWritingText(e.target.value)}
              />
            )}

            {(submitError || error) && (
              <p className="text-xs text-red-600">{submitError ?? error}</p>
            )}

            <Button className="w-full" onClick={() => void handleNext()}>
              {itemIndex + 1 < items.length ? t('next') : t('finish')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
