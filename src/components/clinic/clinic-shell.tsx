"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChatHeader } from "./chat-header";
import { WelcomeView } from "./welcome-view";
import { MessageBubble } from "./message-bubble";
import { SwitchingOverlay } from "./switching-overlay";
import { AgentStatusBar } from "./agent-status-bar";
import { QuickReplies } from "./quick-replies";
import { AgentSwitcher } from "./agent-switcher";
import { ReferralPrompt } from "./referral-prompt";
import { ChatInput } from "@/components/chat/chat-input";
import { useClinicChat } from "@/hooks/use-clinic-chat";
import { getDeepLinkAgentId, getDeepLinkReferralId, clearReferralFromUrl, useAgentSwitch } from "@/hooks/use-agent-switch";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useAuthStore, useAgentStore, useChatStore, useUIStore } from "@/lib/store";
import {
  AGENT_REGISTRY,
  AGENT_QUICK_REPLIES,
  getAgentLabel,
} from "@/lib/agents/registry";
import { getEnglishLevel } from "@/lib/auth";
import { dismissReferral, isReferralDismissed, clearExpiredReferralDismissals } from "@/lib/referral-dismiss";
import { consumePendingTmaAction, routeForTmaAction } from "@/lib/tma-routing";
import {
  CV_AGENT_HUB_ENABLED,
  CV_BUILDER_AGENT_ID,
} from "@/lib/cv-agent-config";
import type { SupportedLocale } from "@/lib/constants";
import type { ChatJobCard, ChatNextAction } from "@/types";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/constants";

interface ClinicShellProps {
  locale: string;
}

export function ClinicShell({ locale }: ClinicShellProps) {
  const router = useRouter();
  const t = useTranslations("chat");
  const tClinic = useTranslations("clinic");
  const tReferral = useTranslations("referral");

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
  } = useClinicChat();

  const {
    activeAgentId,
    agentSessionId,
    isSwitching,
    statusBadge,
    fetchActiveAgent,
    switchToAgent,
    syncActiveAgentFromGateway,
    exitToClinic,
  } = useAgentSwitch(locale);

  const switchToAgentRef = useRef(switchToAgent);
  const fetchActiveAgentRef = useRef(fetchActiveAgent);
  const exitToClinicRef = useRef(exitToClinic);
  switchToAgentRef.current = switchToAgent;
  fetchActiveAgentRef.current = fetchActiveAgent;
  exitToClinicRef.current = exitToClinic;

  const {
    messages: agentMessages,
    isAgentSending,
    isAgentStreaming,
    loadAgentHistory,
    sendMessage: sendAgentMessage,
  } = useAgentChat(activeAgentId, agentSessionId);

  const loadHistoryRef = useRef(loadHistory);
  loadHistoryRef.current = loadHistory;

  const loadAgentHistoryRef = useRef(loadAgentHistory);
  loadAgentHistoryRef.current = loadAgentHistory;

  const switcherOpen = useAgentStore((s) => s.switcherOpen);
  const setSwitcherOpen = useAgentStore((s) => s.setSwitcherOpen);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const tmaInitComplete = useUIStore((s) => s.tmaInitComplete);

  const reloadClinicIfNeeded = useCallback(
    async (result?: { reloadClinic?: boolean; ok?: boolean }) => {
      if (result?.reloadClinic && isLoggedIn) {
        await loadHistory();
      }
    },
    [isLoggedIn, loadHistory]
  );

  const [isOnline, setIsOnline] = useState(false);
  const [englishLevel, setEnglishLevelState] = useState<string | null>(null);
  const [pendingReferral, setPendingReferral] = useState<{
    agentId: string;
    reason: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeEntry = AGENT_REGISTRY.find((a) => a.agentId === activeAgentId);
  const isAgentMode = !!activeAgentId && !!activeEntry;
  const messages = isAgentMode ? agentMessages : clinicMessages;
  const isSending = isAgentMode ? isAgentSending : isClinicSending;
  const isStreaming = isAgentMode ? isAgentStreaming : isClinicStreaming;

  const routeCvBuilderPage = useCallback(
    (targetJobId?: string | null) => {
      const query = targetJobId
        ? `?job_id=${encodeURIComponent(targetJobId)}`
        : '';
      router.push(`/${locale}/cv${query}`);
    },
    [locale, router]
  );

  const shouldOpenCvBuilderPage = useCallback((agentId: string) => {
    return agentId === CV_BUILDER_AGENT_ID && CV_AGENT_HUB_ENABLED;
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
    if (isLoggedIn) {
      loadHistory();
    } else {
      skipHistoryLoad();
    }
    fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => setIsOnline(r.ok))
      .catch(() => setIsOnline(false));
  }, [isLoggedIn, loadHistory, skipHistoryLoad]);

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
    if (!isLoggedIn) return;
    if (isTelegramMiniApp && !tmaInitComplete) return;

    const initAgent = async () => {
      const pending = consumePendingTmaAction();
      if (pending?.type === 'activate_agent') {
        if (
          pending.agentId === CV_BUILDER_AGENT_ID &&
          CV_AGENT_HUB_ENABLED
        ) {
          routeCvBuilderPage();
          return;
        }
        if (AGENT_REGISTRY.some((a) => a.agentId === pending.agentId)) {
          await switchToAgentRef.current(pending.agentId);
          return;
        }
      }
      if (pending?.type === 'clinic') {
        if (useAgentStore.getState().activeAgentId) {
          const result = await exitToClinicRef.current();
          if (result?.reloadClinic && isLoggedIn) {
            await loadHistoryRef.current();
          }
        }
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
          pending.type === 'cv_job')
      ) {
        router.push(routeForTmaAction(locale, pending));
        return;
      }

      const deepLinkAgent = getDeepLinkAgentId(window.location.search);
      if (deepLinkAgent && shouldOpenCvBuilderPage(deepLinkAgent)) {
        routeCvBuilderPage();
        return;
      }
      if (
        deepLinkAgent &&
        AGENT_REGISTRY.some((a) => a.agentId === deepLinkAgent)
      ) {
        await switchToAgentRef.current(deepLinkAgent);
        return;
      }
      const active = await fetchActiveAgentRef.current();
      if (active?.active_agent && active.session_id) {
        await loadAgentHistoryRef.current();
      }
    };

    void initAgent();
  }, [
    isLoggedIn,
    isTelegramMiniApp,
    tmaInitComplete,
    locale,
    router,
    routeCvBuilderPage,
    shouldOpenCvBuilderPage,
  ]);

  useEffect(() => {
    if (activeAgentId && agentSessionId) {
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
        void switchToAgentRef.current(agentFromUrl);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [
    exitToClinic,
    isLoggedIn,
    loadHistory,
    routeCvBuilderPage,
    shouldOpenCvBuilderPage,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, isSwitching]);

  const handleQuickPrompt = (text: string) => {
    if (text === tClinic("prompts.cvText")) {
      router.push(`/${locale}/cv`);
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

    if (result.ok && result.routedToAgent) {
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
    if (agentId === CV_BUILDER_AGENT_ID && CV_AGENT_HUB_ENABLED) {
      routeCvBuilderPage();
      return;
    }
    const result = await switchToAgent(agentId);
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
          openPaywall("PRO_FEATURE_LOCKED");
          return;
        case "return_to_clinic":
          void handleBackToClinic();
          return;
        case "mock_interview":
          void handleAgentSelect("mock_interview");
          return;
        case "job_search":
          void handleAgentSelect("job_search");
          return;
        case "complete_profile":
          router.push(`/${locale}/profile`);
          return;
        default:
          return;
      }
    },
    [locale, router, openPaywall, handleBackToClinic, handleAgentSelect]
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

  const showWelcome =
    !isSwitching && !isAgentMode && !isHistoryLoading && clinicMessages.length === 0;

  return (
    <div className="relative flex flex-col h-screen max-w-[860px] mx-auto bg-white shadow-xl">
      {isSwitching && <SwitchingOverlay />}

      <ChatHeader
        locale={locale}
        mode={isAgentMode ? "agent" : "clinic"}
        agentName={activeEntry ? getAgentLabel(activeEntry, locale, "name") : undefined}
        agentEmoji={activeEntry?.emoji}
        isOnline={isOnline}
        onBackToClinic={isAgentMode ? handleBackToClinic : undefined}
      />

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

      {isAgentMode && statusBadge && <AgentStatusBar label={statusBadge} />}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-bg">
        {showWelcome ? (
          <WelcomeView
            locale={locale}
            isLoggedIn={isLoggedIn}
            selectedLevel={englishLevel}
            onLevelChange={setEnglishLevelState}
            onAgentSelect={handleAgentSelect}
            onQuickPrompt={handleQuickPrompt}
          />
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
        disabled={isSending || isSwitching}
        placeholder={inputPlaceholder}
        showAgentButton={isLoggedIn}
        onOpenAgents={() => setSwitcherOpen(true)}
      />

      <AgentSwitcher
        locale={locale}
        isLoggedIn={isLoggedIn}
        open={switcherOpen}
        activeAgentId={activeAgentId}
        onClose={() => setSwitcherOpen(false)}
        onSelect={handleAgentSelect}
      />
    </div>
  );
}
