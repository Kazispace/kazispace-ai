"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChatHeader } from "./chat-header";
import { WelcomeView } from "./welcome-view";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { useClinicChat } from "@/hooks/use-clinic-chat";
import { useAuthStore, useUIStore } from "@/lib/store";
import { getEnglishLevel } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/constants";

interface ClinicShellProps {
  locale: string;
}

export function ClinicShell({ locale }: ClinicShellProps) {
  const router = useRouter();
  const t = useTranslations("chat");
  const tClinic = useTranslations("clinic");
  const { messages, isSending, isStreaming, isHistoryLoading, loadHistory, skipHistoryLoad, sendMessage } =
    useClinicChat();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const showToast = useUIStore((s) => s.showToast);
  const [isOnline, setIsOnline] = useState(false);
  const [englishLevel, setEnglishLevelState] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async (text: string) => {
    if (!isLoggedIn) {
      showToast(tClinic("loginToChat"), "info");
      router.push(`/${locale}/login`);
      return;
    }

    const result = await sendMessage(text);
    if (result && !result.ok) {
      showToast(result.error ?? tClinic("sendFailed"), "error");
    }
  };

  const handleAgentSelect = (agentId: string) => {
    if (!isLoggedIn) {
      showToast(tClinic("loginToContinue"), "info");
      router.push(`/${locale}/login`);
      return;
    }
    // TODO: Sprint 2 — replace with useAgentSwitch(agentId)
    showToast(tClinic("agentHubSprint2", { agent: agentId }), "info");
  };

  const showWelcome = !isHistoryLoading && messages.length === 0;

  return (
    <div className="flex flex-col h-screen max-w-[860px] mx-auto bg-white shadow-xl">
      <ChatHeader locale={locale} isOnline={isOnline} />

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
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role === "user" ? "user" : "assistant"}
                content={msg.content}
                intent={msg.intent}
                isStreaming={isStreaming && msg.content === ""}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        placeholder={t("input.placeholder")}
      />
    </div>
  );
}
