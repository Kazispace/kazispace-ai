"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/clinic/message-bubble";
import { ChatNextActions } from "@/components/clinic/chat-next-actions";
import { QuickReplies } from "@/components/clinic/quick-replies";
import { CvPreviewPane } from "@/components/cv/cv-preview-pane";
import { CvDiffPanel } from "@/components/cv/cv-diff-panel";
import { Button } from "@/components/ui/button";
import { CV_AGENT_HUB_ENABLED } from "@/lib/cv-agent-config";
import { handleCvNextAction, isRoutedCvAction, quickReplyLabel } from "@/lib/cv-next-action";
import { useCvAgent } from "@/hooks/use-cv-agent";
import { useCvChat } from "@/hooks/use-cv-chat";
import { useUIStore } from "@/lib/store";
import type { ChatNextAction } from "@/types/chat-envelope";

interface CvPageProps {
  params: { locale: string };
}

function CvPageContent({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const t = useTranslations("cv");
  const openPaywall = useUIStore((s) => s.openPaywall);

  const legacySession = useCvChat(jobId, { enabled: !CV_AGENT_HUB_ENABLED });
  const agentSession = useCvAgent(jobId, { enabled: CV_AGENT_HUB_ENABLED });
  const session = CV_AGENT_HUB_ENABLED ? agentSession : legacySession;

  const {
    messages,
    preview,
    diff,
    quickReplies,
    isLoading,
    isSending,
    error,
    needsLogin,
    needsOnboarding,
    sendMessage,
    confirmCv,
    regenerateCv,
  } = session;
  const nextActions = CV_AGENT_HUB_ENABLED ? agentSession.nextActions : [];
  const showProfileGate =
    CV_AGENT_HUB_ENABLED && agentSession.needsProfile === true;
  const canChat = CV_AGENT_HUB_ENABLED
    ? agentSession.isSessionReady
    : !isLoading && !needsOnboarding && !error;

  const routedActions = nextActions.filter((a) => isRoutedCvAction(a.type));
  const pickerActions = nextActions.filter((a) => !isRoutedCvAction(a.type));

  const handleCvAction = useCallback(
    (action: ChatNextAction) => {
      handleCvNextAction(action, {
        locale,
        router,
        openPaywall,
        sendPayload: (payload) => void sendMessage(payload),
        intakeConfirm: () => void agentSession.intakeConfirm(),
        acceptCv: () => void confirmCv(),
        regenerateCv: () => void regenerateCv(),
      });
    },
    [agentSession.intakeConfirm, confirmCv, locale, openPaywall, regenerateCv, router, sendMessage]
  );

  const subtitle = useMemo(
    () => (jobId ? t("subtitleWithJob", { jobId }) : t("subtitle")),
    [jobId, t]
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0 flex flex-col">
      <Header locale={locale} />
      <main className="pt-16 flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full">
        <section className="flex-1 flex flex-col min-w-0 min-h-[50vh] lg:min-h-[calc(100vh-4rem)]">
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <Link
              href={`/${locale}/mine`}
              className="text-xs text-kazi-orange font-medium"
            >
              {t("backToMine")}
            </Link>
            <h1 className="text-lg font-bold text-kazi-navy mt-1">{t("title")}</h1>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>

          {needsLogin ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
                <p className="text-sm text-gray-700 mb-4">{t("loginBanner")}</p>
                <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
                  {t("signIn")}
                </Button>
              </div>
            </div>
          ) : needsOnboarding ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
                <p className="text-sm text-gray-700 mb-4">{t("onboardingBanner")}</p>
                <Button size="sm" onClick={() => router.push(`/${locale}/chat`)}>
                  {t("completeProfile")}
                </Button>
              </div>
            </div>
          ) : showProfileGate ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center max-w-sm">
                <p className="text-sm text-gray-700 mb-4">{t("profileBanner")}</p>
                <Button size="sm" onClick={() => router.push(`/${locale}/profile`)}>
                  {t("goToProfile")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-bg">
                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    variant="agent"
                  />
                ))}
                {isLoading && messages.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {t("sessionLoading")}
                  </p>
                )}
              </div>
              {routedActions.length > 0 && (
                <div className="px-4 pb-2 bg-gray-bg">
                  <ChatNextActions
                    actions={routedActions}
                    locale={locale}
                    onAction={handleCvAction}
                    disabled={!canChat || isSending}
                  />
                </div>
              )}
              {pickerActions.length > 0 && (
                <QuickReplies
                  options={pickerActions.map((a) => quickReplyLabel(a, locale))}
                  disabled={!canChat || isSending}
                  onSelect={(text) => {
                    const action = pickerActions.find(
                      (a) => quickReplyLabel(a, locale) === text
                    );
                    if (action) handleCvAction(action);
                  }}
                />
              )}
              {quickReplies.length > 0 && (
                <QuickReplies
                  options={quickReplies}
                  disabled={!canChat || isSending}
                  onSelect={(text) => void sendMessage(text)}
                />
              )}
              <ChatInput
                onSend={(text) => void sendMessage(text)}
                disabled={!canChat || isSending}
                placeholder={t("inputPlaceholder")}
              />
            </>
          )}
        </section>

        {!needsLogin && !needsOnboarding && !showProfileGate && (
          <CvPreviewPane
            preview={preview}
            isLoading={isLoading && !preview}
            footer={
              diff ? (
                <CvDiffPanel
                  diff={diff}
                  onConfirm={() => void confirmCv()}
                  onRegenerate={() => void regenerateCv()}
                  disabled={isSending}
                />
              ) : null
            }
          />
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}

export default function CvPage({ params }: CvPageProps) {
  const t = useTranslations("cv");
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          {t("sessionLoading")}
        </div>
      }
    >
      <CvPageContent locale={params.locale} />
    </Suspense>
  );
}
