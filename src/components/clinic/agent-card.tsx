"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentRegistryEntry } from "@/lib/agents/registry";
import { getAgentLabel } from "@/lib/agents/registry";
import { Lock } from "lucide-react";

interface AgentCardProps {
  agent: AgentRegistryEntry;
  locale: string;
  locked?: boolean;
  onSelect?: (agentId: string) => void;
}

export function AgentCard({ agent, locale, locked, onSelect }: AgentCardProps) {
  const t = useTranslations("clinic");
  const isSoon = agent.status === "coming_soon";
  const disabled = isSoon || locked;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onSelect?.(agent.agentId)}
      className={cn(
        "text-left rounded-xl border border-gray-200 bg-gray-50 p-4 min-h-[180px] flex flex-col",
        "transition-all duration-200",
        !disabled && "hover:-translate-y-0.5 hover:shadow-md hover:border-kazi-orange/40",
        disabled && "opacity-50 cursor-not-allowed",
        locked && !isSoon && "opacity-70"
      )}
    >
      <div className="text-3xl mb-2">{agent.emoji}</div>
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
