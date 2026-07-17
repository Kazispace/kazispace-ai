"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { UpgradeCtaPayload } from "@/lib/clinic/upgrade-cta";

interface UpgradeResearchCtaProps {
  cta: UpgradeCtaPayload;
  onUpgrade: () => void;
  disabled?: boolean;
}

/** Same-thread handoff CTA: web_search → research (KAZI-233). */
export function UpgradeResearchCta({
  cta,
  onUpgrade,
  disabled,
}: UpgradeResearchCtaProps) {
  const t = useTranslations("chat.upgradeResearch");
  const label = cta.label.trim() || t("cta");

  return (
    <div className="mt-3 pt-3 border-t border-gray-200/80 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground px-0.5">{t("hint")}</p>
      <Button
        type="button"
        variant="default"
        className="w-full"
        onClick={onUpgrade}
        disabled={disabled}
      >
        {label}
      </Button>
    </div>
  );
}
