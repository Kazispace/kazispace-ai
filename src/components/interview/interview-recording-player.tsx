'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Headphones,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  fetchInterviewRecordings,
  getRecordingAudioUrl,
  type InterviewRecording,
  type TranscriptEntry,
} from '@/lib/interview-recording-api';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'text-green-700 bg-green-50' : score >= 60 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', color)}>
      Score: {score}/100
    </span>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-[#86909C]">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-12 text-right text-xs font-medium text-[#1D2129]">{score}/100</span>
    </div>
  );
}

function TranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  const t = useTranslations('interview');
  if (entries.length === 0) {
    return <p className="py-8 text-center text-xs text-[#86909C]">{t('noTranscript')}</p>;
  }
  return (
    <div className="space-y-3 p-4">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2">
          <span className="w-10 shrink-0 text-[10px] tabular-nums text-[#C9CDD4]">
            [{formatDuration(entry.timestamp)}]
          </span>
          <div>
            <span className={cn('text-xs font-medium', entry.speaker === 'interviewer' ? 'text-[#1D2129]' : 'text-kazi-orange')}>
              {entry.speaker === 'interviewer' ? t('interviewer') : t('you')}:
            </span>{' '}
            <span className="text-xs text-[#4E5969]">{entry.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordingCard({
  recording,
  isSelected,
  onSelect,
}: {
  recording: InterviewRecording;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const scoreColor =
    recording.score == null
      ? 'border-l-gray-300'
      : recording.score >= 75
        ? 'border-l-green-500'
        : recording.score >= 60
          ? 'border-l-amber-400'
          : 'border-l-red-400';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl border-l-4 bg-white p-4 text-left shadow-sm transition-colors',
        scoreColor,
        isSelected ? 'ring-2 ring-kazi-orange/30' : 'hover:bg-[#F7F8FA]'
      )}
    >
      <p className="text-sm font-semibold text-[#1D2129]">{recording.session_title}</p>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-[#86909C]">
        <span className="flex items-center gap-1">
          <Play className="h-3 w-3" />
          {formatDuration(recording.duration_seconds)}
        </span>
        <span>
          {new Date(recording.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
      {recording.score != null && (
        <div className="mt-2">
          <ScoreBadge score={recording.score} />
        </div>
      )}
    </button>
  );
}

function PlayerExpanded({
  recording,
  onCollapse,
}: {
  recording: InterviewRecording;
  onCollapse: () => void;
}) {
  const t = useTranslations('interview');
  const [activeTab, setActiveTab] = useState<'transcript' | 'feedback'>('transcript');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSec, setDurationSec] = useState(recording.duration_seconds);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPause = useCallback(async () => {
    if (!audioRef.current && recording.audio_url) {
      audioRef.current = new Audio(recording.audio_url);
      audioRef.current.playbackRate = speed;
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) setCurrentTime(Math.floor(audioRef.current.currentTime));
      };
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
          setDurationSec(Math.max(0, Math.round(audioRef.current.duration)));
        }
      };
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (!audioRef.current) {
      setIsPlaying(!isPlaying);
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      await audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, recording.audio_url, speed]);

  const skip = useCallback((delta: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime + delta);
    } else {
      setCurrentTime((t) => Math.max(0, Math.min(durationSec, t + delta)));
    }
  }, [durationSec]);

  const cycleSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2, 0.5];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, [speed]);

  const handleDownload = useCallback(async () => {
    const res = await getRecordingAudioUrl(recording.file_id);
    if (res.success && res.data) {
      window.open(res.data.audio_url, '_blank', 'noopener');
    }
  }, [recording.file_id]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200/80 px-4 py-3">
        <p className="text-sm font-semibold text-[#1D2129]">{recording.session_title}</p>
        <button type="button" onClick={onCollapse} className="text-[#86909C] hover:text-[#1D2129]">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Player controls */}
      <div className="flex flex-col items-center gap-3 border-b border-gray-200/80 px-4 py-4">
        <p className="text-sm tabular-nums text-kazi-orange">
          {formatDuration(currentTime)} / {formatDuration(durationSec)}
        </p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => skip(-15)} className="text-[#86909C] hover:text-[#1D2129]">
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void handlePlayPause()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-kazi-orange text-white hover:bg-kazi-orange/90"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <button type="button" onClick={() => skip(15)} className="text-[#86909C] hover:text-[#1D2129]">
            <RotateCw className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-[#1D2129] hover:bg-gray-50"
          >
            {speed}x
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200/80">
        {(['transcript', 'feedback'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              activeTab === tab ? 'border-b-2 border-kazi-orange text-kazi-orange' : 'text-[#86909C] hover:text-[#1D2129]'
            )}
          >
            {tab === 'transcript' ? t('transcript') : t('feedback')}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'transcript' ? (
          <TranscriptView entries={recording.transcript ?? []} />
        ) : (
          <div className="space-y-4 p-4">
            {recording.score != null && (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-[#86909C]">{t('overallScore')}</p>
                <p className="text-3xl font-bold text-[#1D2129]">{recording.score}<span className="text-lg text-[#86909C]">/100</span></p>
              </div>
            )}
            {recording.category_scores && (
              <div className="space-y-2.5">
                {Object.entries(recording.category_scores).map(([key, val]) => (
                  <ScoreBar key={key} label={key} score={val} />
                ))}
              </div>
            )}
            {recording.ai_feedback && (
              <div className="rounded-lg bg-[#F7F8FA] p-3">
                <p className="text-xs font-medium text-[#1D2129] mb-1">{t('aiFeedback')}</p>
                <p className="text-xs text-[#4E5969] leading-relaxed">{recording.ai_feedback}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-[#1D2129] hover:bg-[#F7F8FA]"
            >
              <Download className="h-4 w-4" />
              {t('downloadRecording')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function InterviewRecordingPlayer({ className }: { className?: string }) {
  const t = useTranslations('interview');
  const [recordings, setRecordings] = useState<InterviewRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchInterviewRecordings();
      if (cancelled) return;
      if (res.success && res.data) {
        setRecordings(res.data.recordings);
      } else {
        setError(res.error ?? 'Failed to load recordings');
      }
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = recordings.find((r) => r.file_id === selectedId);

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

  if (recordings.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
        <Headphones className="h-10 w-10 text-[#C9CDD4]" />
        <p className="text-sm text-[#86909C]">{t('noRecordings')}</p>
      </div>
    );
  }

  if (selected) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <PlayerExpanded recording={selected} onCollapse={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center gap-2 border-b border-gray-200/80 px-4 py-3">
        <Headphones className="h-4 w-4 text-kazi-orange" />
        <h3 className="text-sm font-semibold text-[#1D2129]">{t('recordingsTitle')}</h3>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {recordings.map((rec) => (
          <RecordingCard
            key={rec.file_id}
            recording={rec}
            isSelected={false}
            onSelect={() => setSelectedId(rec.file_id)}
          />
        ))}
      </div>
    </div>
  );
}
