"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { AgentSessionSummary } from "@/types";

interface CvSessionSidebarProps {
  sessions: AgentSessionSummary[];
  activeSessionId: string | null;
  isLoading?: boolean;
  disabled?: boolean;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  className?: string;
}

function formatSessionTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Coze-style left conversation list. */
export function CvSessionSidebar({
  sessions,
  activeSessionId,
  isLoading,
  disabled,
  onSelect,
  onNew,
  className,
}: CvSessionSidebarProps) {
  const t = useTranslations("cv");

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex flex-col min-h-0 bg-workspace-sidebar border-r border-workspace-border",
        className
      )}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-workspace-border shrink-0">
        <span className="text-sm font-medium text-workspace-text">{t("sessionsTitle")}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onNew}
          title={t("newCv")}
          aria-label={t("newCv")}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-lg",
            "text-workspace-muted hover:text-kazi-orange hover:bg-workspace-active",
            "disabled:opacity-50 transition-colors"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0 space-y-0.5">
        {isLoading && sessions.length === 0 ? (
          <p className="text-xs text-workspace-muted px-2 py-6 text-center">
            {t("sessionsLoading")}
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-workspace-muted px-2 py-6 text-center">
            {t("sessionsEmpty")}
          </p>
        ) : (
          sessions.map((session) => {
            const isActive = session.session_id === activeSessionId;
            return (
              <button
                key={session.session_id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(session.session_id)}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2.5 transition-colors border",
                  isActive
                    ? "bg-workspace-active border-kazi-orange/20 text-workspace-text"
                    : "border-transparent text-workspace-text hover:bg-workspace-hover"
                )}
              >
                <p className="text-sm font-medium truncate leading-snug">{session.title}</p>
                <p className="text-[11px] text-workspace-muted mt-1 flex items-center gap-1">
                  {isActive ? (
                    <span className="text-kazi-orange font-medium">{t("sessionCurrent")}</span>
                  ) : session.status === "active" ? (
                    t("sessionActive")
                  ) : (
                    t("sessionEnded")
                  )}
                  {session.updated_at ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{formatSessionTime(session.updated_at)}</span>
                    </>
                  ) : null}
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
