'use client';

import { useEffect, useRef, type ReactNode, useCallback, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { MessageBubble } from '@/components/clinic/message-bubble';
import { ChatSideRailsHost } from '@/components/chat/chat-side-rails-host';
import { SpaceShell } from '@/components/spaces/space-shell';
import { useChatScroll } from '@/hooks/use-chat-scroll';
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
import type { SpaceDetail } from '@/types/spaces';
import type { ChatJobCard, ChatNextAction } from '@/types/chat-envelope';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';
import {
  publishSessionNavChatSideRailOpen,
  SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT,
  SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT,
} from '@/lib/session-nav-events';

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
  composer,
}: SpaceChatPaneProps) {
  const t = useTranslations('spaces');
  const tRailHub = useTranslations('cv.railHub');
  const tChat = useTranslations('chat');
  const tPractice = useTranslations('interview.irp.practice');
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useUIStore((s) => s.showToast);
  const panels = useMemo(() => resolveSpacePanels(space), [space]);
  const hasCvPanel = panels.some((p) => p.panel_id === 'cv');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [cvRailOpen, setCvRailOpen] = useState(false);
  const [cvRailJobId, setCvRailJobId] = useState<string | null>(null);
  const [cvRailDrillDown, setCvRailDrillDown] = useState(false);
  const [cvRailHubEnabled, setCvRailHubEnabled] = useState(false);

  const closeCvRail = useCallback(() => {
    setCvRailOpen(false);
    setCvRailJobId(null);
    setCvRailDrillDown(false);
    setCvRailHubEnabled(false);
    publishSessionNavChatSideRailOpen(false);
  }, []);

  const openWorkspaceRail = useCallback(() => {
    setCvRailJobId(null);
    setCvRailDrillDown(false);
    setCvRailHubEnabled(true);
    setCvRailOpen(true);
    publishSessionNavChatSideRailOpen(true);
  }, []);

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
      publishSessionNavChatSideRailOpen(true);
    },
    []
  );

  const openCvRailRef = useRef(openCvRail);
  openCvRailRef.current = openCvRail;
  const openWorkspaceRailRef = useRef(openWorkspaceRail);
  openWorkspaceRailRef.current = openWorkspaceRail;
  const closeCvRailRef = useRef(closeCvRail);
  closeCvRailRef.current = closeCvRail;
  const cvRailOpenRef = useRef(cvRailOpen);
  cvRailOpenRef.current = cvRailOpen;

  useEffect(() => {
    const onPanelBlocked = () => {
      showToast(tRailHub('workspaceRailUseCvPanel'), 'info');
    };
    const onOpenWorkspaceRail = () => {
      if (hasCvPanel) {
        onPanelBlocked();
        return;
      }
      openWorkspaceRailRef.current();
    };
    const onToggleWorkspaceRail = () => {
      if (hasCvPanel) {
        onPanelBlocked();
        return;
      }
      if (cvRailOpenRef.current) {
        closeCvRailRef.current();
        return;
      }
      openWorkspaceRailRef.current();
    };
    window.addEventListener(SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT, onOpenWorkspaceRail);
    window.addEventListener(
      SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT,
      onToggleWorkspaceRail
    );
    return () => {
      window.removeEventListener(
        SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT,
        onOpenWorkspaceRail
      );
      window.removeEventListener(
        SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT,
        onToggleWorkspaceRail
      );
    };
  }, [hasCvPanel, showToast, tRailHub]);
  const {
    messages,
    isHydrating,
    historyReady,
    isSending,
    replyNotice,
    sendMessage,
    retryMessage,
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
    if (hasCvPanel) return;
    if (!searchParamsRequestCvRailOpen(searchParams)) return;

    const jobId = searchParams.get('job_id')?.trim() || null;
    openCvRailRef.current(jobId);

    const q = stripCvRailOpenParams(searchParams).toString();
    router.replace(
      `/${locale}/spaces/${encodeURIComponent(space.id)}${q ? `?${q}` : ''}`,
      { scroll: false }
    );
  }, [hasCvPanel, searchParams, locale, router, space.id]);

  // Defensive: BE should always bind master_session_id; empty means provision incomplete.
  const spaceSessionReady = Boolean(space.master_session_id?.trim());
  // Use mount-local historyReady — store !isHydrating is stale-false on remount first paint.
  const scrollReady = spaceSessionReady && historyReady;
  // Spaces hydrate full master-session history (not infinite-scroll pages) — safe for Starter.
  // If history ever becomes windowed, replace with a BE/meta flag (PR #130 P3).
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
  });

  const sendAndPin = useCallback(
    async (text: string) => {
      pinToLatestOnSend();
      return sendMessage(text);
    },
    [pinToLatestOnSend, sendMessage],
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
    [hasCvPanel, locale, openCvRail, router, sendAndPin, space]
  );

  const composerNode =
    typeof composer === 'function'
      ? composer({
          sendMessage: sendAndPin,
          isSending,
          spaceSessionReady,
          hasUserMessage,
        })
      : composer;

  const handleRetryNotice = () => {
    if (!replyNotice?.retryMessageId) return;
    pinToLatestOnSend();
    void retryMessage(replyNotice.retryMessageId);
  };

  const jumpOverlay = showJumpToLatest ? (
    <button
      type="button"
      onClick={jumpToLatest}
      className={cn(
        'absolute bottom-3 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2',
        'items-center justify-center rounded-full border border-gray-100 bg-white',
        'shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity hover:bg-gray-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
      )}
      aria-label={t('scrollToLatest')}
    >
      <ChevronDown className="h-5 w-5 text-[#1D2129]" strokeWidth={2} aria-hidden />
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
          ) : (!historyReady || isHydrating) && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" aria-hidden />
              <p className="text-sm">{t('loading')}</p>
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#86909C]">{t(welcomeKey)}</p>
          ) : (
            messages.map((message) => (
              // Omit surface="workspace": that prop only changes MessageBubble
              // assistant chrome (peach vs clinic gray). Cards / next_actions / CV
              // routing use composerTarget="space", not surface.
              <MessageBubble
                key={message.id}
                role={message.role}
                content={message.content}
                messageId={message.id}
                serverMessageId={message.serverMessageId}
                status={message.status}
                cards={message.cards}
                nextActions={message.nextActions}
                locale={locale}
                variant="clinic"
                composerTarget="space"
                streamComplete
                onJobCardClick={handleJobCardClick}
                onNextAction={handleNextAction}
                actionsDisabled={isSending}
                onRetry={
                  message.role === 'user' && message.status === 'failed'
                    ? () => {
                        pinToLatestOnSend();
                        void retryMessage(message.id);
                      }
                    : undefined
                }
              />
            ))
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
                  replyNotice.kind === 'pending' ? 'text-[#86909C]' : 'text-red-600'
                )}
              >
                {replyNotice.message}
              </p>
              {replyNotice.retryable && replyNotice.retryMessageId ? (
                <button
                  type="button"
                  onClick={handleRetryNotice}
                  disabled={isSending}
                  className="text-xs text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {tChat('retry')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </SpaceShell>
    </ChatSideRailsHost>
  );
}
