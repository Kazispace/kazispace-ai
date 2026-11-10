'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { newRadioRequestId } from '@/lib/radio/api';
import {
  LIVE_CODE_REFUSED,
  ackLiveDisclaimer,
  getLiveHome,
  isRadioAudienceCode,
  liveSectionAccessOf,
  sendLiveEnd,
  startLiveSession,
  type LiveSectionAccess,
} from '@/lib/radio/live-api';
import { setStartedLiveSession, unlockLiveAudio } from '@/lib/radio/live-session';
import { radioLiveHref } from '@/lib/radio/routes';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { LiveHome, LiveHost, LiveTopic } from '@/types/radio-live';

export const LIVE_HOME_KEY = ['radio-live-home'] as const;

interface LiveHomeState {
  access: LiveSectionAccess;
  home: LiveHome | null;
}

async function fetchLiveHome(): Promise<LiveHomeState> {
  const res = await getLiveHome();
  const access = liveSectionAccessOf(res);
  return { access, home: access === 'shown' && res.data ? res.data : null };
}

/** The topics a host can open, in the server's order (live-room.md, Radio home: the Live section). */
export function topicsForHost(topics: LiveTopic[], host: string | null): LiveTopic[] {
  return host ? topics.filter((t) => t.hosts.includes(host)) : [];
}

type Pending = { requestId: string; host: string; topicId: string };

/**
 * The radio home's Live section (KAZI-1287; kazispace-ui live-room.md, Who sees it · Radio home: the
 * Live section · The disclaimer · Starting a session).
 *
 * Shown only while Live Room is on and available here; "off" and "not available here" never draw an
 * entry that does not work. `onRadioClosed` is the radio's own rule for a `403` that says the radio
 * is not open to this user (go to Studio).
 */
export function LiveSection({ locale, onRadioClosed }: { locale: string; onRadioClosed: () => void }) {
  const t = useTranslations('radio.live');
  const tStates = useTranslations('states');
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: LIVE_HOME_KEY, queryFn: fetchLiveHome, staleTime: 0, retry: false });
  const reload = () => void queryClient.invalidateQueries({ queryKey: LIVE_HOME_KEY });

  // `403 live_refused`: hidden for the rest of this visit (Starting a session).
  const [refused, setRefused] = useState(false);
  const [hostKey, setHostKey] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [sheet, setSheet] = useState<'closed' | 'open' | 'saving' | 'failed'>('closed');
  // The request a resend after a network error (or after Agree, for `409 disclaimer_required`) reuses,
  // so a resend never starts a second session. A new choice is a new request.
  const pending = useRef<Pending | null>(null);
  const ended = useRef<Set<string>>(new Set());

  const home = query.data?.home ?? null;
  const access: LiveSectionAccess | null = query.data?.access ?? (query.isError ? 'error' : null);

  // A session left by a closed tab is ended here rather than resumed: once, not waited for (Ending).
  const openId = home?.open_session_id ?? null;
  useEffect(() => {
    if (openId && !ended.current.has(openId)) {
      ended.current.add(openId);
      sendLiveEnd(openId);
    }
  }, [openId]);

  // One host is always selected: the first, on each visit. The first topic when the host changes.
  const hosts = home?.hosts ?? [];
  const host: LiveHost | null = hosts.find((h) => h.key === hostKey) ?? hosts[0] ?? null;
  const topics = topicsForHost(home?.topics ?? [], host?.key ?? null);
  const topic: LiveTopic | null = topics.find((x) => x.id === topicId) ?? topics[0] ?? null;

  if (refused || access === 'hidden') return null;

  if (access === null) {
    return (
      <Frame t={t}>
        <div aria-busy="true" data-testid="radio-live-loading" className="flex flex-col gap-2">
          <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </Frame>
    );
  }

  if (access === 'error' || !home) {
    return (
      <Frame t={t}>
        <div data-testid="radio-live-error" className="flex items-center gap-3 text-sm text-workspace-secondary">
          <span>{t('unavailable')}</span>
          <button type="button" onClick={reload} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-50">
            {tStates('retry')}
          </button>
        </div>
      </Frame>
    );
  }

  const anyTopic = home.hosts.some((h) => topicsForHost(home.topics, h.key).length > 0);
  const left = home.sessions_left_today;

  async function start(acked = home?.disclaimer_acked ?? false) {
    if (starting || !host || !topic) return;
    const same = pending.current && pending.current.host === host.key && pending.current.topicId === topic.id;
    const req: Pending = same && pending.current ? pending.current : { requestId: newRadioRequestId('live'), host: host.key, topicId: topic.id };
    pending.current = req;
    if (!acked) {
      setSheet('open');
      return;
    }
    setStarting(true);
    const res = await startLiveSession({ request_id: req.requestId, host: req.host, topic_id: req.topicId });
    setStarting(false);
    if (res.success && res.data) {
      pending.current = null;
      setStartedLiveSession({ session: res.data, host });
      router.push(radioLiveHref(locale));
      return;
    }
    if (res.errorCode === 'NETWORK_ERROR') {
      // Kept: the next Start resends the same request.
      showToast(tStates('retry'), 'error');
      return;
    }
    if (res.status === 409 && res.errorCode === 'disclaimer_required') {
      // After Agree, the same request is sent again.
      setSheet('open');
      return;
    }
    pending.current = null;
    if (res.status === 409 && res.errorCode === 'live_daily_limit') {
      showToast(t('noneLeft'));
      reload();
      return;
    }
    if (res.status === 409) {
      // `request_reused`: should not happen. The section reloads; nothing else is shown.
      reload();
      return;
    }
    if (res.status === 503) {
      showToast(t('unavailable'));
      reload();
      return;
    }
    if (res.status === 403 && res.errorCode === LIVE_CODE_REFUSED) {
      showToast(t('unavailable'));
      setRefused(true);
      return;
    }
    if (res.status === 403 && isRadioAudienceCode(res.errorCode)) {
      onRadioClosed();
      return;
    }
    if (res.status === 404) {
      // Live Room was switched off: the section disappears.
      reload();
      return;
    }
    // `422 invalid_request` (a bug in the app) and anything else: nothing else changes.
    showToast(t('unavailable'));
  }

  async function agree() {
    setSheet('saving');
    const res = await ackLiveDisclaimer();
    if (!res.success) {
      setSheet('failed');
      return;
    }
    setSheet('closed');
    if (home) queryClient.setQueryData<LiveHomeState>(LIVE_HOME_KEY, { access: 'shown', home: { ...home, disclaimer_acked: true } });
    void start(true);
  }

  return (
    <Frame t={t}>
      {!anyTopic ? (
        <p className="text-sm text-workspace-secondary" data-testid="radio-live-empty">
          {t('empty')}
        </p>
      ) : (
        <>
          <p className="text-xs text-workspace-secondary" data-testid="radio-live-left">
            {left > 0 ? t('left', { n: left }) : t('noneLeft')}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('section')}>
            {home.hosts.map((h) => (
              <button
                key={h.key}
                type="button"
                aria-pressed={host?.key === h.key}
                data-testid="radio-live-host"
                onClick={() => {
                  setHostKey(h.key);
                  setTopicId(null);
                }}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm',
                  host?.key === h.key ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-gray-200 bg-white text-workspace-text'
                )}
              >
                {h.name}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {topics.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={topic?.id === x.id}
                data-testid="radio-live-topic"
                onClick={() => setTopicId(x.id)}
                className={cn(
                  'min-h-11 rounded-xl border p-3 text-left',
                  topic?.id === x.id ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
                )}
              >
                <span className="block text-sm font-semibold text-workspace-text">{x.title_zh}</span>
                <span className="mt-1 block text-xs text-workspace-secondary">
                  {t('question')}
                  {': '}
                  <span lang="en">{x.question_en}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={left <= 0 || !topic || starting}
            onClick={() => {
              // Inside the tap: the opening may then play at once on the Live screen.
              unlockLiveAudio();
              void start();
            }}
            data-testid="radio-live-start"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t('start')}
          </button>
        </>
      )}
      {sheet !== 'closed' ? (
        <DisclaimerSheet
          state={sheet}
          onAgree={() => {
            unlockLiveAudio();
            void agree();
          }}
          onLater={() => {
            // Nothing is sent; the sheet opens again at the next Start.
            pending.current = null;
            setSheet('closed');
          }}
        />
      ) : null}
    </Frame>
  );
}

function Frame({ t, children }: { t: ReturnType<typeof useTranslations>; children: React.ReactNode }) {
  return (
    <section data-testid="radio-home-live" className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <h2 className="text-base font-semibold text-workspace-text">{t('section')}</h2>
        <p className="mt-0.5 text-sm text-workspace-secondary">{t('subtitle')}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The one-time disclaimer (live-room.md, The disclaimer). The whole text, never cut to "read more";
 * the helpline paragraph stays above the buttons. It takes focus when it opens and gives it back to
 * Start when it closes.
 */
function DisclaimerSheet({
  state,
  onAgree,
  onLater,
}: {
  state: 'open' | 'saving' | 'failed';
  onAgree: () => void;
  onLater: () => void;
}) {
  const t = useTranslations('radio.live.disclaimer');
  const tLive = useTranslations('radio.live');
  const tStates = useTranslations('states');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => back?.focus?.();
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="radio-live-disclaimer-title"
        data-testid="radio-live-disclaimer"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 outline-none sm:rounded-2xl"
      >
        <h2 id="radio-live-disclaimer-title" className="text-base font-semibold">
          {t('title')}
        </h2>
        <p className="mt-3 text-sm text-workspace-text">{t('what')}</p>
        <p className="mt-2 text-sm text-workspace-text">{t('not')}</p>
        <p className="mt-2 text-sm font-medium text-workspace-text" data-testid="radio-live-disclaimer-help">
          {t('help')}
        </p>
        {state === 'failed' ? (
          // The acknowledgement failed: the sheet stays, nothing starts.
          <div role="alert" className="mt-3 flex items-center gap-3 text-sm text-red-700" data-testid="radio-live-disclaimer-error">
            <span>{tLive('unavailable')}</span>
            <button type="button" onClick={onAgree} className="min-h-11 rounded-lg border border-red-300 px-3 text-sm">
              {tStates('retry')}
            </button>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onLater} data-testid="radio-live-disclaimer-later" className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm">
            {t('later')}
          </button>
          <button
            type="button"
            disabled={state === 'saving'}
            onClick={onAgree}
            data-testid="radio-live-disclaimer-agree"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t('agree')}
          </button>
        </div>
      </div>
    </div>
  );
}
