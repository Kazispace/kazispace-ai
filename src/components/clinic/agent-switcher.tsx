"use client";

import { useTranslations } from "next-intl";
import { AGENT_REGISTRY } from "@/lib/agents/registry";
import { resolveRegistryAgentBadge } from "@/lib/session-nav";
import type { CurrentSessionsByAgent } from "@/hooks/use-active-agent-sessions";
import { AgentCard } from "./agent-card";
import { cn } from "@/lib/utils";

interface AgentSwitcherProps {
  locale: string;
  isLoggedIn: boolean;
  open: boolean;
  activeAgentId: string | null;
  sessionsByAgent?: CurrentSessionsByAgent;
  onClose: () => void;
  onSelect: (agentId: string) => void;
}

export function AgentSwitcher({
  locale,
  isLoggedIn,
  open,
  activeAgentId,
  sessionsByAgent,
  onClose,
  onSelect,
}: AgentSwitcherProps) {
  const t = useTranslations("clinic");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("closeSwitcher")}
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-50 w-full max-w-md max-h-[70vh] overflow-y-auto",
          "bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 pb-6"
        )}
      >
        <h3 className="text-base font-semibold text-kazi-navy mb-3">{t("switchExpert")}</h3>
        <div className="grid grid-cols-1 gap-3">
          {AGENT_REGISTRY.map((agent) => {
            const session = sessionsByAgent?.get(agent.agentId);
            const resolved = resolveRegistryAgentBadge(agent, session);
            return (
              <AgentCard
                key={agent.agentId}
                agent={agent}
                locale={locale}
                locked={!isLoggedIn && agent.status === "available"}
                isActive={activeAgentId === agent.agentId}
                badge={resolved?.kind}
                badgeDetail={resolved?.detail}
                onSelect={(id) => {
                  onClose();
                  onSelect(id);
                }}
              />
            );
          })}
        </div>
        {activeAgentId && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {t("switchHint")}
          </p>
        )}
      </div>
    </div>
  );
}
