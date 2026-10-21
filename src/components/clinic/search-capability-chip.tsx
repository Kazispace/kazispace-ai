"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { playbookChipTitle } from "@/lib/clinic/search-capability";

interface SearchCapabilityChipProps {
  /** Debug/tooltip only — not shown as primary label. */
  playbookId?: string | null;
  className?: string;
}

/** Light capability chip under Clinic bubbles (KAZI-234; one label since KAZI-1137). */
export function SearchCapabilityChip({
  playbookId,
  className,
}: SearchCapabilityChipProps) {
  const t = useTranslations("chat.capability");
  // KAZI-1137: one search class, one label. The bubble still uses the
  // capability id to lay out a short answer or a report; the user sees no depth.
  const label = t("search");
  const title = playbookChipTitle(playbookId, {
    bound: (id) => t("playbookHint", { id }),
    unbound: t("playbookUnbound"),
  });

  return (
    <span
      title={title}
      className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full self-start",
        "bg-sky-50 text-sky-700 border border-sky-200/80",
        className
      )}
    >
      {label}
    </span>
  );
}
