'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Settings } from 'lucide-react';

import { BackLink } from '@/components/navigation/back-link';
import { DeleteSaveDialog, ListenedSection, SaveMenu, useDailyGreeting } from '@/components/radio/radio-saves';
import { StoryFilterBar, storyGenreLabel, useStoryFilters } from '@/components/radio/story-filters';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useRadioHome } from '@/hooks/use-radio-home';
import { newRadioRequestId, setRadioBand, startRadioStory } from '@/lib/radio/api';
import { formatRadioDate, radioChoiceNumber, radioMinutes } from '@/lib/radio/format';
import { isRadioLocale, radioProgramHref, radioSettingsHref, radioStoryHref } from '@/lib/radio/routes';
import { buildClinicHubHref } from '@/lib/hub-entry';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { RADIO_BANDS, type RadioBand, type RadioNotice, type RadioSaveSummary, type RadioStorySummary } from '@/types/radio';

/**
 * The radio home (KAZI-1209; kazispace-ui personal-radio.md, Radio home · Starting a new story · States).
 *
 * Opened from Studio; back returns to Studio. A user the radio is not open to (another interface
 * language, radio off, not Pro) who lands here anyway is sent to Studio: a link never gets round
 * [Who sees it].
 *
 * Not in this part (KAZI-1209 follow-ups): the greeting audio, replay and the listened list, deleting
 * a story, radio settings.
 */
export function RadioHomeScreen({ locale }: { locale: string }) {
  const t = useTranslations('radio');
  const tNav = useTranslations('nav');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const { ready, authenticated } = useAuthReady();
  const offered = isRadioLocale(locale);
  const studioHref = buildClinicHubHref(locale);
  const { access, home, isLoading, refresh, setHome } = useRadioHome({ enabled: offered && ready && authenticated });
  const [deleting, setDeleting] = useState<RadioSaveSummary | null>(null);
  const [listenedKey, setListenedKey] = useState(0);
  const greet = useDailyGreeting();
  // Filtering and sorting stories (KAZI-1257 E): for this visit only.
  const filters = useStoryFilters({
    enabled: offered && ready && authenticated && access === 'open',
    onReset: () => showToast(t('home.filter.reset'), 'info'),
    onClosed: () => void refresh(),
  });

  const [starting, setStarting] = useState<string | null>(null);
  const [notice, setNotice] = useState<RadioNotice | null>(null);
  const [limitFor, setLimitFor] = useState<RadioStorySummary | null>(null);
  const [savingBand, setSavingBand] = useState(false);
  // A retry after a network error, and the save-limit replace, reuse the first attempt's request id
  // (personal-radio.md, Save limit step 3), so a start is never counted twice.
  const pendingRequest = useRef<{ storyId: string; requestId: string } | null>(null);

  useEffect(() => {
    if (!offered || access === 'closed') router.replace(studioHref);
  }, [offered, access, router, studioHref]);

  async function start(story: RadioStorySummary, overwriteSaveId?: string) {
    if (starting) return;
    const reuse = pendingRequest.current?.storyId === story.story_id;
    const requestId = reuse && pendingRequest.current ? pendingRequest.current.requestId : newRadioRequestId('start');
    pendingRequest.current = { storyId: story.story_id, requestId };
    setStarting(story.story_id);
    setNotice(null);
    const res = await startRadioStory(story.story_id, requestId, overwriteSaveId);
    setStarting(null);
    if (res.success && res.data) {
      pendingRequest.current = null;
      if (res.data.save_id) {
        router.push(radioStoryHref(locale, res.data.save_id));
        return;
      }
      // 200 with no save: not available here (`unavailable`), today's limit (`quota`) …
      if (res.data.notice) setNotice(res.data.notice);
      return;
    }
    if (res.errorCode === 'NETWORK_ERROR') {
      showToast(tStates('retry'), 'error');
      return;
    }
    if (res.status === 409 && res.errorCode === 'save_limit') {
      // Kept for the replace, which must use the same request id as this first attempt.
      setLimitFor(story);
      return;
    }
    pendingRequest.current = null;
    if (res.status === 409 && res.errorCode === 'story_unavailable') {
      showToast(t('home.storyUnavailable'));
      void refresh();
      return;
    }
    if (res.status === 409 && res.errorCode === 'request_consumed') {
      showToast(t('home.refreshed'));
      void refresh();
      return;
    }
    if (res.status === 404 || res.status === 403) {
      router.replace(studioHref);
      return;
    }
    showToast(tStates('retry'), 'error');
  }

  async function chooseBand(band: RadioBand) {
    if (!home || savingBand) return;
    setSavingBand(true);
    const res = await setRadioBand(band);
    setSavingBand(false);
    if (res.success && res.data) {
      setHome({ ...home, prefs: res.data.prefs, profile: res.data.profile });
    } else {
      showToast(t('settings.saveFailed'), 'error');
    }
  }

  const back = <BackLink href={studioHref} label={tNav('studio')} />;

  if (!offered || access === 'closed') return null;

  if (isLoading || !ready || access === null) {
    return (
      <Shell back={back} title={tStudio('sections.radio')}>
        <div aria-busy="true" data-testid="radio-home-loading" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </Shell>
    );
  }

  if (access === 'unknown' || !home) {
    return (
      <Shell back={back} title={tStudio('sections.radio')}>
        <div data-testid="radio-home-error" className="flex flex-col items-start gap-2 py-6">
          <p className="text-sm text-workspace-secondary">{t('offline')}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            {tStates('retry')}
          </button>
        </div>
      </Shell>
    );
  }

  const askLevel = home.profile.source === 'none' && !home.prefs.band_override;
  const canStart = home.availability.tts;
  const stories = filters.active && filters.stories ? filters.stories : home.stories;

  // Radio home · Settings: a gear button in the header, named radio.settings.title.
  const gear = (
    <Link
      href={radioSettingsHref(locale)}
      aria-label={t('settings.title')}
      title={t('settings.title')}
      data-testid="radio-settings-open"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-workspace-secondary hover:bg-gray-100"
    >
      <Settings className="h-5 w-5" aria-hidden />
    </Link>
  );

  return (
    <Shell back={back} title={tStudio('sections.radio')} action={gear}>
      {greet ? (
        <p className="text-sm text-workspace-secondary" data-testid="radio-greeting">
          {t('home.greeting')}
        </p>
      ) : null}
      {askLevel ? (
        <section data-testid="radio-level-question" className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-workspace-text">{t('level.question')}</p>
          <div className="mt-3 grid gap-2">
            {RADIO_BANDS.map((band) => (
              <button
                key={band}
                type="button"
                disabled={savingBand}
                onClick={() => void chooseBand(band)}
                data-testid={`radio-level-${band}`}
                className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:border-primary disabled:opacity-60"
              >
                <span className="mr-2 font-semibold">{band}</span>
                {t(`level.${band}`)}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {notice?.text ? (
        <div role="status" data-testid="radio-home-notice" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 text-xs underline">
            {t('notice.close')}
          </button>
        </div>
      ) : null}

      {home.continue_listening.length > 0 ? (
        <Section title={t('home.continueSection')} testId="radio-home-continue">
          {home.continue_listening.map((save) => (
            <ContinueCard key={save.save_id} save={save} locale={locale} onDelete={setDeleting} />
          ))}
        </Section>
      ) : null}

      <Section title={t('home.stories')} testId="radio-home-stories">
        {!canStart ? <p className="text-xs text-workspace-secondary" data-testid="radio-tts-disabled">{t('region.ttsDisabled')}</p> : null}
        <StoryFilterBar state={filters} />
        {filters.active && filters.failed ? (
          <div className="flex items-center gap-3 text-sm text-workspace-secondary" data-testid="radio-stories-error">
            <span>{t('offline')}</span>
            <button type="button" onClick={filters.retry} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
              {tStates('retry')}
            </button>
          </div>
        ) : filters.active && (filters.loading || !filters.stories) ? (
          <p className="flex justify-center py-4" data-testid="radio-stories-loading">
            <Loader2 className="h-5 w-5 animate-spin text-workspace-muted" aria-hidden />
          </p>
        ) : filters.active && filters.stories?.length === 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-workspace-secondary" data-testid="radio-filter-empty">
            {t('home.filter.empty')}
            <button type="button" onClick={filters.clear} className="text-xs text-primary underline">
              {t('home.filter.clear')}
            </button>
          </p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-workspace-secondary">{t('home.storiesEmpty')}</p>
        ) : (
          stories.map((story) => (
            <article key={story.story_id} data-testid="radio-story" className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-base font-semibold text-workspace-text">{story.title}</h3>
              {story.synopsis ? <p className="mt-1 text-sm text-workspace-secondary">{story.synopsis}</p> : null}
              {story.tags?.length || story.base_cefr || storyGenreLabel(t, story) ? (
                <p className="mt-2 flex flex-wrap gap-1">
                  {story.base_cefr ? <Tag>{story.base_cefr}</Tag> : null}
                  {storyGenreLabel(t, story) ? <Tag>{storyGenreLabel(t, story)}</Tag> : null}
                  {(story.tags ?? []).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!canStart || starting !== null}
                onClick={() => void start(story)}
                data-testid="radio-story-start"
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {starting === story.story_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t('home.newStory')}
              </button>
            </article>
          ))
        )}
      </Section>

      <Section title={t('home.programs')} testId="radio-home-programs">
        {home.programs.length === 0 ? (
          <p className="text-sm text-workspace-secondary">{t('home.programsEmpty')}</p>
        ) : (
          home.programs.map((program) => (
            <Link
              key={program.program_id}
              href={radioProgramHref(locale, program.program_id)}
              data-testid="radio-program"
              className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-primary"
            >
              {program.series ? <p className="text-xs text-workspace-muted">{program.series}</p> : null}
              <h3 className="text-base font-semibold text-workspace-text">{program.title}</h3>
              {/* The version this listener will hear; both null ⇒ show neither (personal-radio.md, Programs). */}
              {program.band && program.duration_ms ? (
                <p className="mt-1 flex gap-1" data-testid="radio-program-meta">
                  <Tag>{t('home.minutes', { n: radioMinutes(program.duration_ms) })}</Tag>
                  <Tag>{program.band}</Tag>
                </p>
              ) : null}
              {program.tags?.length ? (
                <p className="mt-2 flex flex-wrap gap-1">
                  {program.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </p>
              ) : null}
            </Link>
          ))
        )}
      </Section>

      <ListenedSection locale={locale} reloadKey={listenedKey} onDelete={setDeleting} />

      {deleting ? (
        <DeleteSaveDialog
          save={deleting}
          onCancel={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setListenedKey((n) => n + 1);
            void refresh();
          }}
          onClosed={() => router.replace(studioHref)}
          onFailed={() => {
            setDeleting(null);
            showToast(tStates('retry'), 'error');
          }}
        />
      ) : null}

      {limitFor ? (
        <SaveLimitSheet
          saves={home.continue_listening}
          onCancel={() => {
            // Cancel: nothing changes and nothing is charged; a later start is a new attempt.
            pendingRequest.current = null;
            setLimitFor(null);
          }}
          onReplace={(saveId) => {
            const story = limitFor;
            setLimitFor(null);
            void start(story, saveId);
          }}
        />
      ) : null}
    </Shell>
  );
}

function Shell({
  back,
  title,
  action,
  children,
}: {
  back: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-gray-50" data-testid="radio-home">
      <div className="mx-auto max-w-2xl px-4 pt-2">{back}</div>
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-10 pt-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-kazi-navy">{title}</h1>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-workspace-muted">{title}</h2>
      {children}
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-workspace-secondary">{children}</span>;
}

function ContinueCard({
  save,
  locale,
  onDelete,
}: {
  save: RadioSaveSummary;
  locale: string;
  onDelete: (s: RadioSaveSummary) => void;
}) {
  const t = useTranslations('radio.studio');
  return (
    <article data-testid="radio-continue-card" className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-workspace-text">{save.title}</h3>
        <p className="mt-0.5 text-xs text-workspace-secondary">
          <span data-testid="radio-continue-progress">{t('progress', { n: radioChoiceNumber(save.choices_made) })}</span>
          {' · '}
          {t('lastListened', { date: formatRadioDate(save.updated_at, locale) })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={radioStoryHref(locale, save.save_id)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          {t('continue')}
        </Link>
        <SaveMenu save={save} locale={locale} onDelete={onDelete} />
      </div>
    </article>
  );
}

/** At most 3 stories in progress: choose one to replace (personal-radio.md, Save limit). */
function SaveLimitSheet({
  saves,
  onCancel,
  onReplace,
}: {
  saves: RadioSaveSummary[];
  onCancel: () => void;
  onReplace: (saveId: string) => void;
}) {
  const t = useTranslations('radio');
  const [picked, setPicked] = useState<string | null>(null);
  const pickedSave = saves.find((s) => s.save_id === picked);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="radio-save-limit-title" data-testid="radio-save-limit" className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <h2 id="radio-save-limit-title" className="text-base font-semibold">{t('saveLimit.title')}</h2>
        <p className="mt-1 text-sm text-workspace-secondary">{t('saveLimit.choose')}</p>
        <div className="mt-3 flex flex-col gap-2">
          {saves.map((s) => (
            <button
              key={s.save_id}
              type="button"
              onClick={() => setPicked(s.save_id)}
              aria-pressed={picked === s.save_id}
              className={cn(
                'min-h-11 rounded-lg border px-3 py-2 text-left text-sm',
                picked === s.save_id ? 'border-primary bg-primary/5' : 'border-gray-200'
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
        {pickedSave ? <p className="mt-3 text-xs text-workspace-secondary">{t('saveLimit.confirm', { title: pickedSave.title })}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm">
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!picked}
            onClick={() => picked && onReplace(picked)}
            data-testid="radio-save-limit-replace"
            className="min-h-11 rounded-lg border border-red-300 px-4 text-sm font-medium text-red-700 disabled:opacity-50"
          >
            {t('saveLimit.overwrite')}
          </button>
        </div>
      </div>
    </div>
  );
}
