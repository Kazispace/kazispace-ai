'use client';

import { useEffect, useRef, type ReactNode, useCallback, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { ChatHistoryLoadError } from '@/components/chat/chat-history-load-error';
import { ChatSideRailsHost } from '@/components/chat/chat-side-rails-host';
import { useOfflineQueueFlush } from '@/hooks/use-offline-queue-flush';
import { SpaceShell } from '@/components/spaces/space-shell';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { usePendingSpaceAction } from '@/hooks/use-pending-space-action';
import { useHistoryStubHydrate } from '@/hooks/use-history-stub-hydrate';
import {
  useSpaceTurn,
  type SpaceSendResult,
} from '@/hooks/use-space-turn';
import type { JobPracticeContext } from '@/types/jobs';
import { buildReadinessPracticePrompt } from '@/lib/jobs/readiness-practice-prompt';
import {
  resolveNextActionChatPrompt,
  resolveNextActionHref,
} from '@/lib/next-action/resolve';
import { mapStrategySelectTurnContexts } from '@/lib/strategy-select';
import { SpaceMessageList } from '@/components/spaces/space-message-list';
import { resolveActionSelectSubmit } from '@/lib/next-action-submit';
import { isEnglishTutorReviseAction } from '@/lib/english-tutor/custom-components';
import {
  buildSpaceCvPanelHref,
  buildSpaceCvRailHref,
  CV_OPEN_RAIL_QUERY_PARAM,
  CV_RAIL_QUERY_PARAM,
  isLegacyCvHubHref,
  parseJobIdFromHref,
  searchParamsRequestCvRailOpen,
  stripCvRailOpenParams,
} from '@/lib/cv-entry';
import { resolveSpacePanels } from '@/lib/spaces/panels';
import {
  getSpacePanelReturnHref,
  resolveSpacePanelAgentConfig,
} from '@/lib/spaces/panel-agent-config';
import { spaceChatScrollStorageKey } from '@/lib/spaces/chat-scroll';
import { spaceChatFirstPaintKind } from '@/lib/spaces/space-history-ready';
import type { SpaceDetail } from '@/types/spaces';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';
import { cn } from '@/lib/utils';
import { useSpaceStore, useUIStore } from '@/lib/store';
import { answeredTurnSpaceMessages, isAnsweredTurn, type ReplyFormSubmit } from '@/lib/reply-form';
import { publishSessionNavChatSideRailOpen } from '@/lib/session-nav-events';
import { useActiveWorkspaceRailEvents } from '@/hooks/use-active-workspace-chrome';

type SpaceWelcomeKey = 'blankWelcome' | 'jobSprintWelcome' | 'ieltsWelcome';

export type SpaceComposerRenderProps = {
  sendMessage: (text: string) => Promise<SpaceSendResult>;
  isSending: boolean;
  spaceSessionReady: boolean;
  /** True when the space thread has ≥1 user message (Starter collapse scheme A). */
  hasUserMessage: boolean;
};

interface SpaceChatPaneProps {
  locale: string;
  space: SpaceDetail;
  welcomeKey?: SpaceWelcomeKey;
  /** Keep-alive: inactive instances must not take rail events (KAZI-573). */
  active?: boolean;
  composer?:
    | ReactNode
    | ((ctx: SpaceComposerRenderProps) => ReactNode);
}

function resolveSpaceCvEntryHref(
  locale: string,
  space: SpaceDetail,
  jobId?: string | null
): string {
  const panels = resolveSpacePanels(space);
  if (panels.some((p) => p.panel_id === 'cv')) {
    return buildSpaceCvPanelHref(locale, space.id, jobId);
  }
  return buildSpaceCvRailHref(locale, space.id, jobId);
}

function remapCvNavigationForSpace(
  locale: string,
  space: SpaceDetail,
  href: string
): string {
  if (isLegacyCvHubHref(href)) {
    return resolveSpaceCvEntryHref(locale, space, parseJobIdFromHref(href));
  }
  const clinicCv = `/${locale}/chat`;
  if (
    href.startsWith(clinicCv) &&
    (href.includes(`${CV_OPEN_RAIL_QUERY_PARAM}=1`) ||
      href.includes(`${CV_RAIL_QUERY_PARAM}=1`))
  ) {
    return resolveSpaceCvEntryHref(locale, space, parseJobIdFromHref(href));
  }
  return href;
}

/** Shared space orchestrator chat column (POST /spaces/{id}/turn). */
export function SpaceChatPane({
  locale,
  space,
  welcomeKey = 'blankWelcome',
  active = true,
  composer,
}: SpaceChatPaneProps) {
  const t = useTranslations('spaces');
  const tPractice = useTranslations('interview.irp.practice');
  const tStates = useTranslations('states');
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useUIStore((s) => s.showToast);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);
  const panels = useMemo(() => resolveSpacePanels(space), [space]);
  const hasCvPanel = panels.some((p) => p.panel_id === 'cv');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cvRailOpen, setCvRailOpen] = useState(false);
  const [cvRailJobId, setCvRailJobId] = useState<string | null>(null);
  const [cvRailDrillDown, setCvRailDrillDown] = useState(false);
  const [cvRailHubEnabled, setCvRailHubEnabled] = useState(false);

  const publishRail = useCallback(
    (open: boolean) => {
      if (!active) return;
      publishSessionNavChatSideRailOpen(open);
    },
    [active]
  );

  const closeCvRail = useCallback(() => {
    setCvRailOpen(false);
    setCvRailJobId(null);
    setCvRailDrillDown(false);
    setCvRailHubEnabled(false);
    publishRail(false);
  }, [publishRail]);

  const openWorkspaceRail = useCallback(() => {
    setCvRailJobId(null);
    setCvRailDrillDown(false);
    setCvRailHubEnabled(true);
    setCvRailOpen(true);
    publishRail(true);
  }, [publishRail]);

  const openCvRail = useCallback(
    (
      targetJobId?: string | null,
      options?: { drillDown?: boolean }
    ) => {
      const jobId = targetJobId?.trim() || null;
      setCvRailJobId(jobId);
      setCvRailDrillDown(Boolean(options?.drillDown) || Boolean(jobId));
      setCvRailHubEnabled(false);
      setCvRailOpen(true);
      publishRail(true);
    },
    [publishRail]
  );

  const openCvRailRef = useRef(openCvRail);
  openCvRailRef.current = openCvRail;
  const openWorkspaceRailRef = useRef(openWorkspaceRail);
  openWorkspaceRailRef.current = openWorkspaceRail;
  const closeCvRailRef = useRef(closeCvRail);
  closeCvRailRef.current = closeCvRail;
  const cvRailOpenRef = useRef(cvRailOpen);
  cvRailOpenRef.current = cvRailOpen;

  const onOpenWorkspaceRail = useCallback(() => {
    openWorkspaceRailRef.current();
  }, []);
  const onToggleWorkspaceRail = useCallback(() => {
    if (cvRailOpenRef.current) {
      closeCvRailRef.current();
      return;
    }
    openWorkspaceRailRef.current();
  }, []);
  useActiveWorkspaceRailEvents(active && !hasCvPanel, {
    onOpen: onOpenWorkspaceRail,
    onToggle: onToggleWorkspaceRail,
  });
  const {
    messages,
    isHydrating,
    isHistoryFetching,
    historyError,
    historyReady,
    isSending,
    replyNotice,
    sendMessage,
    retryMessage,
    retryHistory,
    hydrateHistoryStubs,
  } = useSpaceTurn(space.id, space.master_session_id, locale, space.space_state);

  const handleJobCardClick = useCallback(
    (card: ChatJobCard) => {
      if (card.job_id) {
        setSelectedJobId(card.job_id);
        return;
      }
      // Teasers without an id still need a destination (list page).
      router.push(`/${locale}/jobs`);
    },
    [locale, router]
  );

  const closeJobDetail = useCallback(() => {
    setSelectedJobId(null);
  }, []);

  const cvRailTransition = useMemo(() => {
    if (hasCvPanel) return undefined;
    const { fromSurface } = resolveSpacePanelAgentConfig('cv_workspace');
    return {
      fromSurface,
      returnHref: getSpacePanelReturnHref(locale, space.id),
    };
  }, [hasCvPanel, locale, space.id]);

  useEffect(() => {
    if (!active || hasCvPanel) return;
    if (!searchParamsRequestCvRailOpen(searchParams)) return;

    const jobId = searchParams.get('job_id')?.trim() || null;
    openCvRailRef.current(jobId);

    const q = stripCvRailOpenParams(searchParams).toString();
    router.replace(
      `/${locale}/spaces/${encodeURIComponent(space.id)}${q ? `?${q}` : ''}`,
      { scroll: false }
    );
  }, [active, hasCvPanel, searchParams, locale, router, space.id]);

  // Defensive: BE should always bind master_session_id; empty means provision incomplete.
  const spaceSessionReady = Boolean(space.master_session_id?.trim());
  const firstPaintKind = spaceChatFirstPaintKind({
    historyReady,
    isHydrating,
    messageCount: messages.length,
    historyError,
    isFetching: isHistoryFetching,
  });
  const scrollReady = spaceSessionReady && historyReady;
  // Windowed history (KAZI-580): first pack is 200 full + older stubs.
  const hasUserMessage = messages.some((m) => m.role === 'user');

  const {
    scrollRef,
    showJumpToLatest,
    handleScroll,
    jumpToLatest,
    pinToLatestOnSend,
  } = useChatScroll({
    storageKey: spaceChatScrollStorageKey(space.id),
    messageCount: messages.length,
    isSending,
    ready: scrollReady,
    alignToLatest: true,
    activationKey: active ? 'active' : 'idle',
  });

  useHistoryStubHydrate({
    enabled: active && scrollReady,
    messages,
    scrollRoot: scrollRef,
    hydrate: hydrateHistoryStubs,
  });

  const sendAndPin = useCallback(
    async (
      text: string,
      opts?: {
        displayContent?: string;
        actionMeta?: import('@/types/chat-envelope').UserMessageActionMeta;
      }
    ) => {
      pinToLatestOnSend();
      return sendMessage(text, opts);
    },
    [pinToLatestOnSend, sendMessage],
  );

  const handleFocusComposer = useCallback(() => {
    requestComposerInsert('', 'space', 'append');
  }, [requestComposerInsert]);

  const handleExamSelect = useCallback(
    (option: import('@/types/english-tutor-envelope').ExamPickerOption) => {
      if (isSending) return;
      void sendAndPin(option.label);
    },
    [isSending, sendAndPin]
  );

  // KAZI-1041 / KAZI-1145: a `meta.form` answer (english_tutor or cv_builder) —
  // same send path as next_action payloads; returning the promise keeps the
  // form busy until the turn lands. A CV upload arrives already answered
  // (/inputs returned the reply): append it to this space's thread.
  const handleEtFormSubmit = useCallback(
    async (submit: ReplyFormSubmit) => {
      // The upload already happened server-side: never drop its reply.
      if (isAnsweredTurn(submit)) {
        pinToLatestOnSend();
        const [user, assistant] = answeredTurnSpaceMessages(submit);
        useSpaceStore
          .getState()
          .patchSpaceMessages(space.id, (prev) => [...prev, user, assistant]);
        return;
      }
      if (isSending) return;
      await sendAndPin(submit.display, {
        displayContent: submit.display,
        actionMeta: submit.meta,
      });
    },
    [isSending, pinToLatestOnSend, sendAndPin, space.id]
  );

  const handlePracticeForJob = useCallback(
    (ctx: JobPracticeContext) => {
      if (isSending) return;
      // Immediate send in the Space chat column (keep readiness rail open).
      // Do not prefill composer — insert+send races leave duplicate draft text.
      const prompt = buildReadinessPracticePrompt(tPractice, {
        jobTitle: ctx.jobTitle,
        weaknessLabels: ctx.weaknessLabels,
      });
      void sendAndPin(prompt);
    },
    [isSending, sendAndPin, tPractice]
  );

  const handleNextAction = useCallback(
    (action: ChatNextAction) => {
      const actionSubmit = resolveActionSelectSubmit(action, locale);
      if (actionSubmit) {
        void sendAndPin(actionSubmit.display, {
          displayContent: actionSubmit.display,
          actionMeta: actionSubmit.meta,
        });
        return;
      }

      if (isEnglishTutorReviseAction(action.type)) {
        requestComposerInsert('', 'space', 'append');
        return;
      }

      const rawHref = resolveNextActionHref(locale, action);
      if (rawHref) {
        const href = remapCvNavigationForSpace(locale, space, rawHref);
        try {
          const url = new URL(href, 'https://kazispace.local');
          const spacePath = `/${locale}/spaces/${encodeURIComponent(space.id)}`;
          if (
            !hasCvPanel &&
            url.pathname === spacePath &&
            searchParamsRequestCvRailOpen(url.searchParams)
          ) {
            openCvRail(parseJobIdFromHref(href));
            const q = stripCvRailOpenParams(url.searchParams).toString();
            router.replace(`${spacePath}${q ? `?${q}` : ''}`, { scroll: false });
            return;
          }
        } catch {
          // fall through to router.push
        }
        router.push(href);
        return;
      }
      const prompt = resolveNextActionChatPrompt(action, locale);
      if (prompt) {
        void sendAndPin(prompt);
      }
    },
    [hasCvPanel, locale, openCvRail, requestComposerInsert, router, sendAndPin, space]
  );

  // KAZI-1083: the ability panel's 「练这个」 hands its `et_next_practice` action to this
  // space's chat — the same send path as the button on a graded turn (ET SSOT v1.98 ①).
  usePendingSpaceAction(space.id, isSending, handleNextAction);

  const composerNode =
    typeof composer === 'function'
      ? composer({
          sendMessage: sendAndPin,
          isSending,
          spaceSessionReady,
          hasUserMessage,
        })
      : composer;

  const handleRetryById = useCallback(
    (messageId: string) => {
      pinToLatestOnSend();
      void retryMessage(messageId);
    },
    [pinToLatestOnSend, retryMessage]
  );

  // D16: send what was typed offline, in order, once the connection returns.
  useOfflineQueueFlush(
    () =>
      messages
        .filter((m) => m.role === 'user' && m.status === 'queued')
        .map((m) => m.id),
    (messageId) => retryMessage(messageId)
  );

  const strategyContexts = useMemo(
    () => mapStrategySelectTurnContexts(messages, locale),
    [locale, messages]
  );

  const jumpOverlay = showJumpToLatest ? (
    <button
      type="button"
      onClick={jumpToLatest}
      className={cn(
        'absolute bottom-3 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2',
        'items-center justify-center rounded-full border border-gray-100 bg-white',
        'shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity hover:bg-gray-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      )}
      aria-label={t('scrollToLatest')}
    >
      <ChevronDown className="h-5 w-5 text-workspace-text" strokeWidth={2} aria-hidden />
    </button>
  ) : null;

  return (
    <ChatSideRailsHost
      jobId={selectedJobId}
      locale={locale}
      onCloseJob={closeJobDetail}
      cvRail={{
        open: !hasCvPanel && cvRailOpen,
        jobId: cvRailJobId,
        drillDown: cvRailDrillDown,
        hubEnabled: cvRailHubEnabled,
      }}
      onCloseCv={closeCvRail}
      cvRailTransition={cvRailTransition}
      onPracticeForJob={handlePracticeForJob}
      practiceDisabled={isSending}
      className="h-full w-full"
    >
      <SpaceShell
        locale={locale}
        space={space}
        footer={composerNode ?? null}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        scrollOverlay={jumpOverlay}
      >
        <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-col gap-3">
          {!spaceSessionReady ? (
            <p className="py-8 text-center text-sm text-red-600">{t('spaceNotReady')}</p>
          ) : firstPaintKind === 'loading' ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              <p className="text-sm">{t('loading')}</p>
            </div>
          ) : firstPaintKind === 'error' ? (
            <ChatHistoryLoadError
              message={t('historyLoadFailed')}
              retryLabel={tStates('retry')}
              onRetry={() => {
                void retryHistory();
              }}
              disabled={isHistoryFetching}
            />
          ) : firstPaintKind === 'welcome' ? (
            <p className="py-8 text-center text-sm text-workspace-muted">{t(welcomeKey)}</p>
          ) : (
            <SpaceMessageList
              messages={messages}
              strategyContexts={strategyContexts}
              scrollParentRef={scrollRef}
              locale={locale}
              actionsDisabled={isSending}
              alignToLatest
              activationKey={active ? 'active' : 'idle'}
              onRetryById={handleRetryById}
              onNextAction={handleNextAction}
              onFocusComposer={handleFocusComposer}
              onExamSelect={handleExamSelect}
              onEtFormSubmit={handleEtFormSubmit}
              onJobCardClick={handleJobCardClick}
            />
          )}
          {isSending ? (
            <MessageBubble
              role="assistant"
              content=""
              locale={locale}
              variant="clinic"
              isStreaming
              streamComplete={false}
            />
          ) : null}
          {replyNotice ? (
            <div className="flex flex-col items-center gap-1">
              <p
                className={cn(
                  'text-center text-xs',
                  replyNotice.kind === 'pending' ? 'text-workspace-muted' : 'text-red-600'
                )}
              >
                {replyNotice.message}
              </p>
            </div>
          ) : null}
        </div>
      </SpaceShell>
    </ChatSideRailsHost>
  );
}
