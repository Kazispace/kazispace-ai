"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface ReferralPromptProps {
  agentEmoji: string;
  agentName: string;
  reason: string;
  onAccept: () => void;
  onDismiss: () => void;
  disabled?: boolean;
}

export function ReferralPrompt({
  agentEmoji,
  agentName,
  reason,
  onAccept,
  onDismiss,
  disabled,
}: ReferralPromptProps) {
  const t = useTranslations("referral");

  return (
    <div className="mt-3 pt-3 border-t border-gray-200/80 flex flex-col gap-2">
      {reason && (
        <p className="text-sm text-gray-600 leading-relaxed">{reason}</p>
      )}
      <Button
        type="button"
        className="w-[80%] self-center"
        onClick={onAccept}
        disabled={disabled}
      >
        {agentEmoji} {t("accept", { agentName })}
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        disabled={disabled}
        className="text-sm text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline self-center"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
