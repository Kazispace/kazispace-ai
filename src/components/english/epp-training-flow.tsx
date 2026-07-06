'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useEnglishTraining } from '@/hooks/use-english-training';
import { invalidateEnglishProfile } from '@/hooks/use-english-profile';
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

  const { session, startTraining, submitResponse, phase, error, isCreating, isScoring } =
    useEnglishTraining();

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [textFallback, setTextFallback] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!session && !isCreating) {
      void startTraining(scenarioId);
    }
  }, [session, isCreating, scenarioId, startTraining]);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
      stream.getTracks().forEach((track) => track.stop());
    };
    mediaRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setAudioBlob(null);
  }, []);

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!audioBlob && !textFallback.trim()) {
      setSubmitError(t('recordingRequired'));
      return;
    }
    if (!audioBlob) {
      setSubmitError(t('audioRequired'));
      return;
    }
    try {
      const completed = await submitResponse({
        item_index: 0,
        audio: audioBlob,
        transcript: textFallback.trim() || undefined,
      });
      await invalidateEnglishProfile(queryClient);
      if (completed.feedback) {
        // stay on feedback view
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('submitFailed'));
    }
  };

  if (isCreating || (!session && phase !== 'error')) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
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

  if (phase === 'done' && session?.feedback) {
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
    <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
      <div>
        <h1 className="text-lg font-bold text-kazi-navy">{t('title')}</h1>
        <p className="text-xs text-gray-500 mt-1">{t('scenarioHint')}</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm text-kazi-navy">{t('prompt')}</p>
          <div className="flex gap-2">
            {!isRecording ? (
              <Button type="button" variant="secondary" onClick={() => void startRecording()}>
                {t('startRecording')}
              </Button>
            ) : (
              <Button type="button" onClick={stopRecording}>
                {t('stopRecording')}
              </Button>
            )}
          </div>
          {audioBlob && <p className="text-xs text-green-600">{t('recordingReady')}</p>}
          <textarea
            className="w-full text-sm border border-gray-200 rounded-lg p-3 min-h-[80px]"
            placeholder={t('textFallbackPlaceholder')}
            value={textFallback}
            onChange={(e) => setTextFallback(e.target.value)}
          />
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
