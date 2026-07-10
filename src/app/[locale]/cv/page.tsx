"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { CvAgentWelcome } from "@/components/cv/cv-agent-welcome";
import { CvChatInput } from "@/components/cv/cv-chat-input";
import { CvHeader } from "@/components/cv/cv-header";
import { CvParsedHints } from "@/components/cv/cv-parsed-hints";
import { MessageBubble } from "@/components/clinic/message-bubble";
import { ChatNextActions } from "@/components/clinic/chat-next-actions";
import { QuickReplies } from "@/components/clinic/quick-replies";
import { CvPreviewPane } from "@/components/cv/cv-preview-pane";
import { CvDiffPanel } from "@/components/cv/cv-diff-panel";
import { AgentSessionPanel } from "@/components/agent/agent-session-panel";
import { CvNewSessionDialog } from "@/components/cv/cv-new-session-dialog";
import { CvWorkspaceTabs, type CvWorkspaceTab, CV_CHAT_PANEL_ID, CV_RESUME_PANEL_ID } from "@/components/cv/cv-workspace-tabs";
import { Button } from "@/components/ui/button";
import { handleCvNextAction, isRoutedCvAction, quickReplyLabel } from "@/lib/cv-next-action";
import { useCvAgent } from "@/hooks/use-cv-agent";
import { useHubActiveAgentSync } from "@/hooks/use-hub-active-agent-sync";
import { CV_BUILDER_AGENT_ID } from "@/lib/cv-agent-config";
import { AGENT_REGISTRY, getAgentLabel } from "@/lib/agents/registry";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSessionDialogOpen, setNewSessionDialogOpen] = useState(false);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
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
    escalationRecoveryTarget,
    continueEscalationRecovery,
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

  useHubActiveAgentSync(locale, CV_BUILDER_AGENT_ID, !needsLogin);

  const showProfileGate = needsProfile === true;
  const showWorkspace =
    !needsLogin && !needsOnboarding && !showProfileGate;
  const showPipelineSteps = showWorkspace && !isReadOnly;
  const canDownloadCv = documentId != null;
  const resumeHasPreview = preview != null;
  const inputDisabled =
    !isSessionReady || isSending || isUploading || isExporting;

  const headerSubtitle = useMemo(
    () => (jobId ? t("subtitleWithJob", { jobId }) : t("subtitle")),
    [jobId, t]
  );

  const escalationRecoveryAgentName = useMemo(() => {
    if (!escalationRecoveryTarget) return null;
    const entry = AGENT_REGISTRY.find(
      (a) => a.agentId === escalationRecoveryTarget
    );
    return entry ? getAgentLabel(entry, locale, "name") : escalationRecoveryTarget;
  }, [escalationRecoveryTarget, locale]);

  useEffect(() => {
    if (canDownloadCv) {
      setMobileTab("resume");
    }
  }, [canDownloadCv]);

  useEffect(() => {
    if (sessionPanelOpen) {
      void refreshSessions();
    }
  }, [sessionPanelOpen, refreshSessions]);

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

  const previewFooter = (
    <>
      {parsedSections && !isReadOnly ? (
        <CvParsedHints
          sections={parsedSections}
          className="px-4 py-3 border-t border-gray-200/80 bg-white"
        />
      ) : null}
      {diff && !isReadOnly ? (
        <CvDiffPanel
          diff={diff}
          onConfirm={() => void confirmCv()}
          onRegenerate={() => void regenerateCv()}
          disabled={isSending || isUploading}
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
    <div className="h-[100dvh] flex flex-col bg-gray-bg overflow-hidden relative">
      <CvHeader
        locale={locale}
        subtitle={headerSubtitle}
        canDownload={canDownloadCv}
        isExporting={isExporting}
        onDownload={() => void exportCvPdf()}
        onNewSession={requestNewSession}
        onOpenHistory={() => setSessionPanelOpen(true)}
        actionsDisabled={isLoading || isSending}
        pipelineState={pipelineState}
        isWorking={isSending}
        showPipeline={showPipelineSteps}
      />

      <AgentSessionPanel
        open={sessionPanelOpen}
        onClose={() => setSessionPanelOpen(false)}
        title={t("sessionsTitle")}
        sessions={sessions}
        activeSessionId={sessionId}
        isLoading={sessionsLoading}
        disabled={isSending || isLoading}
        onSelect={(id) => void selectSession(id)}
        onNew={requestNewSession}
        newLabel={t("newCv")}
        topOffset="var(--cv-header-offset, 0px)"
      />

      <CvWorkspaceTabs
        active={mobileTab}
        onChange={setMobileTab}
        resumeDownloadReady={canDownloadCv}
        resumeHasPreview={resumeHasPreview && !canDownloadCv}
      />

      <div className="flex-1 flex min-h-0 relative">
        <div className="flex-1 flex min-w-0 min-h-0">
          <section
            id={CV_CHAT_PANEL_ID}
            role="tabpanel"
            aria-labelledby="cv-tab-chat"
            className={cn(
              "flex-1 flex flex-col min-w-0 min-h-0 bg-gray-bg",
              mobileTab !== "chat" && "hidden lg:flex"
            )}
          >
            {sessionResumed && !isReadOnly ? (
              <p className="px-4 py-2 text-xs text-kazi-orange bg-orange-50 border-b border-orange-100 text-center">
                {t("sessionResumedBanner")}
              </p>
            ) : null}
            {escalationRecoveryTarget && escalationRecoveryAgentName ? (
              <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-b border-amber-100 text-center flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <span>{t("escalationRecoveryHint")}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                  onClick={continueEscalationRecovery}
                >
                  {t("escalationRecoveryAction", {
                    agentName: escalationRecoveryAgentName,
                  })}
                </Button>
              </div>
            ) : isReadOnly ? (
              <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100 text-center">
                {t("readOnlyBanner")}
              </p>
            ) : null}

            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="max-w-3xl mx-auto w-full px-4 py-4 flex flex-col gap-3 min-h-full">
                {error ? (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                ) : null}
                {isLoading && messages.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-12">
                    {t("sessionLoading")}
                  </p>
                ) : messages.length === 0 ? (
                  <CvAgentWelcome
                    disabled={inputDisabled}
                    onPrompt={(text) => void sendMessage(text)}
                    onUploadClick={() => fileInputRef.current?.click()}
                  />
                ) : null}
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    variant="agent"
                  />
                ))}
              </div>
            </div>

            {!isReadOnly ? (
              <div className="shrink-0 border-t border-gray-200/80 bg-white">
                {routedActions.length > 0 ? (
                  <div className="max-w-3xl mx-auto px-4 pt-2">
                    <ChatNextActions
                      actions={routedActions}
                      locale={locale}
                      onAction={handleCvAction}
                      disabled={inputDisabled}
                    />
                  </div>
                ) : null}
                {pickerActions.length > 0 ? (
                  <QuickReplies
                    options={pickerActions.map((a) =>
                      quickReplyLabel(a, locale)
                    )}
                    disabled={inputDisabled}
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
                    disabled={inputDisabled}
                    onSelect={(text) => void sendMessage(text)}
                  />
                ) : null}
                <div className="max-w-3xl mx-auto">
                  <CvChatInput
                    fileInputRef={fileInputRef}
                    onSend={(text) => void sendMessage(text)}
                    onUpload={(file) => void uploadResume(file)}
                    disabled={inputDisabled}
                    isUploading={isUploading}
                    placeholder={t("inputPlaceholder")}
                  />
                </div>
              </div>
            ) : null}
          </section>

          <CvPreviewPane
            preview={preview}
            isLoading={isLoading && !preview && !canDownloadCv}
            canDownload={canDownloadCv}
            isExporting={isExporting}
            onDownload={() => void exportCvPdf()}
            jobSubtitle={jobId ? headerSubtitle : undefined}
            panelId={CV_RESUME_PANEL_ID}
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
        <div className="h-[100dvh] flex items-center justify-center bg-gray-bg text-gray-500 text-sm">
          {t("sessionLoading")}
        </div>
      }
    >
      <CvPageContent locale={params.locale} />
    </Suspense>
  );
}
