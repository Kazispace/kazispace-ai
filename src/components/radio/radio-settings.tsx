'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';

import { BackLink } from '@/components/navigation/back-link';
import { PlayerShell } from '@/components/radio/player-parts';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useRadioHome } from '@/hooks/use-radio-home';
import { patchRadioPrefs } from '@/lib/radio/api';
import { dropRadioEvents } from '@/lib/radio/events';
import { deleteRadioMemory, getRadioBgm } from '@/lib/radio/player-api';
import { isRadioLocale, radioHomeHref, radioStoryHref, type RadioFrom } from '@/lib/radio/routes';
import {
  BGM_LEVEL_DEFAULT,
  BGM_LEVEL_MAX,
  BGM_LEVEL_MIN,
  EN_RATIOS,
  EN_RATIO_DEFAULT,
  VOICE_LABEL_KEY,
  percent,
  readDefaultSpeed,
  shownEnRatio,
  writeDefaultSpeed,
} from '@/lib/radio/settings';
import { blockedHelpPlatform, micErrorKind } from '@/lib/radio/voice';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { useUIStore } from '@/lib/store';
import { isTelegramWebApp } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { RADIO_BANDS, type RadioBand, type RadioHome, type RadioListenerProfile, type RadioPrefs, type RadioVoiceSample } from '@/types/radio';

/** Data · Saving settings / Replay and deleting: busy is resent, at most 5 times. */
export const SETTINGS_BUSY_LIMIT = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Stored = { prefs: RadioPrefs; profile: RadioListenerProfile };

/**
 * Radio settings (KAZI-1209 part 4; personal-radio.md, Radio settings · Clearing radio memory · Data ·
 * Saving settings).
 *
 * A screen, not an overlay. It reads `prefs`, `profile` and `voices` from `GET home`. Each change
 * sends `PATCH prefs` with only that setting; the answer's `prefs` and `profile` are shown. A refusal
 * (or 5 busy answers) puts the control back with `radio.settings.saveFailed`. The default speed is
 * kept by the app. Background music shows only when `GET bgm` has tracks. "Listen at choices" asks
 * for the microphone when turned on; a blocked microphone keeps it off with the help under it.
 * Clearing radio memory is confirmed in a dialog and lands on the radio home as for a first visit.
 *
 * Back: to the player when opened from it (`?save=`), else to the radio home.
 */
export function RadioSettingsScreen({ locale, saveId, from }: { locale: string; saveId?: string | null; from?: RadioFrom }) {
  const t = useTranslations('radio');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const { ready, authenticated } = useAuthReady();
  const offered = isRadioLocale(locale);
  const { access, home, isLoading, refresh, setHome } = useRadioHome({ enabled: offered && ready && authenticated });
  const studioHref = buildClinicHubHref(locale);

  const [stored, setStored] = useState<Stored | null>(null);
  const [speed, setSpeed] = useState<1 | 0.75>(1);
  const [hasMusic, setHasMusic] = useState(false);
  const [bgmLevel, setBgmLevel] = useState<number>(BGM_LEVEL_DEFAULT);
  const [micBlocked, setMicBlocked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const homeRef = useRef<RadioHome | null>(home);
  homeRef.current = home;

  useEffect(() => {
    if (!offered || access === 'closed') router.replace(studioHref);
  }, [offered, access, router, studioHref]);

  useEffect(() => {
    if (home && !stored) {
      setStored({ prefs: home.prefs ?? {}, profile: home.profile });
      setBgmLevel(home.prefs?.bgm_level ?? BGM_LEVEL_DEFAULT);
    }
  }, [home, stored]);

  useEffect(() => setSpeed(readDefaultSpeed()), []);

  // Background music: the group shows only when there is music to play.
  useEffect(() => {
    if (!offered || !ready || !authenticated) return;
    let live = true;
    void getRadioBgm().then((res) => {
      if (live) setHasMusic(!!res.success && (res.data?.tracks?.length ?? 0) > 0);
    });
    return () => {
      live = false;
    };
  }, [offered, ready, authenticated]);

  /** Saves one change; on failure the toast and `revert` put the control back. */
  async function save(patch: RadioPrefs, optimistic: Stored, revert: () => void) {
    const before = stored;
    setStored(optimistic);
    for (let busy = 0; busy <= SETTINGS_BUSY_LIMIT; busy += 1) {
      const res = await patchRadioPrefs(patch);
      if (res.success && res.data) {
        const next = { prefs: res.data.prefs ?? {}, profile: res.data.profile };
        setStored(next);
        if (homeRef.current) setHome({ ...homeRef.current, prefs: next.prefs, profile: next.profile });
        return;
      }
      if (res.status === 503 && res.errorCode === 'busy' && busy < SETTINGS_BUSY_LIMIT) {
        await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
        continue;
      }
      if (res.status === 404 || (res.status === 403 && res.errorCode?.startsWith('radio_'))) {
        router.replace(studioHref);
        return;
      }
      break;
    }
    setStored(before);
    revert();
    showToast(t('settings.saveFailed'));
  }

  const back = saveId ? (
    <BackLink href={radioStoryHref(locale, saveId, from ?? 'home')} label={t('player.title')} />
  ) : (
    <BackLink href={radioHomeHref(locale)} label={tStudio('sections.radio')} />
  );

  // The radio's status could not be read (network or server error): say so with a retry, as the radio
  // home does, rather than a skeleton that never ends (a deep link straight to settings).
  if (offered && access === 'unknown' && !home) {
    return (
      <PlayerShell back={back} title={t('settings.title')}>
        <div data-testid="radio-settings-error" className="flex flex-col items-start gap-2 py-6">
          <p className="text-sm text-workspace-secondary">{t('offline')}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {tStates('retry')}
          </button>
        </div>
      </PlayerShell>
    );
  }

  if (!offered || access === 'closed' || isLoading || !stored || !home) {
    return (
      <PlayerShell back={back} title={t('settings.title')}>
        <div aria-busy="true" className="flex flex-col gap-3" data-testid="radio-settings-loading">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </PlayerShell>
    );
  }

  const { prefs, profile } = stored;
  const band: RadioBand = prefs.band_override ?? profile.band;
  const enRatio = shownEnRatio(band, prefs.en_ratio_override ?? profile.en_ratio);
  const voice = prefs.voice_id && home.voices.includes(prefs.voice_id) ? prefs.voice_id : profile.voice_id;
  const bgmOn = prefs.bgm_on ?? true;
  const listenOn = prefs.listen_window_on === true;
  const platform =
    typeof navigator !== 'undefined'
      ? blockedHelpPlatform(navigator.userAgent, { telegram: isTelegramWebApp(), maxTouchPoints: navigator.maxTouchPoints })
      : 'desktop';

  const onBand = (b: RadioBand) => {
    if (b === band) return;
    // Only the level is sent: the server drops the stored share, so the new level's default shows.
    void save(
      { band_override: b },
      { prefs: { ...prefs, band_override: b, en_ratio_override: null }, profile: { ...profile, band: b, en_ratio: EN_RATIO_DEFAULT[b] } },
      () => undefined
    );
  };
  const onRatio = (r: number) => {
    if (r === enRatio) return;
    void save({ en_ratio_override: r }, { prefs: { ...prefs, en_ratio_override: r }, profile: { ...profile, en_ratio: r } }, () => undefined);
  };
  const onVoice = (v: string) => {
    if (v === voice) return;
    void save({ voice_id: v }, { prefs: { ...prefs, voice_id: v }, profile }, () => undefined);
  };
  const onSpeed = (s: 1 | 0.75) => {
    setSpeed(s);
    writeDefaultSpeed(s);
  };
  const onBgm = (on: boolean) => void save({ bgm_on: on }, { prefs: { ...prefs, bgm_on: on }, profile }, () => undefined);
  const commitBgmLevel = () => {
    const previous = prefs.bgm_level ?? BGM_LEVEL_DEFAULT;
    if (bgmLevel === previous) return;
    void save({ bgm_level: bgmLevel }, { prefs: { ...prefs, bgm_level: bgmLevel }, profile }, () => setBgmLevel(previous));
  };
  const onListen = async (on: boolean) => {
    if (!on) {
      void save({ listen_window_on: false }, { prefs: { ...prefs, listen_window_on: false }, profile }, () => undefined);
      return;
    }
    // Turning it on is the user's own action, so the app may ask for the microphone now.
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicBlocked(false);
      } catch (err) {
        if (micErrorKind(err) === 'blocked') {
          setMicBlocked(true); // the switch stays off; the help shows under it
          return;
        }
        // No microphone is not a refusal: the choice is saved, voice is unavailable this visit.
      }
    }
    void save({ listen_window_on: true }, { prefs: { ...prefs, listen_window_on: true }, profile }, () => undefined);
  };

  const onClear = async () => {
    setClearing(true);
    for (let busy = 0; busy <= SETTINGS_BUSY_LIMIT; busy += 1) {
      const res = await deleteRadioMemory();
      if (res.success) {
        dropRadioEvents(); // the server cannot tell an old batch sent after clearing from a new one
        setClearing(false);
        setConfirming(false);
        showToast(t('settings.cleared'));
        await refresh();
        router.replace(radioHomeHref(locale)); // the radio home, as for a first visit
        return;
      }
      if (res.status === 503 && res.errorCode === 'busy' && busy < SETTINGS_BUSY_LIMIT) {
        await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
        continue;
      }
      setClearing(false);
      setConfirming(false);
      if (res.status === 404) router.replace(studioHref);
      else showToast(t('settings.clearFailed'));
      return;
    }
  };

  return (
    <PlayerShell back={back} title={t('settings.title')}>
      <div className="flex flex-col gap-6 pb-6" data-testid="radio-settings">
        <Group title={t('settings.band')}>
          <Choices
            name="band"
            value={band}
            options={RADIO_BANDS.map((b) => ({ value: b, label: t(`level.${b}`) }))}
            onChange={(v) => onBand(v as RadioBand)}
          />
        </Group>

        <Group title={t('settings.enRatio')}>
          <Segmented
            name="en-ratio"
            value={String(enRatio)}
            options={EN_RATIOS[band].map((r) => ({ value: String(r), label: percent(r) }))}
            onChange={(v) => onRatio(Number(v))}
          />
        </Group>

        {home.voices.length ? (
          <Group title={t('settings.voice.title')}>
            <Choices
              name="voice"
              value={voice}
              options={home.voices.map((v) => ({ value: v, label: VOICE_LABEL_KEY[v] ? t(`settings.voice.${VOICE_LABEL_KEY[v]}`) : v }))}
              onChange={onVoice}
            />
            <VoiceSamples
              samples={home.voice_samples ?? []}
              voices={home.voices}
              labelOf={(v) => (VOICE_LABEL_KEY[v] ? t(`settings.voice.${VOICE_LABEL_KEY[v]}`) : v)}
              playLabel={t('settings.voice.preview')}
              onExpired={refresh}
            />
          </Group>
        ) : null}

        <Group title={t('settings.speed')}>
          <Segmented
            name="speed"
            value={String(speed)}
            options={[
              { value: '1', label: t('settings.speedNormal') },
              { value: '0.75', label: t('settings.speedSlow') },
            ]}
            onChange={(v) => onSpeed(v === '0.75' ? 0.75 : 1)}
          />
        </Group>

        {hasMusic ? (
          <Group title={t('settings.bgm')}>
            <Switch id="radio-bgm" label={t('settings.bgm')} checked={bgmOn} onChange={onBgm} />
            {bgmOn ? (
              <label className="mt-3 flex items-center gap-3 text-sm text-workspace-secondary">
                <span className="shrink-0">{t('settings.bgmLevel')}</span>
                <input
                  type="range"
                  min={BGM_LEVEL_MIN}
                  max={BGM_LEVEL_MAX}
                  step={1}
                  value={bgmLevel}
                  onChange={(e) => setBgmLevel(Number(e.target.value))}
                  onPointerUp={commitBgmLevel}
                  onKeyUp={commitBgmLevel}
                  onBlur={commitBgmLevel}
                  data-testid="radio-bgm-level"
                  className="w-full accent-primary"
                />
              </label>
            ) : null}
          </Group>
        ) : null}

        <Group title={t('settings.listenWindow')}>
          <Switch id="radio-listen" label={t('settings.listenWindow')} checked={listenOn} onChange={(on) => void onListen(on)} />
          {micBlocked ? (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm" data-testid="radio-blocked-help" role="note">
              <p className="font-medium text-workspace-text">{t('mic.blockedHelp.title')}</p>
              <p className="mt-1 text-workspace-secondary">{t('mic.blockedHelp.body')}</p>
              <p className="mt-2 text-workspace-text">{t(`mic.blockedHelp.${platform}`)}</p>
            </div>
          ) : null}
        </Group>

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            data-testid="radio-clear-memory"
            className="text-sm font-medium text-red-600 hover:underline"
          >
            {t('settings.clearMemory')}
          </button>
        </div>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => !clearing && setConfirming(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-describedby="radio-clear-text"
            data-testid="radio-clear-dialog"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="radio-clear-text" className="text-sm text-workspace-text">
              {t('settings.clearMemoryConfirm')}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={clearing}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={() => void onClear()}
                data-testid="radio-clear-confirm"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-70"
              >
                {clearing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t('settings.clearMemoryAction')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PlayerShell>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-workspace-text">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A sample button for each offered voice that has one (`voice_samples` from `GET home`, in the order of
 * `voices`); a voice with no sample gets no button (personal-radio.md, Radio settings). Playing changes
 * no setting. The URL is signed for 15 minutes: if it no longer loads, read `GET home` again.
 */
function VoiceSamples({
  samples,
  voices,
  labelOf,
  playLabel,
  onExpired,
}: {
  samples: RadioVoiceSample[];
  voices: string[];
  labelOf: (voiceId: string) => string;
  playLabel: string;
  onExpired: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  // Walk `voices` and look each one up, so the buttons follow the picker's order whatever order the samples come in.
  const offered = voices
    .map((v) => samples.find((s) => s.voice_id === v && s.audio_url))
    .filter((s): s is RadioVoiceSample => !!s);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  if (!offered.length) return null;

  const play = (sample: RadioVoiceSample) => {
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    a.pause();
    if (playing === sample.voice_id) {
      setPlaying(null);
      return;
    }
    a.onended = () => setPlaying(null);
    a.onerror = () => {
      setPlaying(null);
      onExpired();
    };
    a.src = sample.audio_url;
    setPlaying(sample.voice_id);
    void a.play().catch(() => setPlaying(null));
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid="radio-settings-voice-samples">
      {offered.map((s) => (
        <button
          key={s.voice_id}
          type="button"
          onClick={() => play(s)}
          aria-pressed={playing === s.voice_id}
          data-voice={s.voice_id}
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs text-workspace-secondary hover:border-primary"
        >
          {playing === s.voice_id ? <Square className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
          {playLabel} · {labelOf(s.voice_id)}
        </button>
      ))}
    </div>
  );
}

/** One of several, as radio cards (level, voice). */
function Choices({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2" data-testid={`radio-settings-${name}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          data-value={o.value}
          className={cn(
            'rounded-lg border px-3 py-2 text-left text-sm',
            o.value === value ? 'border-primary bg-primary/5 text-workspace-text' : 'border-gray-200 text-workspace-secondary hover:border-gray-300'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A segmented control (English share, default speed). */
function Segmented({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg border border-gray-200 p-0.5" data-testid={`radio-settings-${name}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          data-value={o.value}
          className={cn('min-w-16 rounded-md px-3 py-1.5 text-sm', o.value === value ? 'bg-primary text-white' : 'text-workspace-secondary')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      data-testid={id}
      className={cn('relative inline-flex h-7 w-12 items-center rounded-full transition-colors', checked ? 'bg-primary' : 'bg-gray-300')}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}
