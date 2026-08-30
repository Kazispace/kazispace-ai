"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChatHeader } from "./chat-header";
import { WelcomeView } from "./welcome-view";
import { MessageBubble } from "./message-bubble";
import { ClinicMessageList } from "./clinic-message-list";
import { SwitchingOverlay } from "./switching-overlay";
import { LayerIndicator } from "./layer-indicator";
import { AgentSwitchDialog } from "./agent-switch-dialog";
import { QuickReplies } from "./quick-replies";
import { AgentSwitcher } from "./agent-switcher";
import { ReferralPrompt } from "./referral-prompt";
import {
  ClinicStarterCapabilityToolbar,
  ClinicStarterExampleStrip,
  resolveLatestClinicNextActions,
  shouldHideClinicStarterForNextActions,
  useClinicStarterPromptsController,
} from "./clinic-starter";
import { ClinicParkedCapabilityBanner } from "./clinic-parked-capability-banner";
import { ConfirmAbandonSessionDialog } from "@/components/session-nav/confirm-abandon-session-dialog";
import { VoiceEnabledChatInput } from "@/components/chat/voice-enabled-chat-input";
import { ChatHistoryLoadError } from "@/components/chat/chat-history-load-error";
import { ChatSideRailsHost } from "@/components/chat/chat-side-rails-host";
import type { JobPracticeContext } from "@/types/jobs";
import { useClinicChat } from "@/hooks/use-clinic-chat";
import { buildReadinessPracticePrompt } from "@/lib/jobs/readiness-practice-prompt";
import { useChatScroll } from "@/hooks/use-chat-scroll";
import { useHistoryStubHydrate } from "@/hooks/use-history-stub-hydrate";
import { clinicChatScrollStorageKey } from "@/lib/spaces/chat-scroll";
import { cn } from "@/lib/utils";
import { useActiveAgentSessions } from "@/hooks/use-active-agent-sessions";
import {
  needsParkReplaceConfirm,
  selectParkedInteractiveFromMap,
} from "@/lib/clinic/parked-capability";
import { newAgentSession } from "@/lib/agent-api";
import { openHubAgentSession } from "@/lib/hub-agent-open";
import { getAgentHubPath } from "@/lib/agent-transition/surfaces";
import { publishSessionNavInvalidate } from "@/lib/session-nav-invalidate";
import {
  publishSessionNavChatSideRailOpen,
} from "@/lib/session-nav-events";
import { useLayerStatusBadge } from "@/hooks/use-layer-status-badge";
import { useActiveAgentSync } from "@/hooks/use-active-agent-sync";
import { useActiveWorkspaceRailEvents } from "@/hooks/use-active-workspace-chrome";
import { getDeepLinkAgentId, getDeepLinkReferralId, clearReferralFromUrl, stripAgentParamsFromUrl, useAgentSwitch } from "@/hooks/use-agent-switch";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useNbaAction } from "@/hooks/use-nba-action";
import { useAuthStore, useAgentStore, useSpaceStore, useUIStore } from "@/lib/store";
import { useEmbeddedInWorkspaceShell } from "@/lib/workspace-shell-context";
import { CLINIC_SPACE_ID, isSpacesEnabled } from "@/lib/spaces/constants";
import {
  AGENT_REGISTRY,
  AGENT_QUICK_REPLIES,
  getAgentLabel,
} from "@/lib/agents/registry";
import { getEnglishLevel } from "@/lib/auth";
import { dismissReferral, isReferralDismissed, clearExpiredReferralDismissals } from "@/lib/referral-dismiss";
import {
  clearExpiredSpaceNudgeDismissals,
  dismissSpaceNudge,
  type SpaceNudgePayload,
} from "@/lib/spaces/space-nudge";
import { createSpace } from "@/lib/spaces-api";
import { publishSpacesListInvalidate } from "@/lib/spaces-list-invalidate";
import { consumePendingTmaAction, routeForTmaAction } from "@/lib/tma-routing";
import {
  CV_BUILDER_AGENT_ID,
  isCvBuilderAgent,
} from "@/lib/cv-agent-config";
import {
  ENGLISH_TUTOR_AGENT_ID,
  isEnglishTutorAgent,
  shouldRouteToEnglishEpp,
} from "@/lib/english-tutor-config";
import {
  isMockInterviewAgent,
  MOCK_INTERVIEW_AGENT_ID,
} from "@/lib/mock-interview-config";
import { setCvAgentHandoff } from "@/lib/cv-agent-handoff";
import {
  isClinicCvRailOpenHref,
  parseJobIdFromHref,
  searchParamsRequestCvRailOpen,
  stripCvRailOpenParams,
} from "@/lib/cv-entry";
import { AgentSessionPanel } from "@/components/agent/agent-session-panel";
import { useAgentSessionList } from "@/hooks/use-agent-session-list";
import { activateAgent, fetchAgentMessages } from "@/lib/agent-api";
import {
  isAgentSessionReadOnly,
  mapAgentHistoryToChatMessages,
  resolveWorkflowFromMessages,
} from "@/lib/agent-sessions";
import { HubWorkflowStrip } from "@/components/hub/hub-workflow-strip";
import { publishActiveAgentSync } from "@/lib/active-agent-sync";
import { deactivateToClinic } from "@/lib/deactivate-to-clinic";
import { followAgentEscalation } from "@/lib/agent-escalation";
import { toPendingAgentSwitch } from "@/lib/agent-pending-transition";
import { hasStickyActiveAgent, isDedicatedHubAgent } from "@/lib/agent-layer";
import type { SupportedLocale } from "@/lib/constants";
import type { ChatJobCard, ChatNextAction } from "@/types";
import { Button } from "@/components/ui/button";
import { getCompleteProfileHref } from "@/lib/profile-routing";
import { bootstrapBase } from "@/lib/region";
import { clinicHistoryBootstrapOutcome } from "@/lib/clinic/history-bootstrap";
import { shouldClinicReplyRouteToInterviewHub } from "@/lib/clinic-interview-routing";
import {
  resolveNextActionChatPrompt,
  resolveNextActionHref,
} from "@/lib/next-action/resolve";
import { mapStrategySelectTurnContexts } from "@/lib/strategy-select";
import { resolveActionSelectSubmit } from "@/lib/next-action-submit";
import { buildResearchHandoffMessage } from "@/lib/clinic/upgrade-cta";
import { isEnglishTutorReviseAction } from "@/lib/english-tutor/custom-components";

interface ClinicShellProps {
  locale: string;
  /** Keep-alive hidden instance must not re-bootstrap or steal rail events (KAZI-588). */
  active?: boolean;
}

export function ClinicShell({ locale, active = true }: ClinicShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("chat");
  const tClinic = useTranslations("clinic");
  const tPractice = useTranslations("interview.irp.practice");
  const tReferral = useTranslations("referral");
  const tSessions = useTranslations("agentSessions");
  const tSessionNav = useTranslations("sessionNav");
  const tSpaces = useTranslations("spaces");
  // MVP: one in-flight accept at a time (BE emits at most one live nudge per reply).
  const [spaceNudgeBusy, setSpaceNudgeBusy] = useState(false);

  const switcherOpen = useAgentStore((s) => s.switcherOpen);
  const setSwitcherOpen = useAgentStore((s) => s.setSwitcherOpen);
  const setPendingAgentSwitch = useAgentStore((s) => s.setPendingAgentSwitch);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const tmaInitComplete = useUIStore((s) => s.tmaInitComplete);
  const embeddedInWorkspace = useEmbeddedInWorkspaceShell();

  const [cvRailOpen, setCvRailOpen] = useState(false);
  const [cvRailJobId, setCvRailJobId] = useState<string | null>(null);
  const [cvRailDrillDown, setCvRailDrillDown] = useState(false);

  const openCvRail = useCallback(
    (
      targetJobId?: string | null,
      options?: { drillDown?: boolean }
    ) => {
      const jobId = targetJobId?.trim() || null;
      setCvRailJobId(jobId);
      setCvRailDrillDown(Boolean(options?.drillDown) || Boolean(jobId));
      setCvRailOpen(true);
      publishSessionNavChatSideRailOpen(true);
    },
    []
  );

  const closeCvRail = useCallback(() => {
    setCvRailOpen(false);
    setCvRailJobId(null);
    setCvRailDrillDown(false);
    publishSessionNavChatSideRailOpen(false);
  }, []);

  const openCvRailRef = useRef(openCvRail);
  openCvRailRef.current = openCvRail;
  const cvRailOpenRef = useRef(cvRailOpen);
  cvRailOpenRef.current = cvRailOpen;
  const closeCvRailRef = useRef(closeCvRail);
  closeCvRailRef.current = closeCvRail;

  /** In-app / external `?open_cv=1` (or legacy `?cv=1`) — not tied to bootstrap layerReady. */
  useEffect(() => {
    if (!active) return;
    if (!searchParamsRequestCvRailOpen(searchParams)) return;

    const jobId = searchParams.get("job_id")?.trim() || null;
    openCvRailRef.current(jobId);

    const q = stripCvRailOpenParams(searchParams).toString();
    router.replace(`/${locale}/chat${q ? `?${q}` : ""}`, { scroll: false });
  }, [active, searchParams, locale, router]);

  const onOpenWorkspaceRail = useCallback(() => {
    openCvRailRef.current(undefined, { drillDown: false });
  }, []);
  const onToggleWorkspaceRail = useCallback(() => {
    if (cvRailOpenRef.current) {
      closeCvRailRef.current();
      return;
    }
    openCvRailRef.current(undefined, { drillDown: false });
  }, []);
  useActiveWorkspaceRailEvents(active, {
    onOpen: onOpenWorkspaceRail,
    onToggle: onToggleWorkspaceRail,
  });

  const routeInterviewPage = useCallback(
    (targetJobId?: string | null) => {
      const query = targetJobId
        ? `?job_id=${encodeURIComponent(targetJobId)}`
        : "";
      router.push(`/${locale}/interview${query}`);
    },
    [locale, router]
  );

  const routeEnglishPage = useCallback(() => {
    router.push(`/${locale}/english`);
  }, [locale, router]);

  const switchContext = useMemo(
    () => ({
      fromSurface: "clinic" as const,
      navigate: (href: string) => router.replace(href),
    }),
    [router]
  );

  const {
    messages: clinicMessages,
    isSending: isClinicSending,
    isStreaming: isClinicStreaming,
    isHistoryLoading,
    loadHistory,
    skipHistoryLoad,
    sendMessage: sendClinicMessage,
    retryMessage,
    markStreamComplete,
    dismissMessageReferral,
    dismissMessageSpaceNudge,
    dismissMessageUpgradeCta,
    hydrateHistoryStubs,
  } = useClinicChat(locale);

  const {
    activeAgentId,
    agentSessionId,
    isSwitching,
    fetchActiveAgent,
    resumeActiveAgentSilently,
    activateAgentWithoutPrecheck,
    requestAgentSwitch,
    pendingAgentSwitch,
    confirmPendingAgentSwitch,
    cancelPendingAgentSwitch,
    syncActiveAgentFromGateway,
    exitToClinic,
  } = useAgentSwitch(locale, switchContext);

  const { sessionsByAgent, refresh: refreshCurrentSessions } =
    useActiveAgentSessions();

  const parkedInteractive = useMemo(
    () => selectParkedInteractiveFromMap(sessionsByAgent),
    [sessionsByAgent]
  );

  /** INV-P2: Hub card opens new Cap while another is parked → ConfirmAbandon (G6). */
  const [parkReplaceTargetId, setParkReplaceTargetId] = useState<string | null>(
    null
  );
  const [parkReplaceBusy, setParkReplaceBusy] = useState(false);

  // Active-session multi-badge banner removed (KAZI-198); Park chip is KAZI-269.
  const requestAgentSwitchRef = useRef(requestAgentSwitch);
  const fetchActiveAgentRef = useRef(fetchActiveAgent);
  const resumeActiveAgentSilentlyRef = useRef(resumeActiveAgentSilently);
  const exitToClinicRef = useRef(exitToClinic);
  // KAZI-660 review (PR #210): parkedInteractive changes identity whenever
  // sessionsByAgent updates (session refresh / park / agent switch), which
  // would undermine the same stability requestAgentSwitchRef exists to give
  // handleAgentSelect. Read the latest value via ref instead of a dep.
  const parkedInteractiveRef = useRef(parkedInteractive);
  requestAgentSwitchRef.current = requestAgentSwitch;
  fetchActiveAgentRef.current = fetchActiveAgent;
  resumeActiveAgentSilentlyRef.current = resumeActiveAgentSilently;
  exitToClinicRef.current = exitToClinic;
  parkedInteractiveRef.current = parkedInteractive;

  const {
    messages: agentMessages,
    isAgentSending,
    isAgentStreaming,
    loadAgentHistory,
    sendMessage: sendAgentMessage,
  } = useAgentChat(activeAgentId, agentSessionId, locale);

  const { nba: nbaResponse, isLoading: nbaLoading } = useNbaAction();

  const loadHistoryRef = useRef(loadHistory);
  loadHistoryRef.current = loadHistory;

  const loadAgentHistoryRef = useRef(loadAgentHistory);
  loadAgentHistoryRef.current = loadAgentHistory;

  /** Hub agent id already cold-opened on Clinic — avoids reconcile/focus reload loops. */
  const clinicHubColdOpenRef = useRef<string | null>(null);
  const pendingClinicHistoryReloadRef = useRef(false);
  const didClinicBootstrapRef = useRef(false);

  const reloadClinicHistoryIfIdle = useCallback(async () => {
    if (useSpaceStore.getState().getSpaceSlice(CLINIC_SPACE_ID).isSending) {
      pendingClinicHistoryReloadRef.current = true;
      return true;
    }
    pendingClinicHistoryReloadRef.current = false;
    return loadHistoryRef.current();
  }, []);

  /**
   * Clinic cold-open (ADR-005 INV-6): user is on /chat while a dedicated hub session
   * remains active on the server. Clear local UI focus and load Clinic history only —
   * no deactivate, no redirect to Hub. Hub pages resume via their own entry hooks.
   */
  const stayInClinicForDedicatedHub = useCallback(
    async (hubAgentId: string): Promise<boolean> => {
      const localActive = useAgentStore.getState().activeAgentId;
      if (
        clinicHubColdOpenRef.current === hubAgentId &&
        localActive === null
      ) {
        return true;
      }
      clinicHubColdOpenRef.current = hubAgentId;
      useAgentStore.getState().setActiveAgent(null, null);
      return reloadClinicHistoryIfIdle();
    },
    [reloadClinicHistoryIfIdle]
  );

  const reconcileActiveAgentLayer = useCallback(async () => {
    const active = await fetchActiveAgentRef.current();
    if (hasStickyActiveAgent(active)) {
      if (isDedicatedHubAgent(active.active_agent)) {
        await stayInClinicForDedicatedHub(active.active_agent);
        setLayerReady(true);
        return;
      }
      clinicHubColdOpenRef.current = null;
      await resumeActiveAgentSilentlyRef.current(
        active.active_agent,
        active.session_id
      );
      skipHistoryLoad();
      setLayerReady(true);
      return;
    }

    clinicHubColdOpenRef.current = null;
    useAgentStore.getState().setActiveAgent(null, null);
    await reloadClinicHistoryIfIdle();
    setLayerReady(true);
  }, [skipHistoryLoad, stayInClinicForDedicatedHub, reloadClinicHistoryIfIdle]);

  // Calls loadHistory directly rather than via loadHistoryRef (KAZI-660
  // review, PR #210): loadHistory's own deps are [setSpaceMessages,
  // setSpaceMasterSessionId, queryClient] (KAZI-651 Phase C.1b; queryClient
  // added for the fetchQuery-based dedup) — the two
  // `useSpaceStore` actions are defined once in create(), and `queryClient`
  // (useQueryClient()) is created once in providers.tsx; all three are
  // stable for their respective lifetimes, so loadHistory (and this
  // callback, and handleBackToClinic below which depends on this) don't
  // churn identity on Clinic re-renders. If any of them is ever replaced
  // with something that isn't stable, this stops holding and should move to
  // a ref.
  const reloadClinicIfNeeded = useCallback(
    async (result?: { reloadClinic?: boolean; ok?: boolean }) => {
      if (result?.reloadClinic && isLoggedIn) {
        await loadHistory();
      }
    },
    [isLoggedIn, loadHistory]
  );

  /** KAZI-321: mock_interview stays in Clinic thread; optional deep-link only via open_interview / explicit path. */
  const [isOnline, setIsOnline] = useState(false);
  const [englishLevel, setEnglishLevelState] = useState<string | null>(null);
  const [pendingReferral, setPendingReferral] = useState<{
    agentId: string;
    reason: string;
  } | null>(null);
  const [layerReady, setLayerReady] = useState(false);
  const [switchConfirming, setSwitchConfirming] = useState(false);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [historyReadOnly, setHistoryReadOnly] = useState(false);
  const [isSwitchingSession, setIsSwitchingSession] = useState(false);
  const [clinicHistoryLoadFailed, setClinicHistoryLoadFailed] = useState(false);
  const sessionHistoryTriggerRef = useRef<HTMLElement | null>(null);
  const manualSessionSelectRef = useRef(false);
  const sessionSwitchGenRef = useRef(0);

  const {
    sessions: agentSessions,
    isLoading: agentSessionsLoading,
    refresh: refreshAgentSessions,
  } = useAgentSessionList(activeAgentId, isLoggedIn && !!activeAgentId);

  const setAgentMessages = useAgentStore((s) => s.setAgentMessages);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);

  const handleAgentSessionSelect = useCallback(
    async (sessionId: string) => {
      if (!activeAgentId || sessionId === agentSessionId) return;

      const entry = agentSessions.find((s) => s.session_id === sessionId);
      setHistoryReadOnly(isAgentSessionReadOnly(entry?.status));

      const gen = ++sessionSwitchGenRef.current;
      setIsSwitchingSession(true);
      manualSessionSelectRef.current = true;
      setActiveAgent(activeAgentId, sessionId);

      const hist = await fetchAgentMessages(sessionId);
      if (gen !== sessionSwitchGenRef.current) return;

      if (!hist.success || !hist.data) {
        showToast(tSessions("sessionLoadFailed"), "error");
        setIsSwitchingSession(false);
        return;
      }

      setAgentMessages(
        activeAgentId,
        mapAgentHistoryToChatMessages(hist.data.messages, sessionId, locale)
      );
      setIsSwitchingSession(false);
    },
    [
      activeAgentId,
      agentSessionId,
      agentSessions,
      locale,
      setActiveAgent,
      setAgentMessages,
      showToast,
      tSessions,
    ]
  );

  const handleAgentNewSession = useCallback(async () => {
    if (
      !activeAgentId ||
      isAgentSending ||
      isSwitching ||
      isSwitchingSession
    ) {
      return;
    }

    setSessionPanelOpen(false);
    setHistoryReadOnly(false);

    const gen = ++sessionSwitchGenRef.current;
    setIsSwitchingSession(true);

    const deact = await deactivateToClinic(locale, {
      agentId: activeAgentId,
      skipBroadcast: true,
    });
    if (gen !== sessionSwitchGenRef.current) return;
    if (!deact.ok) {
      showToast(deact.error ?? tClinic("activateFailed"), "error");
      setIsSwitchingSession(false);
      return;
    }

    const res = await activateAgent(activeAgentId, locale, undefined, {
      force_new_session: true,
    });
    if (gen !== sessionSwitchGenRef.current) return;

    if (!res.success || !res.data) {
      showToast(res.error ?? tClinic("activateFailed"), "error");
      setIsSwitchingSession(false);
      return;
    }

    const { agent_id, session_id, greeting } = res.data;
    manualSessionSelectRef.current = true;
    setActiveAgent(agent_id, session_id);
    setAgentMessages(agent_id, [
      {
        id: `greeting_${Date.now()}`,
        role: "assistant",
        content: greeting,
        timestamp: new Date().toISOString(),
        sessionId: session_id,
      },
    ]);
    publishActiveAgentSync({
      type: "activated",
      agentId: agent_id,
      sessionId: session_id,
    });
    void refreshAgentSessions();
    setIsSwitchingSession(false);
  }, [
    activeAgentId,
    isAgentSending,
    isSwitching,
    isSwitchingSession,
    locale,
    refreshAgentSessions,
    setActiveAgent,
    setAgentMessages,
    showToast,
    tClinic,
  ]);

  useEffect(() => {
    if (sessionPanelOpen) {
      void refreshAgentSessions();
    }
  }, [sessionPanelOpen, refreshAgentSessions]);

  useEffect(() => {
    setSessionPanelOpen(false);
    setHistoryReadOnly(false);
  }, [activeAgentId]);

  const activeEntry = AGENT_REGISTRY.find((a) => a.agentId === activeAgentId);
  // KAZI-195 / INV-W4: embedded Clinic is the entry Space — ignore global active_agent chrome.
  const suppressGlobalAgentOnSpace =
    embeddedInWorkspace && isSpacesEnabled();
  const isAgentMode =
    !suppressGlobalAgentOnSpace && !!activeAgentId && !!activeEntry;
  const agentLayerStatusDetail = useLayerStatusBadge(
    isAgentMode ? activeAgentId : null,
    sessionsByAgent,
    (key) => tSessionNav(key)
  );
  const messages = isAgentMode ? agentMessages : clinicMessages;
  const strategyContexts = useMemo(
    () => mapStrategySelectTurnContexts(messages, locale),
    [locale, messages]
  );
  const agentActiveWorkflow = useMemo(
    () => (isAgentMode ? resolveWorkflowFromMessages(messages) : undefined),
    [isAgentMode, messages]
  );
  const isSending = isAgentMode ? isAgentSending : isClinicSending;
  const isStreaming = isAgentMode ? isAgentStreaming : isClinicStreaming;

  const shouldOpenCvBuilderPage = useCallback((agentId: string) => {
    return isCvBuilderAgent(agentId);
  }, []);

  const shouldOpenInterviewPage = useCallback((agentId: string) => {
    return isMockInterviewAgent(agentId);
  }, []);

  const shouldOpenEnglishPage = useCallback((agentId: string) => {
    return isEnglishTutorAgent(agentId);
  }, []);

  const inputPlaceholder = isAgentMode
    ? getAgentLabel(activeEntry, locale, "promptHint")
    : t("input.placeholder");

  const quickReplies =
    isAgentMode && activeAgentId
      ? AGENT_QUICK_REPLIES[activeAgentId]?.[locale as SupportedLocale] ?? []
      : [];

  // Phase B: mutex Clinic Starter vs assistant next_actions (PRD §3.4.2 / SDD §2.4.2).
  // CTAs render inline on MessageBubble; composer only needs the mutex signal.
  const latestClinicNextActions = useMemo(
    () => resolveLatestClinicNextActions(clinicMessages),
    [clinicMessages]
  );
  const hasClinicUserMessage = clinicMessages.some((m) => m.role === "user");
  const clinicStarter = useClinicStarterPromptsController(hasClinicUserMessage);
  const showClinicStarter =
    !isAgentMode &&
    Boolean(clinicStarter?.hydrated) &&
    clinicStarter != null &&
    !shouldHideClinicStarterForNextActions(latestClinicNextActions);
  const clinicInputDisabled =
    isSending || isSwitching || isSwitchingSession || historyReadOnly;

  useEffect(() => {
    setEnglishLevelState(getEnglishLevel());
    clearExpiredReferralDismissals();
    clearExpiredSpaceNudgeDismissals();
    fetch(`${bootstrapBase()}/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => setIsOnline(r.ok))
      .catch(() => setIsOnline(false));
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const referralId = getDeepLinkReferralId(window.location.search);
    if (referralId && AGENT_REGISTRY.some((a) => a.agentId === referralId)) {
      if (!isReferralDismissed(referralId)) {
        const entry = AGENT_REGISTRY.find((a) => a.agentId === referralId);
        setPendingReferral({
          agentId: referralId,
          reason: entry
            ? tReferral("defaultReason", {
                name: getAgentLabel(entry, locale, "name"),
              })
            : "",
        });
      }
      clearReferralFromUrl();
    }
  }, [isLoggedIn, locale, tReferral]);

  useEffect(() => {
    if (!isLoggedIn) {
      didClinicBootstrapRef.current = false;
      skipHistoryLoad();
      useAgentStore.getState().setActiveAgent(null, null);
      setLayerReady(true);
      return;
    }
    if (!active) return;
    if (isTelegramMiniApp && !tmaInitComplete) return;
    // Keep-alive re-show must not re-run bootstrap / loadHistory (KAZI-588 R2).
    if (didClinicBootstrapRef.current) return;

    let cancelled = false;

    const applyHistoryBootstrap = (historyOk: boolean) => {
      if (cancelled) return;
      const outcome = clinicHistoryBootstrapOutcome(historyOk);
      setClinicHistoryLoadFailed(outcome.showHistoryFailed);
      if (outcome.markComplete) {
        didClinicBootstrapRef.current = true;
      }
      setLayerReady(true);
    };

    const bootstrapClinicLayer = async () => {
      setLayerReady(false);

      const pending = consumePendingTmaAction();
      if (pending?.type === 'activate_agent') {
        if (pending.agentId === CV_BUILDER_AGENT_ID) {
          openCvRailRef.current();
          const ok = await loadHistoryRef.current();
          applyHistoryBootstrap(ok !== false);
          return;
        }
        if (pending.agentId === MOCK_INTERVIEW_AGENT_ID) {
          routeInterviewPage();
          return;
        }
        if (pending.agentId === ENGLISH_TUTOR_AGENT_ID) {
          routeEnglishPage();
          return;
        }
        if (AGENT_REGISTRY.some((a) => a.agentId === pending.agentId)) {
          await requestAgentSwitchRef.current(pending.agentId);
          applyHistoryBootstrap(true);
          return;
        }
      }
      if (pending?.type === 'clinic') {
        if (useAgentStore.getState().activeAgentId) {
          const result = await exitToClinicRef.current();
          if (result?.reloadClinic && isLoggedIn) {
            const ok = await loadHistoryRef.current();
            applyHistoryBootstrap(ok !== false);
            return;
          }
        } else {
          const ok = await loadHistoryRef.current();
          applyHistoryBootstrap(ok !== false);
          return;
        }
        applyHistoryBootstrap(true);
        return;
      }
      if (pending?.type === 'subscription') {
        router.push(`/${locale}/subscription`);
        return;
      }
      if (
        pending &&
        (pending.type === 'jobs' ||
          pending.type === 'profile' ||
          pending.type === 'job' ||
          pending.type === 'cv' ||
          pending.type === 'cv_job' ||
          pending.type === 'interview' ||
          pending.type === 'interview_job')
      ) {
        router.push(routeForTmaAction(locale, pending));
        return;
      }

      const deepLinkAgent = getDeepLinkAgentId(window.location.search);
      if (deepLinkAgent && shouldOpenCvBuilderPage(deepLinkAgent)) {
        openCvRailRef.current();
        stripAgentParamsFromUrl();
        const ok = await loadHistoryRef.current();
        applyHistoryBootstrap(ok !== false);
        return;
      }
      if (deepLinkAgent && shouldOpenInterviewPage(deepLinkAgent)) {
        routeInterviewPage();
        return;
      }
      if (deepLinkAgent && shouldOpenEnglishPage(deepLinkAgent)) {
        routeEnglishPage();
        return;
      }
      if (
        deepLinkAgent &&
        AGENT_REGISTRY.some((a) => a.agentId === deepLinkAgent)
      ) {
        await requestAgentSwitchRef.current(deepLinkAgent);
        applyHistoryBootstrap(true);
        return;
      }

      const stickyAgent = await fetchActiveAgentRef.current();
      if (hasStickyActiveAgent(stickyAgent)) {
        if (isDedicatedHubAgent(stickyAgent.active_agent)) {
          const ok = await stayInClinicForDedicatedHub(stickyAgent.active_agent);
          applyHistoryBootstrap(ok !== false);
          return;
        }
        if (isCvBuilderAgent(stickyAgent.active_agent)) {
          clinicHubColdOpenRef.current = null;
          useAgentStore.getState().setActiveAgent(null, null);
          const ok = await loadHistoryRef.current();
          applyHistoryBootstrap(ok !== false);
          return;
        }
        clinicHubColdOpenRef.current = null;
        await resumeActiveAgentSilentlyRef.current(
          stickyAgent.active_agent,
          stickyAgent.session_id
        );
        skipHistoryLoad();
        applyHistoryBootstrap(true);
        return;
      }

      clinicHubColdOpenRef.current = null;
      useAgentStore.getState().setActiveAgent(null, null);
      const ok = await loadHistoryRef.current();
      applyHistoryBootstrap(ok !== false);
    };

    void bootstrapClinicLayer();

    return () => {
      cancelled = true;
    };
  }, [
    active,
    isLoggedIn,
    isTelegramMiniApp,
    tmaInitComplete,
    locale,
    router,
    routeInterviewPage,
    routeEnglishPage,
    shouldOpenCvBuilderPage,
    shouldOpenInterviewPage,
    shouldOpenEnglishPage,
    skipHistoryLoad,
    stayInClinicForDedicatedHub,
  ]);

  useActiveAgentSync(active && isLoggedIn && layerReady, async () => {
    await reconcileActiveAgentLayer();
  });

  useEffect(() => {
    if (activeAgentId && agentSessionId) {
      if (manualSessionSelectRef.current) {
        manualSessionSelectRef.current = false;
        return;
      }
      loadAgentHistory();
    }
  }, [activeAgentId, agentSessionId, loadAgentHistory]);

  useEffect(() => {
    const onPopState = () => {
      if (!active) return;
      const agentFromUrl = getDeepLinkAgentId(window.location.search);
      const current = useAgentStore.getState().activeAgentId;

      if (!agentFromUrl) {
        if (current) {
          void exitToClinic({ skipHistory: true }).then((result) => {
            if (result?.reloadClinic && isLoggedIn) {
              void loadHistory();
            }
          });
        }
        return;
      }

      if (
        agentFromUrl !== current &&
        AGENT_REGISTRY.some((a) => a.agentId === agentFromUrl)
      ) {
        if (shouldOpenCvBuilderPage(agentFromUrl)) {
          openCvRailRef.current();
          stripAgentParamsFromUrl();
          return;
        }
        if (shouldOpenInterviewPage(agentFromUrl)) {
          routeInterviewPage();
          return;
        }
        if (shouldOpenEnglishPage(agentFromUrl)) {
          routeEnglishPage();
          return;
        }
        void requestAgentSwitchRef.current(agentFromUrl);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [
    active,
    exitToClinic,
    isLoggedIn,
    loadHistory,
    routeInterviewPage,
    routeEnglishPage,
    shouldOpenCvBuilderPage,
    shouldOpenInterviewPage,
    shouldOpenEnglishPage,
  ]);

  useEffect(() => {
    if (isClinicSending || !pendingClinicHistoryReloadRef.current) return;
    pendingClinicHistoryReloadRef.current = false;
    void loadHistory();
  }, [isClinicSending, loadHistory]);

  /** One catch-up load when layer is ready but bootstrap left an empty thread. */
  const emptyHistoryRecoveryAttemptedRef = useRef(false);
  useEffect(() => {
    if (
      !active ||
      !isLoggedIn ||
      !layerReady ||
      isAgentMode ||
      isHistoryLoading ||
      isClinicSending
    ) {
      return;
    }
    if (clinicMessages.length > 0) {
      emptyHistoryRecoveryAttemptedRef.current = false;
      setClinicHistoryLoadFailed(false);
      return;
    }
    if (clinicHistoryLoadFailed) return;
    if (emptyHistoryRecoveryAttemptedRef.current) return;
    emptyHistoryRecoveryAttemptedRef.current = true;
    void loadHistory().then((ok) => {
      if (!ok) {
        console.error('[ClinicShell] clinic history load failed (recovery)');
        setClinicHistoryLoadFailed(true);
      }
    });
  }, [
    clinicMessages.length,
    isAgentMode,
    isClinicSending,
    isHistoryLoading,
    isLoggedIn,
    layerReady,
    loadHistory,
    active,
    clinicHistoryLoadFailed,
  ]);

  const retryClinicHistoryLoad = useCallback(() => {
    emptyHistoryRecoveryAttemptedRef.current = false;
    setClinicHistoryLoadFailed(false);
    void loadHistory().then((ok) => {
      if (!ok) {
        console.error('[ClinicShell] clinic history load failed (manual retry)');
        setClinicHistoryLoadFailed(true);
        return;
      }
      didClinicBootstrapRef.current = true;
    });
  }, [loadHistory]);

  const beforeVoiceTranscribe = useCallback(() => {
    if (!isLoggedIn) {
      showToast(tClinic("loginToChat"), "info");
      router.push(`/${locale}/login`);
      return false;
    }
    return true;
  }, [isLoggedIn, locale, router, showToast, tClinic]);

  const handleClinicSendOutcome = useCallback(
    async (
      text: string,
      result: Awaited<ReturnType<typeof sendClinicMessage>>
    ) => {
      if (result.ok) {
        // Park may appear after yield (news/greeting) — refresh Current+parked.
        void refreshCurrentSessions(true);

        const msg = useSpaceStore
          .getState()
          .getSpaceSlice(CLINIC_SPACE_ID)
          .messages.find((m) => m.id === result.assistantId);

        // Interim bridge (pre-KAZI-138): L2 still processes inline mock interview;
        // remove this path once BE returns referral-only next_actions. See KAZI-138.
        if (
          msg &&
          shouldClinicReplyRouteToInterviewHub(msg.nextActions)
        ) {
          markStreamComplete(result.assistantId);
          routeInterviewPage();
          return;
        }

        if (
          shouldRouteToEnglishEpp({
            intent: msg?.intent,
            nextActions: msg?.nextActions,
            routedAgentId: result.routedToAgent?.agentId,
          })
        ) {
          markStreamComplete(result.assistantId);
          routeEnglishPage();
          return;
        }

        if (result.routedToAgent) {
          if (isCvBuilderAgent(result.routedToAgent.agentId)) {
            setCvAgentHandoff({
              sessionId: result.routedToAgent.sessionId,
              greeting: msg?.content?.trim() || undefined,
            });
            markStreamComplete(result.assistantId);
            openCvRail(undefined, { drillDown: true });
            return;
          }
          if (msg?.role === "assistant") {
            // KAZI-651 Phase C.1b: `msg` is now `SpaceChatMessage`-shaped (no
            // `timestamp`/`sessionId`) — this hand-off to agent-slice.ts
            // still needs a real `ChatMessage` (untouched, out of scope for
            // this migration), so synthesize both at the boundary. The
            // clinic master session id is the same session-scoped value
            // `msg.sessionId` used to carry here.
            const clinicMasterSessionId =
              useSpaceStore.getState().getSpaceSlice(CLINIC_SPACE_ID).masterSessionId;
            const syncResult = await syncActiveAgentFromGateway(
              result.routedToAgent.agentId,
              {
                ...msg,
                timestamp: new Date().toISOString(),
                sessionId:
                  result.routedToAgent.sessionId ?? clinicMasterSessionId ?? "",
              }
            );
            if (syncResult && !syncResult.ok) {
              showToast(tClinic("activateFailed"), "error");
            }
          }
        }
        return;
      }

      if (result.error?.includes("500")) {
        showToast(tClinic("agentErrorFallback"), "error");
        const exitResult = await exitToClinic();
        await reloadClinicIfNeeded(exitResult);
        return;
      }
      // Hook already handled LLM_BUSY / profile / paywall.
      if ("toastShown" in result && result.toastShown) return;
      showToast(result.error ?? tClinic("sendFailed"), "error");
    },
    [
      exitToClinic,
      markStreamComplete,
      refreshCurrentSessions,
      reloadClinicIfNeeded,
      openCvRail,
      routeEnglishPage,
      routeInterviewPage,
      showToast,
      syncActiveAgentFromGateway,
      tClinic,
    ]
  );

  const submitClinicChat = async (
    text: string,
    opts?: {
      displayContent?: string;
      actionMeta?: import("@/types/chat-envelope").UserMessageActionMeta;
    }
  ) => {
    pinToLatestOnSend();
    if (!isLoggedIn) {
      showToast(tClinic("loginToChat"), "info");
      router.push(`/${locale}/login`);
      return;
    }

    if (isAgentMode) {
      const result = await sendAgentMessage(text);
      if (result?.ok && result.pendingTransition) {
        if (pendingAgentSwitch) return;
        if (result.assistantPlaceholderId && activeAgentId) {
          useAgentStore
            .getState()
            .removeAgentMessage(activeAgentId, result.assistantPlaceholderId);
        }
        setPendingAgentSwitch(
          toPendingAgentSwitch(result.pendingTransition, result.triggerMessage)
        );
        return;
      }
      if (result?.ok && result.escalation) {
        const follow = await followAgentEscalation(result.escalation, {
          activateAgentWithoutPrecheck,
        });
        if (!follow.ok) {
          showToast(follow.error ?? tClinic("activateFailed"), "error");
        }
        return;
      }
      if (result && !result.ok) {
        if (result.error?.includes("500")) {
          showToast(tClinic("agentErrorFallback"), "error");
          const exitResult = await exitToClinic();
          await reloadClinicIfNeeded(exitResult);
          return;
        }
        showToast(result.error ?? tClinic("sendFailed"), "error");
      }
      return;
    }

    const result = await sendClinicMessage(text, {
      ...(opts?.displayContent ? { displayContent: opts.displayContent } : {}),
      ...(opts?.actionMeta ? { actionMeta: opts.actionMeta } : {}),
    });

    await handleClinicSendOutcome(text, result);
  };

  const submitClinicChatRef = useRef(submitClinicChat);
  submitClinicChatRef.current = submitClinicChat;

  /** ChatSendHandler — clinic composer does not send attachments yet; ignore File. */
  const handleSend = (text: string, _attachment?: File) => {
    void submitClinicChatRef.current(text);
  };

  const handleSendFromNextAction = useCallback((text: string) => {
    void submitClinicChatRef.current(text);
  }, []);

  const handleFocusComposer = useCallback(() => {
    requestComposerInsert("", "clinic", "append");
  }, [requestComposerInsert]);

  const handleExamSelect = useCallback(
    (option: import('@/types/english-tutor-envelope').ExamPickerOption) => {
      if (isSending || isSwitching) return;
      if (isAgentMode) {
        void sendAgentMessage(option.label);
        return;
      }
      void submitClinicChatRef.current(option.label);
    },
    [isAgentMode, isSending, isSwitching, sendAgentMessage]
  );

  const handleAgentSelect = useCallback(
    async (agentId: string) => {
      if (!isLoggedIn) {
        showToast(tClinic("loginToContinue"), "info");
        router.push(`/${locale}/login`);
        return;
      }
      if (needsParkReplaceConfirm(parkedInteractiveRef.current, agentId)) {
        setParkReplaceTargetId(agentId);
        return;
      }
      // Uses the refs (not `requestAgentSwitch`/`parkedInteractive` directly)
      // so this stays a stable callback even though useAgentSwitch() doesn't
      // memoize its function, and even though parkedInteractive's identity
      // changes on every sessionsByAgent update — the park-replace check
      // above still reads the latest parked session at call time.
      const result = await requestAgentSwitchRef.current(agentId);
      if (result && !result.ok && result.needsConfirm) return;
      if (result && !result.ok) {
        showToast(result.error ?? tClinic("activateFailed"), "error");
      }
    },
    [isLoggedIn, locale, router, showToast, tClinic]
  );

  const handleConfirmParkReplace = async () => {
    if (!parkReplaceTargetId) return;
    const targetId = parkReplaceTargetId;
    setParkReplaceBusy(true);
    try {
      const res = await newAgentSession(targetId, locale, {
        confirm_abandon: true,
      });
      if (!res.success || !res.data) {
        showToast(res.error ?? tClinic("activateFailed"), "error");
        return;
      }
      void refreshCurrentSessions(true);
      publishSessionNavInvalidate();

      const hubPath = getAgentHubPath(locale, targetId);
      if (hubPath) {
        const open = await openHubAgentSession(targetId, locale);
        if (!open.ok) {
          showToast(open.error ?? tClinic("activateFailed"), "error");
          // Keep dialog open — parked may already be abandoned; user can retry nav.
          return;
        }
        setParkReplaceTargetId(null);
        router.push(hubPath);
        if (isCvBuilderAgent(targetId)) {
          openCvRail();
        }
        return;
      }

      const result = await requestAgentSwitch(targetId);
      if (result && !result.ok && !result.needsConfirm) {
        showToast(result.error ?? tClinic("activateFailed"), "error");
        return;
      }
      // Close only after switch succeeds (or needsConfirm hands off to AgentSwitchDialog).
      setParkReplaceTargetId(null);
    } finally {
      setParkReplaceBusy(false);
    }
  };

  const handleBackToClinic = useCallback(async () => {
    // Uses the ref (not `exitToClinic` directly) so this stays a stable
    // callback even though useAgentSwitch() doesn't memoize exitToClinic.
    const result = await exitToClinicRef.current();
    if (result && !result.ok) {
      showToast(tClinic("deactivateFailed"), "error");
      return;
    }
    await reloadClinicIfNeeded(result);
  }, [reloadClinicIfNeeded, showToast, tClinic]);

  const handleReferralAccept = useCallback(
    async (agentId: string, messageId?: string) => {
      if (messageId) dismissMessageReferral(messageId);
      setPendingReferral(null);
      if (isMockInterviewAgent(agentId)) {
        const prompt = resolveNextActionChatPrompt(
          { type: "mock_interview" },
          locale
        );
        if (prompt) {
          void handleSendFromNextAction(prompt);
        }
        return;
      }
      if (isEnglishTutorAgent(agentId)) {
        routeEnglishPage();
        return;
      }
      await handleAgentSelect(agentId);
    },
    [
      dismissMessageReferral,
      handleAgentSelect,
      handleSendFromNextAction,
      locale,
      routeEnglishPage,
    ]
  );

  const handleReferralDismiss = useCallback(
    (agentId: string, messageId?: string) => {
      dismissReferral(agentId);
      if (messageId) dismissMessageReferral(messageId);
      setPendingReferral(null);
    },
    [dismissMessageReferral]
  );

  const handleSpaceNudgeAccept = useCallback(
    async (nudge: SpaceNudgePayload, messageId?: string) => {
      if (!isSpacesEnabled() || spaceNudgeBusy) return;
      setSpaceNudgeBusy(true);
      try {
        const res = await createSpace({
          template_id: nudge.templateId,
          ...(nudge.suggestedName ? { name: nudge.suggestedName } : {}),
        });
        if (!res.success || !res.data) {
          showToast(res.error ?? tSpaces("nudgeCreateFailed"), "error");
          return;
        }
        // Dismiss only after success — failed accept must keep the card for retry.
        dismissSpaceNudge(nudge.templateId);
        if (messageId) dismissMessageSpaceNudge(messageId);
        publishSpacesListInvalidate();
        router.push(`/${locale}/spaces/${encodeURIComponent(res.data.id)}`);
      } finally {
        setSpaceNudgeBusy(false);
      }
    },
    [
      dismissMessageSpaceNudge,
      locale,
      router,
      showToast,
      spaceNudgeBusy,
      tSpaces,
    ]
  );

  const handleSpaceNudgeDismiss = useCallback(
    (nudge: SpaceNudgePayload, messageId?: string) => {
      dismissSpaceNudge(nudge.templateId);
      if (messageId) dismissMessageSpaceNudge(messageId);
    },
    [dismissMessageSpaceNudge]
  );

  const handleNextAction = useCallback(
    (action: ChatNextAction) => {
      const actionSubmit = resolveActionSelectSubmit(action, locale);
      if (actionSubmit) {
        if (isAgentMode) {
          void sendAgentMessage(actionSubmit.display, {
            displayContent: actionSubmit.display,
            actionMeta: actionSubmit.meta,
          });
        } else {
          void submitClinicChatRef.current(actionSubmit.display, {
            displayContent: actionSubmit.display,
            actionMeta: actionSubmit.meta,
          });
        }
        return;
      }

      if (isEnglishTutorReviseAction(action.type)) {
        requestComposerInsert("", "clinic", "append");
        return;
      }

      const href = resolveNextActionHref(locale, action);
      if (href) {
        if (isClinicCvRailOpenHref(locale, href)) {
          openCvRail(parseJobIdFromHref(href));
          const q = stripCvRailOpenParams(searchParams).toString();
          router.replace(`/${locale}/chat${q ? `?${q}` : ""}`, { scroll: false });
          return;
        }
        router.push(href);
        return;
      }
      const prompt = resolveNextActionChatPrompt(action, locale);
      if (prompt) {
        void handleSendFromNextAction(prompt);
        return;
      }
      switch (action.type) {
        case "upgrade_pro":
        case "unlock_pro":
          openPaywall("PRO_FEATURE_LOCKED");
          return;
        case "return_to_clinic":
          void handleBackToClinic();
          return;
        default:
          return;
      }
    },
    [locale, router, searchParams, openCvRail, openPaywall, handleBackToClinic, handleSendFromNextAction, isAgentMode, sendAgentMessage, requestComposerInsert]
  );

  const handleJobCardClick = useCallback(
    (card: ChatJobCard) => {
      if (card.job_id) {
        setSelectedJobId(card.job_id);
        return;
      }
      router.push(`/${locale}/jobs`);
    },
    [locale, router]
  );

  const handlePracticeForJob = (ctx: JobPracticeContext) => {
    if (isSending || isSwitching) return;
    const prompt = buildReadinessPracticePrompt(tPractice, {
      jobTitle: ctx.jobTitle,
      weaknessLabels: ctx.weaknessLabels,
    });
    void handleSend(prompt);
  };

  const clinicShellReady =
    layerReady && !isSwitching && !isAgentMode && !isHistoryLoading;

  const clinicIdleReady = clinicShellReady && !isSwitchingSession;

  const showWelcome = clinicIdleReady && clinicMessages.length === 0;

  const scrollStorageKey = isAgentMode
    ? clinicChatScrollStorageKey(
        `agent:${activeAgentId ?? "none"}:${agentSessionId ?? "none"}`,
      )
    : clinicChatScrollStorageKey("main");

  // Wait until history settle — same race as Spaces (false bottom on partial height).
  const scrollReady =
    layerReady && !isSwitchingSession && !isHistoryLoading && !showWelcome;

  const {
    scrollRef,
    showJumpToLatest,
    handleScroll,
    jumpToLatest,
    pinToLatestOnSend,
  } = useChatScroll({
    storageKey: scrollStorageKey,
    messageCount: messages.length,
    isSending: isSending || isSwitching,
    ready: scrollReady,
    alignToLatest: true,
    activationKey: active ? "active" : "idle",
  });

  useHistoryStubHydrate({
    enabled: scrollReady && !isAgentMode,
    messages,
    scrollRoot: scrollRef,
    hydrate: hydrateHistoryStubs,
  });

  const handleRetryById = useCallback(
    (messageId: string) => {
      pinToLatestOnSend();
      void retryMessage(messageId);
    },
    [pinToLatestOnSend, retryMessage]
  );

  /** Same-thread research handoff from web_search upgrade CTA (KAZI-233). */
  const handleUpgradeResearch = useCallback(
    async (messageId: string) => {
      const msg = useSpaceStore
        .getState()
        .getSpaceSlice(CLINIC_SPACE_ID)
        .messages.find((m) => m.id === messageId);
      const cta = msg?.upgradeCta;
      if (!cta || cta.dismissed) return;

      const handoffText = buildResearchHandoffMessage(cta.seed, locale);
      pinToLatestOnSend();
      // Dismiss only after success so paywall / network failures keep the CTA for retry.
      const result = await sendClinicMessage(handoffText, {
        pendingCapability: "research",
      });
      if (result.ok) {
        dismissMessageUpgradeCta(messageId);
        return;
      }
      if (!("toastShown" in result && result.toastShown)) {
        showToast(result.error ?? tClinic("sendFailed"), "error");
      }
    },
    [
      dismissMessageUpgradeCta,
      locale,
      pinToLatestOnSend,
      sendClinicMessage,
      showToast,
      tClinic,
    ]
  );

  // Fills SessionNavShell `<main className="min-h-0 flex-1">` — not viewport `h-screen`.
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-white">
      {isSwitching && <SwitchingOverlay />}

      {/* Agent mode keeps ChatHeader for deactivate + session history; ContextHeader alone cannot exit. */}
      {(!embeddedInWorkspace || isAgentMode) && (
      <ChatHeader
        locale={locale}
        mode={isAgentMode ? "agent" : "clinic"}
        agentName={activeEntry ? getAgentLabel(activeEntry, locale, "name") : undefined}
        agentId={activeEntry?.agentId}
        isOnline={isOnline}
        onBackToClinic={isAgentMode ? handleBackToClinic : undefined}
        onOpenSessionHistory={
          isAgentMode && isLoggedIn
            ? () => {
                sessionHistoryTriggerRef.current =
                  document.activeElement as HTMLElement | null;
                setSessionPanelOpen(true);
              }
            : undefined
        }
        onOpenWorkspaceHub={
          !isAgentMode && isLoggedIn
            ? () => openCvRail(undefined, { drillDown: false })
            : undefined
        }
      />
      )}

      {isAgentMode && isLoggedIn ? (
        <AgentSessionPanel
          open={sessionPanelOpen}
          onClose={() => setSessionPanelOpen(false)}
          title={
            activeEntry
              ? tSessions("sessionHistoryFor", {
                  agentName: getAgentLabel(activeEntry, locale, "name"),
                })
              : tSessions("sessionHistory")
          }
          sessions={agentSessions}
          activeSessionId={agentSessionId}
          isLoading={agentSessionsLoading}
          disabled={isSending || isSwitching || isSwitchingSession}
          onSelect={(id) => void handleAgentSessionSelect(id)}
          onNew={() => void handleAgentNewSession()}
          returnFocusRef={sessionHistoryTriggerRef}
        />
      ) : null}

      {!isLoggedIn && (
        <div className="bg-orange-50 border-b border-orange-100 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-gray-600">
            <strong className="text-gray-900">{tClinic("guestBanner")}</strong>
          </span>
          <Link href={`/${locale}/login`} prefetch={false}>
            <Button size="sm" variant="secondary" className="h-8 text-xs">
              {tClinic("signIn")}
            </Button>
          </Link>
        </div>
      )}

      {isLoggedIn ? (
        <LayerIndicator
          locale={locale}
          activeAgentId={isAgentMode ? activeAgentId : null}
          statusDetail={isAgentMode ? agentLayerStatusDetail : null}
          onClinicClick={isAgentMode ? handleBackToClinic : undefined}
        />
      ) : null}

      {isAgentMode && historyReadOnly ? (
        <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100 text-center shrink-0">
          {tSessions("readOnlyBanner")}
        </p>
      ) : null}

      <ChatSideRailsHost
        jobId={selectedJobId}
        locale={locale}
        onCloseJob={() => setSelectedJobId(null)}
        cvRail={{ open: cvRailOpen, jobId: cvRailJobId, drillDown: cvRailDrillDown }}
        onCloseCv={closeCvRail}
        onPracticeForJob={handlePracticeForJob}
        practiceDisabled={isSending || isSwitching}
      >
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto flex flex-col bg-gray-bg min-h-0 ${
          isAgentMode ? "" : "px-5 py-5"
        }`}
      >
        {isAgentMode ? (
          <HubWorkflowStrip workflow={agentActiveWorkflow} locale={locale} />
        ) : null}
        <div
          className={`mx-auto flex w-full max-w-3xl flex-col gap-4 min-h-0 ${
            isAgentMode ? "px-5 py-5" : ""
          }`}
        >
        {/* Active-sessions banner removed (KAZI-198): progress tracked per-space, not in Clinic. */}
        {!layerReady && isLoggedIn ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm">{tClinic("layerResolving")}</p>
          </div>
        ) : !isAgentMode &&
          clinicHistoryLoadFailed &&
          clinicMessages.length === 0 ? (
          <ChatHistoryLoadError
            message={tClinic("historyLoadFailed")}
            retryLabel={tClinic("historyRetry")}
            onRetry={retryClinicHistoryLoad}
            disabled={isHistoryLoading}
          />
        ) : !isAgentMode &&
          isHistoryLoading &&
          clinicMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm">{tClinic("historyLoading")}</p>
          </div>
        ) : showWelcome ? (
          <WelcomeView
            locale={locale}
            isLoggedIn={isLoggedIn}
            selectedLevel={englishLevel}
            onLevelChange={setEnglishLevelState}
            onAgentSelect={handleAgentSelect}
            nbaAction={nbaResponse?.next_best_action ?? null}
            nbaLoading={nbaLoading}
            sessionsByAgent={sessionsByAgent}
          />
        ) : isSwitchingSession ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm">{tSessions("sessionSwitching")}</p>
          </div>
        ) : (
          <ClinicMessageList
            messages={messages}
            strategyContexts={strategyContexts}
            isStreaming={isStreaming}
            scrollParentRef={scrollRef}
            locale={locale}
            isAgentMode={isAgentMode}
            actionsDisabled={isSending || isSwitching || spaceNudgeBusy}
            referralDisabled={isSending || isSwitching || spaceNudgeBusy}
            onRetryById={handleRetryById}
            onReferralAccept={handleReferralAccept}
            onReferralDismiss={handleReferralDismiss}
            onSpaceNudgeAccept={handleSpaceNudgeAccept}
            onSpaceNudgeDismiss={handleSpaceNudgeDismiss}
            onUpgradeResearch={handleUpgradeResearch}
            onNextAction={handleNextAction}
            onFocusComposer={handleFocusComposer}
            onExamSelect={handleExamSelect}
            onJobCardClick={handleJobCardClick}
            alignToLatest
            activationKey={active ? "active" : "idle"}
          />
        )}
        </div>
      </div>
      {showJumpToLatest ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            "absolute bottom-3 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2",
            "items-center justify-center rounded-full border border-gray-100 bg-white",
            "shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity hover:bg-gray-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          aria-label={tSpaces("scrollToLatest")}
        >
          <ChevronDown className="h-5 w-5 text-workspace-text" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      </div>

      {isAgentMode && quickReplies.length > 0 && (
        <QuickReplies
          options={quickReplies}
          disabled={isSending || isSwitching}
          onSelect={handleSend}
        />
      )}

      {pendingReferral && !isAgentMode && (() => {
        const entry = AGENT_REGISTRY.find((a) => a.agentId === pendingReferral.agentId);
        if (!entry) return null;
        return (
          <div className="px-4 pb-2 bg-gray-bg border-t border-gray-100">
            <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
              <ReferralPrompt
                agentEmoji={entry.emoji}
                agentName={getAgentLabel(entry, locale, "name")}
                reason={pendingReferral.reason}
                onAccept={() => void handleReferralAccept(pendingReferral.agentId)}
                onDismiss={() => handleReferralDismiss(pendingReferral.agentId)}
                disabled={isSending || isSwitching}
              />
            </div>
          </div>
        );
      })()}

      {isAgentMode ? (
        <VoiceEnabledChatInput
          onSend={handleSend}
          beforeTranscribe={beforeVoiceTranscribe}
          contextModule="clinic"
          composerTarget="clinic"
          disabled={
            isSending ||
            isSwitching ||
            (isAgentMode && historyReadOnly) ||
            isSwitchingSession
          }
          placeholder={inputPlaceholder}
          showAttachButton
          showAgentButton={isLoggedIn}
          onOpenAgents={() => setSwitcherOpen(true)}
        />
      ) : (
        <div className="bg-gray-bg px-4 pb-3 pt-2">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
            {!isAgentMode && parkedInteractive ? (
              <ClinicParkedCapabilityBanner
                locale={locale}
                session={parkedInteractive}
                disabled={clinicInputDisabled || parkReplaceBusy}
                onResumed={() => {
                  void refreshCurrentSessions(true);
                  publishSessionNavInvalidate();
                }}
              />
            ) : null}
            {showClinicStarter && clinicStarter ? (
              <ClinicStarterExampleStrip
                cfg={clinicStarter.cfg}
                panelId={clinicStarter.panelId}
                collapsed={clinicStarter.examplesCollapsed}
                disabled={clinicInputDisabled}
                onToggleCollapsed={clinicStarter.setExamplesCollapsed}
                onSendExample={(text) => void handleSend(text)}
              />
            ) : null}
            <VoiceEnabledChatInput
              onSend={handleSend}
              beforeTranscribe={beforeVoiceTranscribe}
              contextModule="clinic"
              composerTarget="clinic"
              disabled={clinicInputDisabled}
              placeholder={inputPlaceholder}
              showAttachButton
              showAgentButton={isLoggedIn}
              onOpenAgents={() => setSwitcherOpen(true)}
              variant="card"
              toolbar={
                showClinicStarter && clinicStarter ? (
                  <ClinicStarterCapabilityToolbar
                    cfg={clinicStarter.cfg}
                    disabled={clinicInputDisabled}
                  />
                ) : null
              }
            />
          </div>
        </div>
      )}
      </ChatSideRailsHost>

      <AgentSwitcher
        locale={locale}
        isLoggedIn={isLoggedIn}
        open={switcherOpen}
        activeAgentId={activeAgentId}
        sessionsByAgent={sessionsByAgent}
        onClose={() => setSwitcherOpen(false)}
        onSelect={handleAgentSelect}
      />

      <ConfirmAbandonSessionDialog
        open={Boolean(parkReplaceTargetId)}
        agentId={parkedInteractive?.agent_id ?? null}
        locale={locale}
        onConfirm={() => void handleConfirmParkReplace()}
        onCancel={() => {
          if (parkReplaceBusy) return;
          setParkReplaceTargetId(null);
        }}
      />

      {pendingAgentSwitch ? (
        <AgentSwitchDialog
          locale={locale}
          fromAgentId={pendingAgentSwitch.fromAgentId}
          toAgentId={pendingAgentSwitch.toAgentId}
          isConfirming={switchConfirming}
          onCancel={cancelPendingAgentSwitch}
          onConfirm={() => {
            setSwitchConfirming(true);
            void confirmPendingAgentSwitch()
              .then((result) => {
                if (result && !result.ok) {
                  showToast(result.error ?? tClinic("activateFailed"), "error");
                }
              })
              .finally(() => setSwitchConfirming(false));
          }}
        />
      ) : null}
    </div>
  );
}
