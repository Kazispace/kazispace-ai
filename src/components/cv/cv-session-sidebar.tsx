"use client";

import { Plus } from "lucide-react";
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
        "w-[260px] shrink-0 flex flex-col min-h-0 bg-white border-r border-gray-200/80",
        className
      )}
    >
      <div className="px-4 py-4 flex items-center justify-between gap-2 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-kazi-navy">{t("sessionsTitle")}</h2>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-gray-500 hover:text-kazi-orange"
          disabled={disabled}
          onClick={onNew}
          aria-label={t("newCv")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {isLoading && sessions.length === 0 ? (
          <p className="text-xs text-gray-500 px-3 py-8 text-center">{t("sessionsLoading")}</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-500 px-3 py-8 text-center">{t("sessionsEmpty")}</p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = session.session_id === activeSessionId;
              return (
                <li key={session.session_id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(session.session_id)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                      isActive
                        ? "bg-orange-50 text-kazi-navy"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {isActive
                        ? t("sessionCurrent")
                        : session.status === "active"
                          ? t("sessionActive")
                          : t("sessionEnded")}
                      {session.updated_at ? ` · ${formatSessionTime(session.updated_at)}` : ""}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
