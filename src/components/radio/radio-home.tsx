'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Loader2, Play, Settings } from 'lucide-react';

import { LiveSection } from '@/components/radio/live-section';
import { RadioCover } from '@/components/radio/radio-cover';
import { DeleteSaveDialog, ListenedSection, SaveMenu, useDailyGreeting } from '@/components/radio/radio-saves';
import { StoryFilterBar, storyGenreLabel, useStoryFilters } from '@/components/radio/story-filters';
import { useAuthReady } from '@/hooks/use-auth-ready';
import { useRadioHome } from '@/hooks/use-radio-home';
import {
  newRadioRequestId,
  radioClosedReasonOf,
  setRadioBand,
  startRadioStory,
  type RadioClosedReason,
} from '@/lib/radio/api';
import { subscriptionHref } from '@/lib/top-level-nav';
import { formatRadioDate, radioChoiceNumber, radioMinutes } from '@/lib/radio/format';
import {
  isLiveRoomLocale,
  isRadioLocale,
  radioEpisodeHref,
  radioProgramHref,
  radioSettingsHref,
  radioStoryHref,
  radioStorylineHref,
} from '@/lib/radio/routes';
import { useUIStore } from '@/lib/store';
import { pickRadioResume, type RadioResume } from '@/lib/radio/resume';
import { RADIO_ACCENT, RADIO_PAGE } from '@/lib/radio/theme';
import { cn } from '@/lib/utils';
import {
  RADIO_BANDS,
  type RadioBand,
  type RadioNotice,
  type RadioSaveSummary,
  type RadioStorylineSummary,
  type RadioStorySummary,
} from '@/types/radio';

/**
 * The radio home (KAZI-1209; kazispace-ui personal-radio.md, Radio home · Starting a new story · States).
 *
 * The Radio destination (KAZI-1485, kazispace-ui D36): a top-level screen with the tab bar and no
 * back link. A user the radio is not open to (another interface language, radio off, not Pro) sees
 * `studio.comingSoon` here, with nothing to tap: a link never gets round [Who sees it].
 * ❌ Former (D28): opened from Studio, back to Studio, and a closed radio sent the user to Studio.
 *
 * Not in this part (KAZI-1209 follow-ups): the greeting audio, replay and the listened list, deleting
 * a story, radio settings.
 */
export function RadioHomeScreen({ locale }: { locale: string }) {
  const t = useTranslations('radio');
  const tStudio = useTranslations('studio');
  const tStates = useTranslations('states');
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const { ready, authenticated } = useAuthReady();
  const offered = isRadioLocale(locale);
  // Set when the server says the radio is off or not open to this user after the home loaded.
  const [closedByServer, setClosedByServer] = useState<RadioClosedReason | null>(null);
  const closeRadio = (reason: RadioClosedReason = 'other') => setClosedByServer(reason);
  const { access, closedReason: serverClosedReason, home, isLoading, refresh, setHome } = useRadioHome({ enabled: offered && ready && authenticated });
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
      closeRadio(radioClosedReasonOf(res));
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

  // A top-level screen: no back link (Navigation 3.0, D36).
  const back = null;

  const closedReason: RadioClosedReason | null = !offered
    ? 'other'
    : closedByServer ?? (access === 'closed' ? serverClosedReason ?? 'other' : null);
  // No paid plan: say why and offer the plan page (kazispace-ui D37). ❌ Former: "coming soon".
  if (closedReason === 'plan') {
    return (
      <Shell back={back} title={tStudio('sections.radio')}>
        <section data-testid="radio-plan-required" className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-radio-secondary">{t('planRequired.body')}</p>
          <Link
            href={subscriptionHref(locale, { fromRadio: true })}
            data-testid="radio-plan-required-action"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-radio-accent-start to-radio-accent-end ring-2 ring-radio-ring px-4 text-sm font-medium text-white hover:opacity-90"
          >
            {t('planRequired.action')}
          </Link>
        </section>
      </Shell>
    );
  }
  if (closedReason) {
    return (
      <Shell back={back} title={tStudio('sections.radio')}>
        <p data-testid="radio-coming-soon" className="text-sm text-radio-muted">
          {tStudio('comingSoon')}
        </p>
      </Shell>
    );
  }

  if (isLoading || !ready || access === null) {
    return (
      <Shell back={back} title={tStudio('sections.radio')}>
        <div aria-busy="true" data-testid="radio-home-loading" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-radio-surface-raised" />
          ))}
        </div>
      </Shell>
    );
  }

  if (access === 'unknown' || !home) {
    return (
      <Shell back={back} title={tStudio('sections.radio')}>
        <div data-testid="radio-home-error" className="flex flex-col items-start gap-2 py-6">
          <p className="text-sm text-radio-secondary">{t('offline')}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-radio-surface-raised px-3 py-1.5 text-sm hover:bg-radio-surface-raised"
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
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-radio-secondary hover:bg-radio-surface-raised"
    >
      <Settings className="h-5 w-5" aria-hidden />
    </Link>
  );

  // Resume bar (Personal radio 0.35): the item the listener was last in; Continue listening leaves it out.
  const resume = pickRadioResume(home);
  const continueOthers = home.continue_listening.filter((save) => !(resume?.kind === 'story' && resume.key === save.save_id));

  return (
    <Shell back={back} title={tStudio('sections.radio')} action={gear} resume={resume ? <ResumeBar resume={resume} locale={locale} /> : null}>
      {greet ? (
        <p className="text-sm text-radio-secondary" data-testid="radio-greeting">
          {t('home.greeting')}
        </p>
      ) : null}
      {askLevel ? (
        <section data-testid="radio-level-question" className="rounded-xl border border-radio-ring bg-radio-surface-raised p-4">
          <p className="text-sm font-medium text-radio-text">{t('level.question')}</p>
          <div className="mt-3 grid gap-2">
            {RADIO_BANDS.map((band) => (
              <button
                key={band}
                type="button"
                disabled={savingBand}
                onClick={() => void chooseBand(band)}
                data-testid={`radio-level-${band}`}
                className="min-h-11 rounded-lg border border-radio-surface-raised bg-radio-surface px-3 py-2 text-left text-sm hover:border-radio-ring disabled:opacity-60"
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

      {continueOthers.length > 0 ? (
        <Section title={t('home.continueSection')} testId="radio-home-continue">
          {continueOthers.map((save) => (
            <ContinueCard key={save.save_id} save={save} locale={locale} onDelete={setDeleting} />
          ))}
        </Section>
      ) : null}

      {/* Live Room (KAZI-1287): between Continue listening and Stories, kept apart from both. Chinese
          interface only (KAZI-1442, `isLiveRoomLocale`): an English interface gets no Live section and
          does not ask the Live Room server at all. */}
      {isLiveRoomLocale(locale) ? (
        <LiveSection locale={locale} onRadioClosed={() => closeRadio()} />
      ) : null}

      <Section title={t('home.stories')} testId="radio-home-stories">
        {!canStart ? <p className="text-xs text-radio-secondary" data-testid="radio-tts-disabled">{t('region.ttsDisabled')}</p> : null}
        <StoryFilterBar state={filters} />
        {filters.active && filters.failed ? (
          <div className="flex items-center gap-3 text-sm text-radio-secondary" data-testid="radio-stories-error">
            <span>{t('offline')}</span>
            <button type="button" onClick={filters.retry} className="rounded-lg border border-radio-surface-raised px-3 py-1.5 text-sm hover:bg-radio-surface-raised">
              {tStates('retry')}
            </button>
          </div>
        ) : filters.active && (filters.loading || !filters.stories) ? (
          <p className="flex justify-center py-4" data-testid="radio-stories-loading">
            <Loader2 className="h-5 w-5 animate-spin text-radio-muted" aria-hidden />
          </p>
        ) : filters.active && filters.stories?.length === 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-radio-secondary" data-testid="radio-filter-empty">
            {t('home.filter.empty')}
            <button type="button" onClick={filters.clear} className="text-xs text-radio-progress underline">
              {t('home.filter.clear')}
            </button>
          </p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-radio-secondary">{t('home.storiesEmpty')}</p>
        ) : (
          stories.map((story) => (
            <article key={story.story_id} data-testid="radio-story" className="flex gap-3 rounded-xl bg-radio-surface p-4">
              <RadioCover kind="story" size={64} />
              <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-radio-text">{story.title}</h3>
              {story.synopsis ? <p className="mt-1 text-sm text-radio-secondary">{story.synopsis}</p> : null}
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
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-radio-accent-start to-radio-accent-end ring-2 ring-radio-ring px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {starting === story.story_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t('home.newStory')}
              </button>
              </div>
            </article>
          ))
        )}
      </Section>

      {/* Serial stories (KAZI-1455): only while the server lists them (`null` = switched off: no section). */}
      {home.storylines ? <SerialSection locale={locale} storylines={home.storylines} started={home.continue_storylines ?? []} /> : null}

      <Section title={t('home.programs')} testId="radio-home-programs">
        {home.programs.length === 0 ? (
          <p className="text-sm text-radio-secondary">{t('home.programsEmpty')}</p>
        ) : (
          home.programs.map((program) => (
            <Link
              key={program.program_id}
              href={radioProgramHref(locale, program.program_id)}
              data-testid="radio-program"
              className="flex gap-3 rounded-xl bg-radio-surface p-4 hover:bg-radio-surface-raised"
            >
              <RadioCover kind="program" size={64} />
              <div className="min-w-0 flex-1">
              {program.series ? <p className="text-xs text-radio-muted">{program.series}</p> : null}
              <h3 className="text-base font-semibold text-radio-text">{program.title}</h3>
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
              </div>
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
          onClosed={() => closeRadio()}
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
  resume,
  children,
}: {
  back: React.ReactNode | null;
  title: string;
  action?: React.ReactNode;
  /** KAZI-1512: the resume bar, under the header; it stays at the top while the home scrolls. */
  resume?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('h-full overflow-y-auto', RADIO_PAGE)} data-testid="radio-home">
      {back ? <div className="mx-auto max-w-2xl px-4 pt-2">{back}</div> : null}
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-10 pt-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-radio-text">{title}</h1>
          {action}
        </div>
        {resume}
        {children}
      </main>
    </div>
  );
}

/**
 * Serial stories on the radio home (personal-radio.md, Serial stories): the story lines the listener has
 * started first (most recently played first), each with "continue" to the episode they were in; then the rest.
 */
function SerialSection({
  locale,
  storylines,
  started,
}: {
  locale: string;
  storylines: RadioStorylineSummary[];
  started: RadioStorylineSummary[];
}) {
  const t = useTranslations('radio');
  const startedIds = new Set(started.map((s) => s.storyline_id));
  const lines = [...started, ...storylines.filter((s) => !startedIds.has(s.storyline_id))];
  return (
    <Section title={t('serial.section')} testId="radio-home-serial">
      {lines.length === 0 ? (
        <p className="text-sm text-radio-secondary">{t('serial.empty')}</p>
      ) : (
        lines.map((line) => (
          <div key={line.storyline_id} data-testid="radio-storyline" className="flex gap-3 rounded-xl bg-radio-surface p-4">
            <RadioCover kind="serial" size={64} />
            <div className="min-w-0 flex-1">
            <Link href={radioStorylineHref(locale, line.storyline_id)} className="block hover:text-radio-progress">
              <h3 className="text-base font-semibold text-radio-text">{line.title}</h3>
              {line.synopsis ? <p className="mt-1 line-clamp-2 text-sm text-radio-secondary">{line.synopsis}</p> : null}
              <p className="mt-2 flex flex-wrap gap-1">
                <Tag>{t('serial.episodes', { n: line.episodes })}</Tag>
                {line.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </p>
            </Link>
            {line.progress ? (
              <Link
                href={radioEpisodeHref(locale, line.storyline_id, line.progress.program_id)}
                data-testid="radio-storyline-continue"
                className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-gradient-to-r from-radio-accent-start to-radio-accent-end ring-2 ring-radio-ring px-3 text-sm text-white"
              >
                {t('serial.continueEpisode', { season: line.progress.season, episode: line.progress.episode })}
              </Link>
            ) : null}
            </div>
          </div>
        ))
      )}
    </Section>
  );
}

function Section({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-radio-text">{title}</h2>
      {children}
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-radio-surface-raised px-2 py-0.5 text-xs text-radio-secondary">{children}</span>;
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
    <article data-testid="radio-continue-card" className="flex items-center justify-between gap-3 rounded-xl bg-radio-surface p-4">
      <RadioCover kind="story" size={48} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-radio-text">{save.title}</h3>
        <p className="mt-0.5 text-xs text-radio-secondary">
          <span data-testid="radio-continue-progress">{t('progress', { n: radioChoiceNumber(save.choices_made) })}</span>
          {' · '}
          {t('lastListened', { date: formatRadioDate(save.updated_at, locale) })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={radioStoryHref(locale, save.save_id)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-gradient-to-r from-radio-accent-start to-radio-accent-end ring-2 ring-radio-ring px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {t('continue')}
        </Link>
        <SaveMenu save={save} locale={locale} onDelete={onDelete} />
      </div>
    </article>
  );
}

/**
 * Resume bar (KAZI-1512; Personal radio 0.35, Radio home): the item the listener was last in, with its cover,
 * title, how far in and a play button in the accent look. It opens the player, which resumes from the sentence
 * where it stopped; nothing plays on the home. Stays at the top (sticky) while the home scrolls.
 */
function ResumeBar({ resume, locale }: { resume: RadioResume; locale: string }) {
  const t = useTranslations('radio');
  const href =
    resume.kind === 'story'
      ? radioStoryHref(locale, resume.save.save_id)
      : radioEpisodeHref(locale, resume.line.storyline_id, resume.line.progress!.program_id);
  const detail =
    resume.kind === 'story'
      ? `${t('studio.progress', { n: radioChoiceNumber(resume.save.choices_made) })} · ${t('studio.lastListened', { date: formatRadioDate(resume.save.updated_at, locale) })}`
      : t('serial.episodeNumber', { season: resume.line.progress!.season, episode: resume.line.progress!.episode });
  return (
    <Link
      href={href}
      data-testid="radio-resume-bar"
      data-kind={resume.kind}
      className="sticky top-0 z-10 -mx-4 flex items-center gap-3 bg-radio-bar px-4 py-2.5 hover:bg-radio-surface"
    >
      <RadioCover kind={resume.kind} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-radio-text">{resume.title}</span>
        <span className="block truncate text-xs text-radio-muted" data-testid="radio-resume-detail">
          {detail}
        </span>
      </span>
      <span className={cn('inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-4 text-sm font-medium', RADIO_ACCENT)}>
        <Play className="h-4 w-4" aria-hidden />
        {t('studio.continue')}
      </span>
    </Link>
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
      <div className="w-full max-w-md rounded-t-2xl bg-radio-surface p-5 sm:rounded-2xl">
        <h2 id="radio-save-limit-title" className="text-base font-semibold">{t('saveLimit.title')}</h2>
        <p className="mt-1 text-sm text-radio-secondary">{t('saveLimit.choose')}</p>
        <div className="mt-3 flex flex-col gap-2">
          {saves.map((s) => (
            <button
              key={s.save_id}
              type="button"
              onClick={() => setPicked(s.save_id)}
              aria-pressed={picked === s.save_id}
              className={cn(
                'min-h-11 rounded-lg border px-3 py-2 text-left text-sm',
                picked === s.save_id ? 'border-radio-ring bg-radio-surface-raised' : 'border-radio-surface-raised'
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
        {pickedSave ? <p className="mt-3 text-xs text-radio-secondary">{t('saveLimit.confirm', { title: pickedSave.title })}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-radio-surface-raised px-4 text-sm">
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!picked}
            onClick={() => picked && onReplace(picked)}
            data-testid="radio-save-limit-replace"
            className="min-h-11 rounded-lg border border-radio-recording-ring px-4 text-sm font-medium text-radio-recording-ring disabled:opacity-50"
          >
            {t('saveLimit.overwrite')}
          </button>
        </div>
      </div>
    </div>
  );
}
