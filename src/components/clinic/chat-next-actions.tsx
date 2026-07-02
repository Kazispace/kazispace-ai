"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { resolveActionLabel } from "@/lib/chat-envelope";
import type { ChatNextAction } from "@/types/chat-envelope";

interface ChatNextActionsProps {
  actions: ChatNextAction[];
  locale: string;
  onAction: (action: ChatNextAction) => void;
  disabled?: boolean;
}

const KNOWN_ACTION_TYPES = [
  'open_list',
  'view_job_recommendations',
  'upgrade_pro',
  'return_to_clinic',
  'mock_interview',
  'complete_profile',
  'job_search',
] as const;

type KnownActionType = (typeof KNOWN_ACTION_TYPES)[number];

export function ChatNextActions({
  actions,
  locale,
  onAction,
  disabled,
}: ChatNextActionsProps) {
  const t = useTranslations("chat");

  if (actions.length === 0) return null;

  const labelFor = (action: ChatNextAction) =>
    resolveActionLabel(action, locale, (type) => {
      if ((KNOWN_ACTION_TYPES as readonly string[]).includes(type)) {
        return t(`actions.${type as KnownActionType}`);
      }
      return undefined;
    });

  return (
    <div className="mt-3 pt-3 border-t border-gray-200/80 flex flex-col gap-2">
      {actions.map((action, index) => (
        <Button
          key={`${action.type}-${index}`}
          type="button"
          variant={index === 0 ? "default" : "secondary"}
          className="w-full"
          onClick={() => onAction(action)}
          disabled={disabled}
        >
          {labelFor(action)}
        </Button>
      ))}
    </div>
  );
}
