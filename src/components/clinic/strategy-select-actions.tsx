"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { resolveActionLabel } from "@/lib/chat-envelope";
import {
  getStrategySelectRationale,
  isStrategySelectRecommended,
  isStrategyStartCta,
} from "@/lib/strategy-select";
import { cn } from "@/lib/utils";
import type { ChatNextAction } from "@/types/chat-envelope";

interface StrategySelectActionsProps {
  actions: ChatNextAction[];
  locale: string;
  onAction: (action: ChatNextAction) => void;
  disabled?: boolean;
  placement?: "inline" | "below";
}

/** Mutually exclusive CV strategy picker (KAZI-400 / BE #309 `merged_turn`). */
export function StrategySelectActions({
  actions,
  locale,
  onAction,
  disabled,
  placement = "inline",
}: StrategySelectActionsProps) {
  const t = useTranslations("chat");
  const startCta = isStrategyStartCta(actions);
  const containerClass =
    placement === "inline"
      ? "mt-3 flex flex-col gap-2 border-t border-gray-200/80 pt-3"
      : "flex flex-col gap-2";

  const renderActionButton = (action: ChatNextAction, index: number) => {
    const isRecommended = isStrategySelectRecommended(action);
    const rationale = getStrategySelectRationale(action);
    const label = resolveActionLabel(action, locale);

    return (
      <Button
        key={`${action.type}-${action.payload ?? index}`}
        type="button"
        variant={isRecommended || startCta ? "default" : "secondary"}
        className={cn(
          "h-auto min-h-10 w-full flex-col items-start justify-start gap-1 whitespace-normal py-2.5 text-left",
          isRecommended && !startCta && "ring-2 ring-kazi-orange/30",
          startCta && "min-h-11"
        )}
        onClick={() => onAction(action)}
        disabled={disabled}
        role={startCta ? undefined : "radio"}
        aria-checked={startCta ? undefined : false}
        aria-label={
          isRecommended
            ? t("strategySelect.recommendedOption", { label })
            : label
        }
      >
        <span className="flex w-full items-start gap-2">
          <span className="min-w-0 flex-1 font-medium leading-snug">{label}</span>
          {isRecommended ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
                startCta || isRecommended
                  ? "bg-white/20 text-primary-foreground"
                  : "bg-kazi-orange/10 text-kazi-orange"
              )}
            >
              {t("strategySelect.recommendedBadge")}
            </span>
          ) : null}
        </span>
        {rationale ? (
          <span
            className={cn(
              "w-full text-xs font-normal leading-snug",
              isRecommended || startCta
                ? "text-primary-foreground/85"
                : "text-muted-foreground"
            )}
          >
            {rationale}
          </span>
        ) : null}
      </Button>
    );
  };

  if (startCta) {
    return (
      <div className={containerClass}>
        {renderActionButton(actions[0]!, 0)}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("strategySelect.groupLabel")}
      className={containerClass}
    >
      {actions.map(renderActionButton)}
    </div>
  );
}
