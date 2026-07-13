"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  AgentTransitionProvider,
  useAgentTransition,
} from "@/components/agent-transition/agent-transition-provider";
import { AssistantTurn } from "@/components/chat/assistant-turn";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/clinic/message-bubble";
import { QuickReplies } from "@/components/clinic/quick-replies";
import { EnglishWorkspace } from "@/components/english/english-workspace";
import { HubAgentShell } from "@/components/hub/hub-agent-shell";
import { HubSessionStaleBanner } from "@/components/hub/hub-session-stale-banner";
import { Button } from "@/components/ui/button";
import { useEnglishAgent } from "@/hooks/use-english-agent";
import { useHubActiveAgentSync } from "@/hooks/use-hub-active-agent-sync";
import { useHubSessionStaleBanner } from "@/hooks/use-hub-session-stale-banner";
import { ENGLISH_TUTOR_AGENT_ID } from "@/lib/english-tutor-config";
import {
  ENGLISH_HUB_QUICK_ACTION_KEYS,
  englishHubQuickActionHref,
  matchEnglishHubQuickAction,
  type EnglishHubQuickAction,
} from "@/lib/english-hub-quick-actions";
import { EPP_PROFILE_ENABLED } from "@/lib/constants";
import { getAgentLabel, AGENT_REGISTRY } from "@/lib/agents/registry";
import { useAuthStore, useUIStore } from "@/lib/store";

interface EnglishPageProps {
  params: { locale: string };
}

function EnglishPageContent({ locale }: { locale: string }) {
  const router = useRouter();
  const t = useTranslations("english");
  const showToast = useUIStore((s) => s.showToast);
  const { openSwitcher } = useAgentTransition();

  const {
    messages,
    agentSessionId,
    needsLogin,
    isOpening,
    isSending,
    openError,
    sendMessage,
    resyncSession,
  } = useEnglishAgent(locale, EPP_PROFILE_ENABLED);

  const sessionStale = useHubSessionStaleBanner(
    ENGLISH_TUTOR_AGENT_ID,
    agentSessionId,
    EPP_PROFILE_ENABLED && !needsLogin,
    resyncSession
  );

  useHubActiveAgentSync(locale, ENGLISH_TUTOR_AGENT_ID, EPP_PROFILE_ENABLED && !needsLogin);

  const quickActionLabels = useMemo(
    () =>
      Object.fromEntries(
        ENGLISH_HUB_QUICK_ACTION_KEYS.map((key) => [key, t(`quickActions.${key}`)])
      ) as Record<EnglishHubQuickAction, string>,
    [t]
  );

  const quickReplies = useMemo(
    () => ENGLISH_HUB_QUICK_ACTION_KEYS.map((key) => quickActionLabels[key]),
    [quickActionLabels]
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      const action = matchEnglishHubQuickAction(text, quickActionLabels);
      if (action) {
        showToast(t("quickActionNav", { action: text }), "info");
        router.push(englishHubQuickActionHref(locale, action));
        return;
      }
      void sendMessage(text);
    },
    [locale, quickActionLabels, router, sendMessage, showToast, t]
  );

  const inputDisabled = isOpening || isSending || Boolean(openError);

  const englishAgent = AGENT_REGISTRY.find((a) => a.agentId === ENGLISH_TUTOR_AGENT_ID);

  const shellHeader = (
    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-lg font-bold text-kazi-navy">
          🗣️ {englishAgent ? getAgentLabel(englishAgent, locale, "name") : t("chatSubtitle")}
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">{t("chatSubtitle")}</p>
      </div>
    </div>
  );

  const chatBody = (
    <div className="flex-1 overflow-y-auto flex flex-col bg-gray-bg min-h-0">
      <div className="flex-1 p-4 flex flex-col gap-3">
        {isOpening && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
            <p className="text-sm text-gray-600">{t("chatLoading")}</p>
          </div>
        ) : (
          messages.map((msg) =>
            msg.role === "user" ? (
              <MessageBubble
                key={msg.id}
                role="user"
                content={msg.content}
                variant="agent"
                locale={locale}
              />
            ) : (
              <AssistantTurn
                key={msg.id}
                content={msg.content}
                variant="agent"
                locale={locale}
                isStreaming={isSending && msg.content === ""}
              />
            )
          )
        )}

        {openError ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 self-start">
            {openError}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!EPP_PROFILE_ENABLED) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <p className="text-sm text-gray-600">{t("featureDisabled")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      {sessionStale.stale ? (
        <HubSessionStaleBanner
          onRefresh={sessionStale.refresh}
          onDismiss={sessionStale.dismiss}
        />
      ) : null}
      <main className="flex min-h-0 flex-1 w-full flex-col">
        {needsLogin ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
              <p className="text-sm text-gray-700 mb-4">{t("loginBanner")}</p>
              <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
                {t("signIn")}
              </Button>
            </div>
          </div>
        ) : (
          <HubAgentShell
            header={shellHeader}
            workspace={<EnglishWorkspace locale={locale} />}
            composerPrefix={
              quickReplies.length > 0 ? (
                <QuickReplies
                  options={quickReplies}
                  disabled={inputDisabled}
                  onSelect={handleQuickReply}
                />
              ) : undefined
            }
            input={
              <ChatInput
                onSend={(text) => void sendMessage(text)}
                disabled={inputDisabled}
                placeholder={t("chatPlaceholder")}
                showAgentButton
                onOpenAgents={openSwitcher}
              />
            }
          >
            {chatBody}
          </HubAgentShell>
        )}
      </main>
    </div>
  );
}

export default function EnglishPage({ params }: EnglishPageProps) {
  const t = useTranslations("english");
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <AgentTransitionProvider
      locale={params.locale}
      fromSurface="english"
      hubAgentId={ENGLISH_TUTOR_AGENT_ID}
      isLoggedIn={isLoggedIn}
    >
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-gray-500">
            {t("loading")}
          </div>
        }
      >
        <EnglishPageContent locale={params.locale} />
      </Suspense>
    </AgentTransitionProvider>
  );
}
