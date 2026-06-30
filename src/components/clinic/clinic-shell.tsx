"use client";

import { useEffect, useRef, useState } from "react";
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
import { ChatInput } from "@/components/chat/chat-input";
import { useClinicChat } from "@/hooks/use-clinic-chat";
import { getDeepLinkAgentId, useAgentSwitch } from "@/hooks/use-agent-switch";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useAuthStore, useAgentStore, useUIStore } from "@/lib/store";
import {
  AGENT_REGISTRY,
  AGENT_QUICK_REPLIES,
  getAgentLabel,
} from "@/lib/agents/registry";
import { getEnglishLevel } from "@/lib/auth";
import type { SupportedLocale } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/constants";

interface ClinicShellProps {
  locale: string;
}

export function ClinicShell({ locale }: ClinicShellProps) {
  const router = useRouter();
  const t = useTranslations("chat");
  const tClinic = useTranslations("clinic");

  const {
    messages: clinicMessages,
    isSending: isClinicSending,
    isStreaming: isClinicStreaming,
    isHistoryLoading,
    loadHistory,
    skipHistoryLoad,
    sendMessage: sendClinicMessage,
  } = useClinicChat();

  const {
    activeAgentId,
    agentSessionId,
    isSwitching,
    statusBadge,
    fetchActiveAgent,
    switchToAgent,
    exitToClinic,
  } = useAgentSwitch(locale);

  const switchToAgentRef = useRef(switchToAgent);
  const fetchActiveAgentRef = useRef(fetchActiveAgent);
  switchToAgentRef.current = switchToAgent;
  fetchActiveAgentRef.current = fetchActiveAgent;

  const {
    messages: agentMessages,
    isAgentSending,
    isAgentStreaming,
    loadAgentHistory,
    sendMessage: sendAgentMessage,
  } = useAgentChat(activeAgentId, agentSessionId);

  const loadAgentHistoryRef = useRef(loadAgentHistory);
  loadAgentHistoryRef.current = loadAgentHistory;

  const switcherOpen = useAgentStore((s) => s.switcherOpen);
  const setSwitcherOpen = useAgentStore((s) => s.setSwitcherOpen);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);

  const [isOnline, setIsOnline] = useState(false);
  const [englishLevel, setEnglishLevelState] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeEntry = AGENT_REGISTRY.find((a) => a.agentId === activeAgentId);
  const isAgentMode = !!activeAgentId && !!activeEntry;
  const messages = isAgentMode ? agentMessages : clinicMessages;
  const isSending = isAgentMode ? isAgentSending : isClinicSending;
  const isStreaming = isAgentMode ? isAgentStreaming : isClinicStreaming;

  const inputPlaceholder = isAgentMode
    ? getAgentLabel(activeEntry, locale, "promptHint")
    : t("input.placeholder");

  const quickReplies =
    isAgentMode && activeAgentId
      ? AGENT_QUICK_REPLIES[activeAgentId]?.[locale as SupportedLocale] ?? []
      : [];

  useEffect(() => {
    setEnglishLevelState(getEnglishLevel());
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

    const initAgent = async () => {
      const deepLinkAgent = getDeepLinkAgentId(window.location.search);
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
  }, [isLoggedIn]);

  useEffect(() => {
    if (activeAgentId && agentSessionId) {
      loadAgentHistory();
    }
  }, [activeAgentId, agentSessionId, loadAgentHistory]);

  useEffect(() => {
    const onPopState = () => {
      if (activeAgentId) {
        exitToClinic({ skipHistory: true });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [activeAgentId, exitToClinic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, isSwitching]);

  const handleSend = async (text: string) => {
    if (!isLoggedIn) {
      showToast(tClinic("loginToChat"), "info");
      router.push(`/${locale}/login`);
      return;
    }

    const result = isAgentMode
      ? await sendAgentMessage(text)
      : await sendClinicMessage(text);

    if (result && !result.ok) {
      if (result.error?.includes("500")) {
        showToast(tClinic("agentErrorFallback"), "error");
        await exitToClinic();
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
    const result = await switchToAgent(agentId);
    if (result && !result.ok) {
      showToast(result.error ?? tClinic("activateFailed"), "error");
    }
  };

  const handleBackToClinic = async () => {
    const result = await exitToClinic();
    if (result && !result.ok) {
      showToast(tClinic("deactivateFailed"), "error");
    }
  };

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
            onQuickPrompt={handleSend}
          />
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role === "user" ? "user" : "assistant"}
              content={msg.content}
              intent={msg.intent}
              isStreaming={isStreaming && msg.content === ""}
              variant={isAgentMode ? "agent" : "clinic"}
            />
          ))
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
