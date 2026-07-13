"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChatHeader } from "./chat-header";
import { WelcomeView } from "./welcome-view";
import { ClinicActiveSessionsBanner } from "./clinic-active-sessions-banner";
import { MessageBubble } from "./message-bubble";
import { SwitchingOverlay } from "./switching-overlay";
import { LayerIndicator } from "./layer-indicator";
import { AgentSwitchDialog } from "./agent-switch-dialog";
import { QuickReplies } from "./quick-replies";
import { AgentSwitcher } from "./agent-switcher";
import { ReferralPrompt } from "./referral-prompt";
import { ChatInput } from "@/components/chat/chat-input";
import { useClinicChat } from "@/hooks/use-clinic-chat";
import { useActiveAgentSessions } from "@/hooks/use-active-agent-sessions";
import { useLayerStatusBadge } from "@/hooks/use-layer-status-badge";
import { useActiveAgentSync } from "@/hooks/use-active-agent-sync";
import { getDeepLinkAgentId, getDeepLinkReferralId, clearReferralFromUrl, useAgentSwitch } from "@/hooks/use-agent-switch";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useNbaAction } from "@/hooks/use-nba-action";
import { useAuthStore, useAgentStore, useChatStore, useUIStore } from "@/lib/store";
import { useEmbeddedInWorkspaceShell } from "@/lib/workspace-shell-context";
import {
  AGENT_REGISTRY,
  AGENT_QUICK_REPLIES,
  getAgentLabel,
} from "@/lib/agents/registry";
import { getEnglishLevel } from "@/lib/auth";
import { dismissReferral, isReferralDismissed, clearExpiredReferralDismissals } from "@/lib/referral-dismiss";
import { consumePendingTmaAction, routeForTmaAction } from "@/lib/tma-routing";
import {
  CV_BUILDER_AGENT_ID,
  isCvBuilderAgent,
} from "@/lib/cv-agent-config";
import {
  ENGLISH_TUTOR_AGENT_ID,
  isEnglishTutorAgent,
} from "@/lib/english-tutor-config";
import {
  isMockInterviewAgent,
  MOCK_INTERVIEW_AGENT_ID,
} from "@/lib/mock-interview-config";
import { setCvAgentHandoff } from "@/lib/cv-agent-handoff";
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
import { API_BASE_URL } from "@/lib/constants";
import { shouldClinicReplyRouteToInterviewHub } from "@/lib/clinic-interview-routing";
import { buildClinicActiveSessionEntries } from "@/lib/clinic-active-sessions";

interface ClinicShellProps {
  locale: string;
}

export function ClinicShell({ locale }: ClinicShellProps) {
  const router = useRouter();
  const t = useTranslations("chat");
  const tClinic = useTranslations("clinic");
  const tReferral = useTranslations("referral");
  const tSessions = useTranslations("agentSessions");
  const tSessionNav = useTranslations("sessionNav");

  const switcherOpen = useAgentStore((s) => s.switcherOpen);
  const setSwitcherOpen = useAgentStore((s) => s.setSwitcherOpen);
  const setPendingAgentSwitch = useAgentStore((s) => s.setPendingAgentSwitch);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const tmaInitComplete = useUIStore((s) => s.tmaInitComplete);
  const embeddedInWorkspace = useEmbeddedInWorkspaceShell();

  /** TMA / deep-link / routedToAgent — may include ?job_id=; not used by planNavigation SSOT. */
  const routeCvBuilderPage = useCallback(
    (targetJobId?: string | null) => {
      const query = targetJobId
        ? `?job_id=${encodeURIComponent(targetJobId)}`
        : "";
      router.push(`/${locale}/cv${query}`);
    },
    [locale, router]
  );

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

  const { sessionsByAgent } = useActiveAgentSessions();

  const activeSessionEntries = useMemo(
    () =>
      isLoggedIn
        ? buildClinicActiveSessionEntries(locale, sessionsByAgent)
        : [],
    [isLoggedIn, locale, sessionsByAgent]
  );

  const requestAgentSwitchRef = useRef(requestAgentSwitch);
  const fetchActiveAgentRef = useRef(fetchActiveAgent);
  const resumeActiveAgentSilentlyRef = useRef(resumeActiveAgentSilently);
  const exitToClinicRef = useRef(exitToClinic);
  requestAgentSwitchRef.current = requestAgentSwitch;
  fetchActiveAgentRef.current = fetchActiveAgent;
  resumeActiveAgentSilentlyRef.current = resumeActiveAgentSilently;
  exitToClinicRef.current = exitToClinic;

  const {
    messages: agentMessages,
    isAgentSending,
    isAgentStreaming,
    loadAgentHistory,
    sendMessage: sendAgentMessage,
  } = useAgentChat(activeAgentId, agentSessionId);

  const { nba: nbaResponse, isLoading: nbaLoading } = useNbaAction();

  const loadHistoryRef = useRef(loadHistory);
  loadHistoryRef.current = loadHistory;

  const loadAgentHistoryRef = useRef(loadAgentHistory);
  loadAgentHistoryRef.current = loadAgentHistory;

  /** Hub agent id already cold-opened on Clinic — avoids reconcile/focus reload loops. */
  const clinicHubColdOpenRef = useRef<string | null>(null);
  const pendingClinicHistoryReloadRef = useRef(false);

  const reloadClinicHistoryIfIdle = useCallback(async () => {
    if (useChatStore.getState().isSending) {
      pendingClinicHistoryReloadRef.current = true;
      return;
    }
    pendingClinicHistoryReloadRef.current = false;
    await loadHistoryRef.current();
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
      await reloadClinicHistoryIfIdle();
      return true;
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

  const reloadClinicIfNeeded = useCallback(
    async (result?: { reloadClinic?: boolean; ok?: boolean }) => {
      if (result?.reloadClinic && isLoggedIn) {
        await loadHistory();
      }
    },
    [isLoggedIn, loadHistory]
  );

  /** Activates mock_interview; navigation to `/interview` is handled by performAgentSwitch. */
  const activateMockInterviewHub = useCallback(async () => {
    const result = await requestAgentSwitch(MOCK_INTERVIEW_AGENT_ID);
    if (result && !result.ok && result.needsConfirm) return;
    if (result && !result.ok) {
      showToast(result.error ?? tClinic("activateFailed"), "error");
    }
  }, [requestAgentSwitch, showToast, tClinic]);

  const [isOnline, setIsOnline] = useState(false);
  const [englishLevel, setEnglishLevelState] = useState<string | null>(null);
  const [pendingReferral, setPendingReferral] = useState<{
    agentId: string;
    reason: string;
  } | null>(null);
  const [layerReady, setLayerReady] = useState(false);
  const [switchConfirming, setSwitchConfirming] = useState(false);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [historyReadOnly, setHistoryReadOnly] = useState(false);
  const [isSwitchingSession, setIsSwitchingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        mapAgentHistoryToChatMessages(hist.data.messages, sessionId)
      );
      setIsSwitchingSession(false);
    },
    [
      activeAgentId,
      agentSessionId,
      agentSessions,
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
  const isAgentMode = !!activeAgentId && !!activeEntry;
  const agentLayerStatusDetail = useLayerStatusBadge(
    isAgentMode ? activeAgentId : null,
    sessionsByAgent,
    (key) => tSessionNav(key)
  );
  const messages = isAgentMode ? agentMessages : clinicMessages;
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

  useEffect(() => {
    setEnglishLevelState(getEnglishLevel());
    clearExpiredReferralDismissals();
    fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(5000) })
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
      skipHistoryLoad();
      useAgentStore.getState().setActiveAgent(null, null);
      setLayerReady(true);
      return;
    }
    if (isTelegramMiniApp && !tmaInitComplete) return;

    let cancelled = false;

    const bootstrapClinicLayer = async () => {
      setLayerReady(false);

      const pending = consumePendingTmaAction();
      if (pending?.type === 'activate_agent') {
        if (pending.agentId === CV_BUILDER_AGENT_ID) {
          routeCvBuilderPage();
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
          if (!cancelled) setLayerReady(true);
          return;
        }
      }
      if (pending?.type === 'clinic') {
        if (useAgentStore.getState().activeAgentId) {
          const result = await exitToClinicRef.current();
          if (result?.reloadClinic && isLoggedIn) {
            await loadHistoryRef.current();
          }
        } else {
          await loadHistoryRef.current();
        }
        if (!cancelled) setLayerReady(true);
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
        routeCvBuilderPage();
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
        if (!cancelled) setLayerReady(true);
        return;
      }

      const active = await fetchActiveAgentRef.current();
      if (hasStickyActiveAgent(active)) {
        if (isDedicatedHubAgent(active.active_agent)) {
          await stayInClinicForDedicatedHub(active.active_agent);
        } else {
          clinicHubColdOpenRef.current = null;
          await resumeActiveAgentSilentlyRef.current(
            active.active_agent,
            active.session_id
          );
          skipHistoryLoad();
        }
      } else {
        clinicHubColdOpenRef.current = null;
        useAgentStore.getState().setActiveAgent(null, null);
        await loadHistoryRef.current();
      }

      if (!cancelled) setLayerReady(true);
    };

    void bootstrapClinicLayer();

    return () => {
      cancelled = true;
    };
  }, [
    isLoggedIn,
    isTelegramMiniApp,
    tmaInitComplete,
    locale,
    router,
    routeCvBuilderPage,
    routeInterviewPage,
    routeEnglishPage,
    shouldOpenCvBuilderPage,
    shouldOpenInterviewPage,
    shouldOpenEnglishPage,
    skipHistoryLoad,
    stayInClinicForDedicatedHub,
  ]);

  useActiveAgentSync(isLoggedIn && layerReady, async () => {
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
          routeCvBuilderPage();
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
    exitToClinic,
    isLoggedIn,
    loadHistory,
    routeCvBuilderPage,
    routeInterviewPage,
    routeEnglishPage,
    shouldOpenCvBuilderPage,
    shouldOpenInterviewPage,
    shouldOpenEnglishPage,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, isSwitching]);

  useEffect(() => {
    if (isClinicSending || !pendingClinicHistoryReloadRef.current) return;
    pendingClinicHistoryReloadRef.current = false;
    void loadHistory();
  }, [isClinicSending, loadHistory]);

  const handleQuickPrompt = (text: string) => {
    if (text === tClinic("prompts.cvText")) {
      void handleAgentSelect(CV_BUILDER_AGENT_ID);
      return;
    }
    void handleSend(text);
  };

  const handleSend = async (text: string) => {
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

    const result = await sendClinicMessage(text);

    if (result.ok) {
      const assistantMsg = useChatStore
        .getState()
        .messages.find((m) => m.id === result.assistantId);

      // Interim bridge (pre-KAZI-138): L2 still processes inline mock interview;
      // remove this path once BE returns referral-only next_actions. See KAZI-138.
      if (
        assistantMsg &&
        shouldClinicReplyRouteToInterviewHub({
          intent: assistantMsg.intent,
          nextActions: assistantMsg.nextActions,
          userText: text,
        })
      ) {
        markStreamComplete(result.assistantId);
        await activateMockInterviewHub();
        return;
      }
    }

    if (result.ok && result.routedToAgent) {
      if (isCvBuilderAgent(result.routedToAgent.agentId)) {
        const msg = useChatStore
          .getState()
          .messages.find((m) => m.id === result.assistantId);
        setCvAgentHandoff({
          sessionId: result.routedToAgent.sessionId,
          greeting: msg?.content?.trim() || undefined,
        });
        markStreamComplete(result.assistantId);
        routeCvBuilderPage();
        return;
      }
      const msg = useChatStore
        .getState()
        .messages.find((m) => m.id === result.assistantId);
      if (msg?.role === "assistant") {
        const syncResult = await syncActiveAgentFromGateway(
          result.routedToAgent.agentId,
          {
            ...msg,
            sessionId: result.routedToAgent.sessionId ?? msg.sessionId,
          }
        );
        if (syncResult && !syncResult.ok) {
          showToast(tClinic("activateFailed"), "error");
        }
      }
    }

    if (!result.ok) {
      if (result.error?.includes("500")) {
        showToast(tClinic("agentErrorFallback"), "error");
        const exitResult = await exitToClinic();
        await reloadClinicIfNeeded(exitResult);
        return;
      }
      showToast(result.error ?? tClinic("sendFailed"), "error");
    }
  };

  const handleAgentSelect = async (agentId: string) => {
    if (!isLoggedIn) {
      showToast(tClinic("loginToContinue"), "info");
      router.push(`/${locale}/login`);
      return;
    }
    const result = await requestAgentSwitch(agentId);
    if (result && !result.ok && result.needsConfirm) return;
    if (result && !result.ok) {
      showToast(result.error ?? tClinic("activateFailed"), "error");
    }
  };

  const handleBackToClinic = async () => {
    const result = await exitToClinic();
    if (result && !result.ok) {
      showToast(tClinic("deactivateFailed"), "error");
      return;
    }
    await reloadClinicIfNeeded(result);
  };

  const handleReferralAccept = async (agentId: string, messageId?: string) => {
    if (messageId) dismissMessageReferral(messageId);
    setPendingReferral(null);
    if (isMockInterviewAgent(agentId)) {
      await activateMockInterviewHub();
      return;
    }
    await handleAgentSelect(agentId);
  };

  const handleReferralDismiss = (agentId: string, messageId?: string) => {
    dismissReferral(agentId);
    if (messageId) dismissMessageReferral(messageId);
    setPendingReferral(null);
  };

  const handleNextAction = useCallback(
    (action: ChatNextAction) => {
      switch (action.type) {
        case "open_list":
        case "view_job_recommendations":
          router.push(`/${locale}/jobs`);
          return;
        case "upgrade_pro":
        case "unlock_pro":
          openPaywall("PRO_FEATURE_LOCKED");
          return;
        case "return_to_clinic":
          void handleBackToClinic();
          return;
        case "mock_interview":
        case "open_interview":
          void activateMockInterviewHub();
          return;
        case "english_tutor":
          void handleAgentSelect(ENGLISH_TUTOR_AGENT_ID);
          return;
        case "job_search":
          void handleAgentSelect("job_search");
          return;
        case "edit_cv":
        case "cv_builder":
          void handleAgentSelect(CV_BUILDER_AGENT_ID);
          return;
        case "complete_profile":
          router.push(getCompleteProfileHref(locale, { returnToCv: true }));
          return;
        default:
          return;
      }
    },
    [locale, router, openPaywall, handleBackToClinic, handleAgentSelect, routeCvBuilderPage, routeInterviewPage, routeEnglishPage, activateMockInterviewHub]
  );

  const handleJobCardClick = useCallback(
    (card: ChatJobCard) => {
      if (card.job_id) {
        router.push(`/${locale}/jobs/${encodeURIComponent(card.job_id)}`);
        return;
      }
      router.push(`/${locale}/jobs`);
    },
    [locale, router]
  );

  const clinicShellReady =
    layerReady && !isSwitching && !isAgentMode && !isHistoryLoading;

  const clinicIdleReady = clinicShellReady && !isSwitchingSession;

  const showWelcome = clinicIdleReady && clinicMessages.length === 0;

  const showActiveSessionsBanner =
    clinicIdleReady && isLoggedIn && activeSessionEntries.length > 0;

  // Fills SessionNavShell `<main className="min-h-0 flex-1">` — not viewport `h-screen`.
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-white">
      {isSwitching && <SwitchingOverlay />}

      {(!embeddedInWorkspace || isAgentMode) && (
      <ChatHeader
        locale={locale}
        mode={isAgentMode ? "agent" : "clinic"}
        agentName={activeEntry ? getAgentLabel(activeEntry, locale, "name") : undefined}
        agentEmoji={activeEntry?.emoji}
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
          <Link href={`/${locale}/login`}>
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

      <div
        className={`flex-1 overflow-y-auto flex flex-col bg-gray-bg min-h-0 ${
          isAgentMode ? "" : "p-4"
        }`}
      >
        {isAgentMode ? (
          <HubWorkflowStrip workflow={agentActiveWorkflow} locale={locale} />
        ) : null}
        <div
          className={`flex flex-col gap-3 flex-1 min-h-0 ${
            isAgentMode ? "p-4" : ""
          }`}
        >
        {showActiveSessionsBanner ? (
          <div className="sticky top-0 z-10 w-full max-w-3xl mx-auto shrink-0 bg-gray-bg pb-2">
            <ClinicActiveSessionsBanner
              locale={locale}
              entries={activeSessionEntries}
              className={showWelcome ? undefined : "mb-0"}
            />
          </div>
        ) : null}
        {!layerReady && isLoggedIn ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" aria-hidden />
            <p className="text-sm">{tClinic("layerResolving")}</p>
          </div>
        ) : showWelcome ? (
          <WelcomeView
            locale={locale}
            isLoggedIn={isLoggedIn}
            selectedLevel={englishLevel}
            onLevelChange={setEnglishLevelState}
            onAgentSelect={handleAgentSelect}
            onQuickPrompt={handleQuickPrompt}
            nbaAction={nbaResponse?.next_best_action ?? null}
            nbaLoading={nbaLoading}
            sessionsByAgent={sessionsByAgent}
          />
        ) : isSwitchingSession ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" aria-hidden />
            <p className="text-sm">{tSessions("sessionSwitching")}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const referralEntry =
              msg.referral &&
              AGENT_REGISTRY.find((a) => a.agentId === msg.referral?.agentId);
            return (
              <MessageBubble
                key={msg.id}
                role={msg.role === "user" ? "user" : "assistant"}
                content={msg.content}
                intent={msg.intent}
                status={msg.status}
                referral={msg.referral}
                nextActions={msg.nextActions}
                cards={msg.cards}
                locale={locale}
                streamComplete={msg.streamComplete ?? true}
                isStreaming={isStreaming && msg.content === ""}
                variant={isAgentMode ? "agent" : "clinic"}
                agentEmoji={referralEntry?.emoji}
                agentName={
                  referralEntry
                    ? getAgentLabel(referralEntry, locale, "name")
                    : undefined
                }
                onRetry={
                  !isAgentMode && msg.role === "user" && msg.status === "failed"
                    ? () => void retryMessage(msg.id)
                    : undefined
                }
                onStreamComplete={
                  !isAgentMode && msg.streamComplete === false
                    ? () => markStreamComplete(msg.id)
                    : undefined
                }
                onReferralAccept={
                  msg.referral && !msg.referral.dismissed
                    ? () => void handleReferralAccept(msg.referral!.agentId, msg.id)
                    : undefined
                }
                onReferralDismiss={
                  msg.referral && !msg.referral.dismissed
                    ? () => handleReferralDismiss(msg.referral!.agentId, msg.id)
                    : undefined
                }
                referralDisabled={isSending || isSwitching}
                onNextAction={handleNextAction}
                onJobCardClick={handleJobCardClick}
                actionsDisabled={isSending || isSwitching}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
        </div>
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

      <ChatInput
        onSend={handleSend}
          disabled={isSending || isSwitching || (isAgentMode && historyReadOnly) || isSwitchingSession}
        placeholder={inputPlaceholder}
        showAgentButton={isLoggedIn}
        onOpenAgents={() => setSwitcherOpen(true)}
      />

      <AgentSwitcher
        locale={locale}
        isLoggedIn={isLoggedIn}
        open={switcherOpen}
        activeAgentId={activeAgentId}
        sessionsByAgent={sessionsByAgent}
        onClose={() => setSwitcherOpen(false)}
        onSelect={handleAgentSelect}
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
