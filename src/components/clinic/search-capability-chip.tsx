"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  playbookChipTitle,
  type SearchCapabilityId,
} from "@/lib/clinic/search-capability";

interface SearchCapabilityChipProps {
  capabilityId: SearchCapabilityId;
  /** Debug/tooltip only — not shown as primary label. */
  playbookId?: string | null;
  className?: string;
}

/** Light capability chip under Clinic bubbles (KAZI-234). */
export function SearchCapabilityChip({
  capabilityId,
  playbookId,
  className,
}: SearchCapabilityChipProps) {
  const t = useTranslations("chat.capability");
  const label =
    capabilityId === "web_search" ? t("web_search") : t("research");
  const title = playbookChipTitle(playbookId, {
    bound: (id) => t("playbookHint", { id }),
    unbound: t("playbookUnbound"),
  });

  return (
    <span
      title={title}
      className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full self-start",
        capabilityId === "web_search"
          ? "bg-sky-50 text-sky-700 border border-sky-200/80"
          : "bg-amber-50 text-amber-800 border border-amber-200/80",
        className
      )}
    >
      {label}
    </span>
  );
}
