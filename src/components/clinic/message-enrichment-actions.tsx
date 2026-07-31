"use client";

import { ChatNextActions } from "@/components/clinic/chat-next-actions";
import { StrategySelectActions } from "@/components/clinic/strategy-select-actions";
import { partitionNextActions } from "@/lib/strategy-select";
import { cn } from "@/lib/utils";
import type { ChatNextAction } from "@/types/chat-envelope";

interface MessageEnrichmentActionsProps {
  actions?: ChatNextAction[];
  locale: string;
  onAction?: (action: ChatNextAction) => void;
  disabled?: boolean;
  /** `inline` = inside assistant bubble; `below` = stacked under bubble (Hub). */
  placement?: "inline" | "below";
  className?: string;
}

/** Shared strategy_select + generic CTA split (KAZI-400 review P2-3). */
export function MessageEnrichmentActions({
  actions,
  locale,
  onAction,
  disabled,
  placement = "inline",
  className,
}: MessageEnrichmentActionsProps) {
  const { strategyActions, genericActions } = partitionNextActions(actions);
  const showStrategy = strategyActions.length > 0 && onAction;
  const showGeneric = genericActions.length > 0 && onAction;

  if (!showStrategy && !showGeneric) return null;

  const strategyBlock = showStrategy ? (
    <StrategySelectActions
      actions={strategyActions}
      locale={locale}
      onAction={onAction}
      disabled={disabled}
      placement={placement}
    />
  ) : null;

  const genericBlock = showGeneric ? (
    <ChatNextActions
      actions={genericActions}
      locale={locale}
      onAction={onAction}
      disabled={disabled}
      className={placement === "below" && showStrategy ? "mt-0 border-t-0 pt-0" : undefined}
    />
  ) : null;

  if (placement === "below") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {strategyBlock}
        {genericBlock}
      </div>
    );
  }

  return (
    <>
      {strategyBlock}
      {genericBlock}
    </>
  );
}
