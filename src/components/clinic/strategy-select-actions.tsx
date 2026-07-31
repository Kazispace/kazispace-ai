"use client";

import { useTranslations } from "next-intl";

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

  if (actions.length === 0) return null;

  return (
    <div
      className={cn(
        placement === "inline" && "mt-3 border-t border-gray-200/80 pt-3"
      )}
    >
      <div
        role="radiogroup"
        aria-label={t("strategySelect.groupLabel")}
        className="overflow-hidden rounded-md border border-black"
      >
        {actions.map((action, index) => {
          const isRecommended = isStrategySelectRecommended(action);
          const rationale = getStrategySelectRationale(action);
          const label = resolveActionLabel(action, locale);
          const isLast = index === actions.length - 1;

          return (
            <button
              key={`${action.type}-${action.payload ?? index}`}
              type="button"
              role="radio"
              aria-checked={false}
              aria-label={
                isRecommended
                  ? t("strategySelect.recommendedOption", { label })
                  : label
              }
              disabled={disabled}
              onClick={() => onAction(action)}
              className={cn(
                "flex w-full items-start gap-3 bg-transparent px-3 py-3 text-left",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kazi-orange/40",
                "disabled:cursor-not-allowed disabled:opacity-50",
                !isLast && "border-b border-gray-200"
              )}
            >
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-gray-900"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[15px] font-medium leading-snug text-gray-900">
                    {label}
                  </span>
                  {isRecommended ? (
                    <span className="text-xs font-medium text-gray-600">
                      {t("strategySelect.recommendedBadge")}
                    </span>
                  ) : null}
                </span>
                {rationale ? (
                  <span className="mt-1 block text-sm leading-snug text-gray-600">
                    {rationale}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
