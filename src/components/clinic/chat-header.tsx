"use client";

import Link from "next/link";
import { Bot, History, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  AgentNavIcon,
  SpaceTemplateNavIcon,
} from "@/components/agents/agent-nav-icon";
import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/constants";
import { useUIStore } from "@/lib/store";
import { closeTelegramWebApp, isTelegramWebApp } from "@/lib/telegram";

interface ChatHeaderProps {
  locale: string;
  mode?: "clinic" | "agent" | "space";
  agentName?: string;
  agentId?: string | null;
  spaceName?: string;
  spaceTemplateId?: string | null;
  isOnline?: boolean;
  onBackToClinic?: () => void;
  onOpenSessionHistory?: () => void;
  onOpenWorkspaceHub?: () => void;
}

export function ChatHeader({
  locale,
  mode = "clinic",
  agentName,
  agentId,
  spaceName,
  spaceTemplateId,
  isOnline = true,
  onBackToClinic,
  onOpenSessionHistory,
  onOpenWorkspaceHub,
}: ChatHeaderProps) {
  const t = useTranslations("chat");
  const tSessions = useTranslations("agentSessions");
  const tNav = useTranslations("nav");
  const tTma = useTranslations("tma");
  const tCv = useTranslations("cv.railHub");
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);

  const headerName =
    mode === "space"
      ? spaceName
      : mode === "agent"
        ? agentName
        : t("title", { name: AGENT_NAME });

  const avatarIcon =
    mode === "agent" && agentId ? (
      <AgentNavIcon
        agentId={agentId}
        className="text-kazi-navy"
        sizeClassName="h-5 w-5"
      />
    ) : mode === "space" ? (
      <SpaceTemplateNavIcon
        templateId={spaceTemplateId}
        className="text-kazi-navy"
        sizeClassName="h-5 w-5"
      />
    ) : (
      <Bot className="h-5 w-5 text-kazi-navy" strokeWidth={2.25} aria-hidden />
    );

  return (
    <header className="bg-kazi-navy px-4 py-3 flex items-center gap-3 shrink-0 border-b border-white/5">
      {mode === "agent" && onBackToClinic ? (
        <button
          type="button"
          onClick={onBackToClinic}
          className="text-sm font-medium text-primary hover:text-white transition-colors shrink-0"
        >
          {t("backToClinic")}
        </button>
      ) : (
        <Link href={`/${locale}/chat`} className="text-white shrink-0">
          <span className="text-lg font-bold">
            {/* Brand wordmark keeps the literal orange (UX guide Header/Hero compromise). */}
            <span className="text-kazi-brand-accent">Kazi</span>Space
          </span>
        </Link>
      )}

      <div className="w-px h-6 bg-white/20 shrink-0" />

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 via-amber-100 to-orange-50 ring-1 ring-white/25">
          {avatarIcon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {headerName}
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isOnline ? "bg-green-500" : "bg-red-500"
              )}
            />
            <span className="text-xs text-white/50">
              {isOnline ? t("status.online") : t("status.offline")}
            </span>
          </div>
        </div>
      </div>

      {mode === "agent" && onOpenSessionHistory ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white/70 hover:text-white shrink-0"
          onClick={onOpenSessionHistory}
          aria-label={tSessions("sessionHistory")}
        >
          <History className="h-4 w-4" />
        </Button>
      ) : null}

      {mode === "clinic" && onOpenWorkspaceHub ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white/70 hover:text-white shrink-0"
          onClick={onOpenWorkspaceHub}
          aria-label={tCv("openWorkspaceRail")}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      ) : null}

      <Link href={`/${locale}/mine`} prefetch={false} className="shrink-0">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
          {tNav("profile")}
        </Button>
      </Link>

      {isTelegramMiniApp && isTelegramWebApp() && mode === "clinic" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-white/70 hover:text-white shrink-0"
          onClick={() => closeTelegramWebApp()}
        >
          {tTma("backToBot")}
        </Button>
      )}
    </header>
  );
}
