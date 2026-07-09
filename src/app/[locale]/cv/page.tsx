"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CvChatInput } from "@/components/cv/cv-chat-input";
import { CvParsedHints } from "@/components/cv/cv-parsed-hints";
import { MessageBubble } from "@/components/clinic/message-bubble";
import { ChatNextActions } from "@/components/clinic/chat-next-actions";
import { QuickReplies } from "@/components/clinic/quick-replies";
import { CvPreviewPane } from "@/components/cv/cv-preview-pane";
import { CvDiffPanel } from "@/components/cv/cv-diff-panel";
import { CvPipelineSteps } from "@/components/cv/cv-pipeline-steps";
import { CvSessionSidebar } from "@/components/cv/cv-session-sidebar";
import { CvNewSessionDialog } from "@/components/cv/cv-new-session-dialog";
import { CvWorkspaceTabs, type CvWorkspaceTab } from "@/components/cv/cv-workspace-tabs";
import { CvWorkspaceTitlebar } from "@/components/cv/cv-workspace-titlebar";
import { Button } from "@/components/ui/button";
import { handleCvNextAction, isRoutedCvAction, quickReplyLabel } from "@/lib/cv-next-action";
import { useCvAgent } from "@/hooks/use-cv-agent";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";
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
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<CvWorkspaceTab>("chat");

  const agentSession = useCvAgent(jobId);

  const {
    messages,
    preview,
    diff,
    quickReplies,
    isLoading,
    isSending,
    isUploading,
    isExporting,
    error,
    needsLogin,
    needsOnboarding,
    needsProfile,
    pipelineState,
    nextActions,
    isSessionReady,
    isReadOnly,
    sessionResumed,
    parsedSections,
    documentId,
    sessions,
    sessionsLoading,
    sessionId,
    sendMessage,
    sendPayload,
    uploadResume,
    confirmCv,
    regenerateCv,
    exportCvPdf,
    selectSession,
    refreshSessions,
    restart,
  } = agentSession;

  const showProfileGate = needsProfile === true;
  const showWorkspace =
    !needsLogin && !needsOnboarding && !showProfileGate;
  const showPipelineSteps = showWorkspace && !isReadOnly;
  const canDownloadCv = documentId != null;
  const resumeReady = canDownloadCv || preview != null;

  useEffect(() => {
    if (canDownloadCv) {
      setMobileTab("resume");
    }
  }, [canDownloadCv]);

  const routedActions = nextActions.filter((a) => isRoutedCvAction(a.type));
  const pickerActions = nextActions.filter((a) => !isRoutedCvAction(a.type));

  const handleCvAction = useCallback(
    (action: ChatNextAction) => {
      handleCvNextAction(action, {
        locale,
        router,
        openPaywall,
        sendPayload: (payload, showUserBubble) =>
          void sendPayload(payload, { showUserBubble }),
        intakeConfirm: () => void agentSession.intakeConfirm(),
        acceptCv: () => void confirmCv(),
        regenerateCv: () => void regenerateCv(),
        exportCv: () => void exportCvPdf(),
      });
    },
    [
      agentSession.intakeConfirm,
      confirmCv,
      exportCvPdf,
      locale,
      openPaywall,
      regenerateCv,
      router,
      sendPayload,
    ]
  );

  const handleRestart = useCallback(async () => {
    setNewSessionDialogOpen(false);
    await restart();
    await refreshSessions();
  }, [refreshSessions, restart]);

  const requestNewSession = useCallback(() => {
    if (isLoading || isSending) return;
    setNewSessionDialogOpen(true);
  }, [isLoading, isSending]);

  const handleDownload = useCallback(() => {
    void exportCvPdf();
  }, [exportCvPdf]);

  const previewFooter = (
    <>
      {parsedSections && !isReadOnly ? (
        <CvParsedHints
          sections={parsedSections}
          className="px-4 py-3 border-t border-workspace-border bg-workspace-header text-workspace-text"
          theme="workspace"
        />
      ) : null}
      {diff && !isReadOnly ? (
        <CvDiffPanel
          diff={diff}
          onConfirm={() => void confirmCv()}
          onRegenerate={() => void regenerateCv()}
          disabled={isSending || isUploading}
          theme="workspace"
        />
      ) : null}
    </>
  );

  if (!showWorkspace) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0 flex flex-col">
        <Header locale={locale} />
        <main className="pt-16 flex-1 flex flex-col">
          <GateScreen
            needsLogin={needsLogin}
            needsOnboarding={needsOnboarding}
            showProfileGate={showProfileGate}
            locale={locale}
            router={router}
            t={t}
          />
        </main>
        <BottomNav locale={locale} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-workspace-bg text-workspace-text overflow-hidden">
      <CvWorkspaceTitlebar
        locale={locale}
        canDownload={canDownloadCv}
        isExporting={isExporting}
        onDownload={handleDownload}
        onNewSession={requestNewSession}
        actionsDisabled={isLoading || isSending}
        center={
          showPipelineSteps ? (
            <CvPipelineSteps pipelineState={pipelineState} isWorking={isSending} />
          ) : null
        }
      />

      <div className="flex-1 flex min-h-0">
        <CvSessionSidebar
          sessions={sessions}
          activeSessionId={sessionId}
          isLoading={sessionsLoading}
          onSelect={(id) => void selectSession(id)}
          onNew={requestNewSession}
          disabled={isSending || isLoading}
          className="hidden lg:flex"
        />

        <CvWorkspaceTabs
          active={mobileTab}
          onChange={setMobileTab}
          resumeReady={resumeReady}
        />

        <div className="flex-1 flex min-w-0 min-h-0">
          <section
            className={cn(
              "flex-1 flex flex-col min-w-0 min-h-0 bg-workspace-bg",
              mobileTab !== "chat" && "hidden lg:flex"
            )}
          >
            {sessionResumed && !isReadOnly ? (
              <p className="px-3 py-1.5 text-[11px] text-workspace-accent bg-workspace-accent/10 border-b border-workspace-border text-center">
                {t("sessionResumedBanner")}
              </p>
            ) : null}
            {isReadOnly ? (
              <p className="px-3 py-1.5 text-[11px] text-amber-400/90 bg-amber-950/30 border-b border-workspace-border text-center">
                {t("readOnlyBanner")}
              </p>
            ) : null}

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 min-h-0">
              {error ? (
                <p className="text-xs text-red-400 text-center">{error}</p>
              ) : null}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  variant="agent"
                  surface="workspace"
                />
              ))}
              {isLoading && messages.length === 0 ? (
                <p className="text-xs text-workspace-muted text-center py-12">
                  {t("sessionLoading")}
                </p>
              ) : null}
            </div>

            {!isReadOnly ? (
              <>
                {routedActions.length > 0 ? (
                  <div className="px-3 pb-2 shrink-0">
                    <ChatNextActions
                      actions={routedActions}
                      locale={locale}
                      onAction={handleCvAction}
                      disabled={!isSessionReady || isSending || isExporting}
                    />
                  </div>
                ) : null}
                {pickerActions.length > 0 ? (
                  <QuickReplies
                    options={pickerActions.map((a) =>
                      quickReplyLabel(a, locale)
                    )}
                    disabled={!isSessionReady || isSending || isExporting}
                    theme="workspace"
                    onSelect={(text) => {
                      const action = pickerActions.find(
                        (a) => quickReplyLabel(a, locale) === text
                      );
                      if (action) handleCvAction(action);
                    }}
                  />
                ) : null}
                {quickReplies.length > 0 ? (
                  <QuickReplies
                    options={quickReplies}
                    disabled={!isSessionReady || isSending || isExporting}
                    theme="workspace"
                    onSelect={(text) => void sendMessage(text)}
                  />
                ) : null}
                <CvChatInput
                  onSend={(text) => void sendMessage(text)}
                  onUpload={(file) => void uploadResume(file)}
                  disabled={
                    !isSessionReady ||
                    isSending ||
                    isUploading ||
                    isExporting
                  }
                  isUploading={isUploading}
                  placeholder={t("inputPlaceholder")}
                />
              </>
            ) : null}
          </section>

          <CvPreviewPane
            preview={preview}
            isLoading={isLoading && !preview && !canDownloadCv}
            canDownload={canDownloadCv}
            isExporting={isExporting}
            onDownload={handleDownload}
            footer={previewFooter}
            className={cn(
              mobileTab !== "resume" && "hidden lg:flex",
              mobileTab === "resume" && "flex flex-1 lg:flex-none"
            )}
          />
        </div>
      </div>

      <CvNewSessionDialog
        open={newSessionDialogOpen}
        onConfirm={() => void handleRestart()}
        onCancel={() => setNewSessionDialogOpen(false)}
      />
    </div>
  );
}

function GateScreen({
  needsLogin,
  needsOnboarding,
  showProfileGate,
  locale,
  router,
  t,
}: {
  needsLogin: boolean;
  needsOnboarding: boolean;
  showProfileGate: boolean;
  locale: string;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslations<"cv">>;
}) {
  const banner = needsLogin
    ? { text: t("loginBanner"), href: `/${locale}/login`, cta: t("signIn") }
    : needsOnboarding
      ? { text: t("onboardingBanner"), href: `/${locale}/chat`, cta: t("completeProfile") }
      : showProfileGate
        ? { text: t("profileBanner"), href: `/${locale}/profile`, cta: t("goToProfile") }
        : null;

  if (!banner) return null;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center max-w-sm w-full">
        <p className="text-sm text-gray-700 mb-5">{banner.text}</p>
        <Button className="w-full" onClick={() => router.push(banner.href)}>
          {banner.cta}
        </Button>
      </div>
    </div>
  );
}

export default function CvPage({ params }: CvPageProps) {
  const t = useTranslations("cv");
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] flex items-center justify-center bg-workspace-bg text-workspace-muted text-sm">
          {t("sessionLoading")}
        </div>
      }
    >
      <CvPageContent locale={params.locale} />
    </Suspense>
  );
}
