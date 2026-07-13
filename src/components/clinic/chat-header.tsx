"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AGENT_NAME } from "@/lib/constants";
import { useUIStore } from "@/lib/store";
import { closeTelegramWebApp } from "@/lib/telegram";

interface ChatHeaderProps {
  locale: string;
  mode?: "clinic" | "agent" | "space";
  agentName?: string;
  agentEmoji?: string;
  spaceName?: string;
  spaceEmoji?: string;
  isOnline?: boolean;
  onBackToClinic?: () => void;
  onOpenSessionHistory?: () => void;
}

export function ChatHeader({
  locale,
  mode = "clinic",
  agentName,
  agentEmoji,
  spaceName,
  spaceEmoji,
  isOnline = true,
  onBackToClinic,
  onOpenSessionHistory,
}: ChatHeaderProps) {
  const t = useTranslations("chat");
  const tSessions = useTranslations("agentSessions");
  const tNav = useTranslations("nav");
  const tTma = useTranslations("tma");
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);

  const headerEmoji =
    mode === "space" ? spaceEmoji : mode === "agent" ? agentEmoji : null;
  const headerName =
    mode === "space"
      ? spaceName
      : mode === "agent"
        ? agentName
        : t("title", { name: AGENT_NAME });

  return (
    <header className="bg-kazi-navy px-4 py-3 flex items-center gap-3 shrink-0 border-b border-white/5">
      {mode === "agent" && onBackToClinic ? (
        <button
          type="button"
          onClick={onBackToClinic}
          className="text-sm font-medium text-kazi-orange hover:text-white transition-colors shrink-0"
        >
          {t("backToClinic")}
        </button>
      ) : (
        <Link href={`/${locale}/chat`} className="text-white shrink-0">
          <span className="text-lg font-bold">
            <span className="text-kazi-orange">Kazi</span>Space
          </span>
        </Link>
      )}

      <div className="w-px h-6 bg-white/20 shrink-0" />

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-kazi-orange to-amber-500 flex items-center justify-center text-lg shrink-0">
          {headerEmoji ?? "🤖"}
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

      <Link href={`/${locale}/mine`} className="shrink-0">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
          {tNav("profile")}
        </Button>
      </Link>

      {isTelegramMiniApp && mode === "clinic" && (
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
