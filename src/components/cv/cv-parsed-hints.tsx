"use client";

import { useTranslations } from "next-intl";

interface CvParsedHintsProps {
  sections: Record<string, string>;
  className?: string;
  theme?: "default" | "workspace";
}

function formatSectionKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sectionLabel(key: string, t: ReturnType<typeof useTranslations<"cv">>): string {
  const i18nKey = `parsedSectionKeys.${key}` as const;
  if (t.has(i18nKey)) return t(i18nKey);
  return formatSectionKey(key);
}

export function CvParsedHints({ sections, className, theme = "default" }: CvParsedHintsProps) {
  const t = useTranslations("cv");
  const entries = Object.entries(sections);
  const isWorkspace = theme === "workspace";

  if (entries.length === 0) return null;

  return (
    <div className={className}>
      <p
        className={
          isWorkspace
            ? "text-[11px] font-semibold text-workspace-muted mb-2 uppercase tracking-wide"
            : "text-xs font-semibold text-kazi-navy mb-2"
        }
      >
        {t("parsedHintsTitle")}
      </p>
      <dl className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="text-xs">
            <dt className={isWorkspace ? "text-workspace-muted" : "text-gray-500"}>
              {sectionLabel(key, t)}
            </dt>
            <dd className={isWorkspace ? "text-workspace-text mt-0.5" : "text-gray-800 mt-0.5"}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
