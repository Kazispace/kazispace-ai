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

function RecommendedBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded border border-kazi-orange/30 bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-kazi-orange">
      {label}
    </span>
  );
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

  const wrapperClass = cn(
    placement === "inline" && "mt-3 border-t border-gray-200/80 pt-3"
  );

  // Sample B — skip_confirm: single Start CTA (not a lone radio in a list).
  if (isStrategyStartCta(actions)) {
    const action = actions[0]!;
    const label = resolveActionLabel(action, locale);
    const rationale = getStrategySelectRationale(action);

    return (
      <div className={wrapperClass}>
        <Button
          type="button"
          variant="default"
          disabled={disabled}
          onClick={() => onAction(action)}
          className="h-auto min-h-11 w-full flex-col items-start justify-start gap-1 whitespace-normal py-2.5 text-left"
          aria-label={label}
        >
          <span className="font-medium leading-snug">{label}</span>
          {rationale ? (
            <span className="text-xs font-normal leading-snug text-primary-foreground/85">
              {rationale}
            </span>
          ) : null}
        </Button>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div
        role="group"
        aria-label={t("strategySelect.groupLabel")}
        className="overflow-hidden rounded-md border border-black"
      >
        {actions.map((action, index) => {
          const isRecommended = isStrategySelectRecommended(action);
          const rationale = getStrategySelectRationale(action);
          const label = resolveActionLabel(action, locale);
          const isLast = index === actions.length - 1;
          const optionLabel = isRecommended
            ? t("strategySelect.recommendedOption", { label })
            : label;

          return (
            <button
              key={`${action.type}-${action.payload ?? index}`}
              type="button"
              disabled={disabled}
              onClick={() => onAction(action)}
              aria-label={optionLabel}
              className={cn(
                "flex w-full items-start gap-3 bg-transparent px-3 py-3 text-left",
                "transition-colors hover:bg-gray-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kazi-orange/40",
                "disabled:cursor-not-allowed disabled:opacity-50",
                !isLast && "border-b border-gray-200"
              )}
            >
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-gray-900"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15px] font-medium leading-snug text-gray-900">
                    {label}
                  </span>
                  {isRecommended ? (
                    <RecommendedBadge label={t("strategySelect.recommendedBadge")} />
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
