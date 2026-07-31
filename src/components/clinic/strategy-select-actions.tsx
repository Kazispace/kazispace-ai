"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { resolveActionLabel } from "@/lib/chat-envelope";
import {
  getStrategySelectRationale,
  isStrategySelectRecommended,
} from "@/lib/strategy-select";
import { cn } from "@/lib/utils";
import type { ChatNextAction } from "@/types/chat-envelope";

interface StrategySelectActionsProps {
  actions: ChatNextAction[];
  locale: string;
  onAction: (action: ChatNextAction) => void;
  disabled?: boolean;
}

/** Mutually exclusive CV strategy picker (KAZI-400 / BE #309 `merged_turn`). */
export function StrategySelectActions({
  actions,
  locale,
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
        const isRecommended = isStrategySelectRecommended(action);
        const rationale = getStrategySelectRationale(action);

        return (
          <Button
            key={`${action.type}-${action.payload ?? index}`}
            type="button"
            variant={isRecommended ? "default" : "secondary"}
            className={cn(
              "h-auto min-h-10 w-full flex-col items-start justify-start gap-0.5 whitespace-normal py-2.5 text-left",
              isRecommended && "ring-2 ring-kazi-orange/30"
            )}
            onClick={() => onAction(action)}
            disabled={disabled}
            role="radio"
            aria-checked={false}
          >
            <span className="font-medium leading-snug">
              {resolveActionLabel(action, locale)}
            </span>
            {rationale ? (
              <span
                className={cn(
                  "text-xs font-normal leading-snug",
                  isRecommended ? "text-primary-foreground/85" : "text-muted-foreground"
                )}
              >
                {rationale}
              </span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
