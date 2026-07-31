"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { resolveActionLabel } from "@/lib/chat-envelope";
import { strategyIdFromPayload } from "@/lib/strategy-select";
import { cn } from "@/lib/utils";
import type { ChatNextAction } from "@/types/chat-envelope";

interface StrategySelectActionsProps {
  actions: ChatNextAction[];
  locale: string;
  recommendedStrategyId?: string;
  onAction: (action: ChatNextAction) => void;
  disabled?: boolean;
}

/** Mutually exclusive CV strategy picker (KAZI-400 §6.1 / KAZI-396). */
export function StrategySelectActions({
  actions,
  locale,
  recommendedStrategyId,
  onAction,
  disabled,
}: StrategySelectActionsProps) {
  const t = useTranslations("chat");

  return (
    <div
      role="radiogroup"
      aria-label={t("strategySelect.groupLabel")}
      className="mt-3 flex flex-col gap-2 border-t border-gray-200/80 pt-3"
    >
      {actions.map((action, index) => {
        const payloadId = action.payload
          ? strategyIdFromPayload(action.payload)
          : null;
        const isRecommended =
          Boolean(recommendedStrategyId) && payloadId === recommendedStrategyId;

        return (
          <Button
            key={`${action.type}-${action.payload ?? index}`}
            type="button"
            variant={isRecommended ? "default" : "secondary"}
            className={cn(
              "h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left",
              isRecommended && "ring-2 ring-kazi-orange/30"
            )}
            onClick={() => onAction(action)}
            disabled={disabled}
            role="radio"
            aria-checked={false}
          >
            {resolveActionLabel(action, locale)}
          </Button>
        );
      })}
    </div>
  );
}
