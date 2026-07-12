"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getEnglishLevel, setEnglishLevel } from "@/lib/auth";
import { AGENT_REGISTRY } from "@/lib/agents/registry";
import { AgentCard } from "./agent-card";
import { AGENT_NAME } from "@/lib/constants";
import { NbaActionCard } from "@/components/nba/nba-action-card";
import { NbaActionCardSkeleton } from "@/components/nba/nba-action-card-skeleton";
import { resolveRegistryAgentBadge } from "@/lib/session-nav";
import type { CurrentSessionsByAgent } from "@/lib/current-agent-sessions";
import type { NextBestActionItem } from "@/types";

const ENGLISH_LEVELS = [
  { value: 'basic', key: 'basic' as const },
  { value: 'intermediate', key: 'intermediate' as const },
  { value: 'fluent', key: 'fluent' as const },
];

interface WelcomeViewProps {
  locale: string;
  isLoggedIn: boolean;
  selectedLevel: string | null;
  onLevelChange: (level: string) => void;
  onAgentSelect: (agentId: string) => void;
  onQuickPrompt: (text: string) => void;
  nbaAction?: NextBestActionItem | null;
  nbaLoading?: boolean;
  sessionsByAgent?: CurrentSessionsByAgent;
}

export function WelcomeView({
  locale,
  isLoggedIn,
  selectedLevel,
  onLevelChange,
  onAgentSelect,
  onQuickPrompt,
  nbaAction,
  nbaLoading,
  sessionsByAgent,
}: WelcomeViewProps) {
  const t = useTranslations("chat");
  const tClinic = useTranslations("clinic");

  const quickPrompts = [
    { label: tClinic("prompts.cv"), text: tClinic("prompts.cvText") },
    { label: tClinic("prompts.jobs"), text: tClinic("prompts.jobsText") },
    { label: tClinic("prompts.interview"), text: tClinic("prompts.interviewText") },
  ];

  return (
    <div className="flex flex-col items-center w-full max-w-3xl mx-auto py-6 px-2">
      <div className="w-full rounded-2xl bg-clinic-bubble border border-gray-200/80 px-5 py-4 mb-6 text-left">
        <p className="text-[15px] leading-relaxed text-gray-800">
          {t("welcome.greeting", { name: AGENT_NAME })}
        </p>
        <p className="text-sm text-muted-foreground mt-2">{t("welcome.prompt")}</p>
      </div>

      {isLoggedIn && nbaLoading ? (
        <NbaActionCardSkeleton className="w-full mb-6" />
      ) : isLoggedIn && nbaAction ? (
        <NbaActionCard
          locale={locale}
          action={nbaAction}
          className="w-full mb-6"
        />
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full mb-6">
        {AGENT_REGISTRY.map((agent) => {
          const session = sessionsByAgent?.get(agent.agentId);
          const resolved = resolveRegistryAgentBadge(agent, session);
          return (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              locale={locale}
              locked={!isLoggedIn && agent.status === "available"}
              badge={resolved?.kind}
              badgeDetail={resolved?.detail}
              onSelect={onAgentSelect}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 justify-center w-full mb-6">
        {quickPrompts.map((p) => (
          <button
            key={p.text}
            type="button"
            onClick={() => onQuickPrompt(p.text)}
            className="bg-white border border-gray-200 text-sm px-4 py-2 rounded-full hover:border-kazi-orange hover:text-kazi-orange transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <span className="text-xs text-muted-foreground w-full text-center mb-1">
          {tClinic("englishLevelLabel")}
        </span>
        {ENGLISH_LEVELS.map(({ value, key }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setEnglishLevel(value);
              onLevelChange(value);
            }}
            className={cn(
              "text-sm px-4 py-1.5 rounded-full border transition-colors",
              (selectedLevel ?? getEnglishLevel()) === value
                ? "bg-kazi-orange text-white border-kazi-orange"
                : "border-gray-200 text-gray-600 hover:border-kazi-orange"
            )}
          >
            {tClinic(`englishLevel.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
