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
  onAction?: (action: ChatNextAction) => void;
  disabled?: boolean;
  /** Read-only history row — show options with the user's prior selection. */
  readOnly?: boolean;
  selectedPayload?: string | null;
  placement?: "inline" | "below";
}

function RecommendedBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded border border-primary/30 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary">
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
  readOnly = false,
  selectedPayload,
  placement = "inline",
}: StrategySelectActionsProps) {
  const t = useTranslations("chat");
  const isInteractive = !readOnly && Boolean(onAction);
  const handleSelect = (action: ChatNextAction) => {
    if (isInteractive && onAction) onAction(action);
  };

  if (actions.length === 0) return null;

  const wrapperClass = cn(
    placement === "inline" && "mt-3 border-t border-gray-200/80 pt-3"
  );

  // Sample B — skip_confirm: single Start CTA (not a lone radio in a list).
  if (isStrategyStartCta(actions)) {
    const action = actions[0]!;
    const label = resolveActionLabel(action, locale);
    const rationale = getStrategySelectRationale(action);
    const isSelected =
      readOnly &&
      Boolean(
        selectedPayload &&
          action.payload?.trim() === selectedPayload.trim()
      );

    return (
      <div className={wrapperClass}>
        <Button
          type="button"
          variant={isSelected ? "outline" : "default"}
          disabled={readOnly || disabled}
          onClick={isInteractive ? () => handleSelect(action) : undefined}
          className={cn(
            "h-auto min-h-11 w-full flex-col items-start justify-start gap-1 whitespace-normal py-2.5 text-left",
            isSelected &&
              "border-primary bg-blue-50 text-gray-900 hover:bg-blue-50"
          )}
          aria-label={label}
          aria-pressed={isSelected || undefined}
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
          const actionPayload = action.payload?.trim() ?? "";
          const isSelected =
            readOnly &&
            Boolean(selectedPayload && actionPayload === selectedPayload.trim());

          return (
            <button
              key={`${action.type}-${action.payload ?? index}`}
              type="button"
              disabled={readOnly || disabled}
              onClick={isInteractive ? () => handleSelect(action) : undefined}
              aria-label={optionLabel}
              aria-pressed={readOnly ? isSelected : undefined}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-3 text-left",
                readOnly
                  ? "cursor-default bg-transparent"
                  : "bg-transparent transition-colors hover:bg-gray-50",
                isSelected && "bg-blue-50/70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                "disabled:cursor-not-allowed disabled:opacity-50",
                !isLast && "border-b border-gray-200"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-gray-900"
                )}
                aria-hidden
              >
                {isSelected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                ) : null}
              </span>
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
