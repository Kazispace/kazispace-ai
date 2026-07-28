"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentRegistryEntry } from "@/lib/agents/registry";
import { getAgentLabel } from "@/lib/agents/registry";
import {
  formatSessionNavBadgeLabel,
  sessionNavBadgePillClass,
} from "@/lib/session-nav-badges";
import type { SessionNavBadgeKind } from "@/lib/session-nav";
import { Lock } from "lucide-react";
import { AgentNavIcon } from "@/components/agents/agent-nav-icon";

interface AgentCardProps {
  agent: AgentRegistryEntry;
  locale: string;
  locked?: boolean;
  isActive?: boolean;
  badge?: SessionNavBadgeKind;
  badgeDetail?: string | null;
  onSelect?: (agentId: string) => void;
}

export function AgentCard({
  agent,
  locale,
  locked,
  isActive,
  badge,
  badgeDetail,
  onSelect,
}: AgentCardProps) {
  const t = useTranslations("clinic");
  const tNav = useTranslations("sessionNav");
  const isSoon = agent.status === "coming_soon";
  const isClinicInline = badge === "clinicInline";
  const isDisabled = isSoon || isClinicInline;
  const badgeLabel =
    badge != null
      ? formatSessionNavBadgeLabel(badge, badgeDetail, (key) => tNav(key))
      : null;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onSelect?.(agent.agentId)}
      className={cn(
        "text-left rounded-xl border bg-gray-50 p-4 min-h-[180px] flex flex-col",
        "transition-all duration-200",
        isActive
          ? "border-kazi-orange/60 ring-1 ring-kazi-orange/20"
          : "border-gray-200",
        !isDisabled && "hover:-translate-y-0.5 hover:shadow-md hover:border-kazi-orange/40",
        isDisabled && "opacity-80 cursor-not-allowed",
        locked && !isDisabled && "opacity-90"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200/80">
          <AgentNavIcon agentId={agent.agentId} sizeClassName="h-6 w-6" />
        </div>
        {badgeLabel ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium max-w-[55%] truncate",
              sessionNavBadgePillClass(badge!)
            )}
          >
            {badgeLabel}
          </span>
        ) : null}
      </div>
      <div className="font-semibold text-base text-kazi-navy mb-1">
        {getAgentLabel(agent, locale, "name")}
      </div>
      <p className="text-sm text-muted-foreground flex-1 leading-snug">
        {getAgentLabel(agent, locale, "description")}
      </p>
      <div className="mt-3">
        {isSoon ? (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("comingSoon")}
          </span>
        ) : isClinicInline ? (
          <span className="text-xs text-muted-foreground">{badgeLabel}</span>
        ) : locked ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-kazi-navy">
            <Lock className="w-3.5 h-3.5" />
            {t("loginToContinue")}
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full pointer-events-none"
            tabIndex={-1}
          >
            {t("openAgent")} →
          </Button>
        )}
      </div>
    </button>
  );
}
