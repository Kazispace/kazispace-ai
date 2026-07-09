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
        "w-56 shrink-0 flex flex-col min-h-0",
        "bg-workspace-sidebar border-r border-workspace-border",
        className
      )}
    >
      <div className="h-9 px-3 flex items-center justify-between gap-2 border-b border-workspace-border shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-workspace-muted">
          {t("sessionsTitle")}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onNew}
          title={t("newCv")}
          aria-label={t("newCv")}
          className={cn(
            "h-6 w-6 flex items-center justify-center rounded",
            "text-workspace-muted hover:text-workspace-text hover:bg-workspace-hover",
            "disabled:opacity-50 transition-colors"
          )}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {isLoading && sessions.length === 0 ? (
          <p className="text-[11px] text-workspace-muted px-3 py-4 text-center">
            {t("sessionsLoading")}
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-[11px] text-workspace-muted px-3 py-4 text-center">
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
                  "w-full text-left px-2 py-1.5 mx-1 rounded-sm transition-colors",
                  "max-w-[calc(100%-8px)]",
                  isActive
                    ? "bg-workspace-active text-workspace-text"
                    : "text-workspace-muted hover:bg-workspace-hover hover:text-workspace-text"
                )}
              >
                <p className="text-[13px] truncate leading-tight">{session.title}</p>
                <p className="text-[10px] mt-0.5 opacity-70 flex items-center gap-1">
                  {isActive ? t("sessionCurrent") : session.status === "active" ? t("sessionActive") : t("sessionEnded")}
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
