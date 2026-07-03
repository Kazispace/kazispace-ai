"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
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
        "w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-[calc(100vh-4rem)]",
        className
      )}
    >
      <div className="p-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-kazi-navy">{t("sessionsTitle")}</h2>
        <Button size="sm" variant="outline" disabled={disabled} onClick={onNew}>
          {t("newCv")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && sessions.length === 0 ? (
          <p className="text-xs text-gray-500 px-2 py-4 text-center">{t("sessionsLoading")}</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-500 px-2 py-4 text-center">{t("sessionsEmpty")}</p>
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
                  "w-full text-left rounded-lg px-3 py-2 transition-colors",
                  isActive
                    ? "bg-orange-50 border border-orange-200"
                    : "hover:bg-gray-50 border border-transparent"
                )}
              >
                <p className="text-sm font-medium text-kazi-navy truncate">{session.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <span>
                    {session.status === "active"
                      ? t("sessionActive")
                      : t("sessionEnded")}
                  </span>
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
