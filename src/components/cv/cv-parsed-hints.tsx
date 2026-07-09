"use client";

import { useTranslations } from "next-intl";

interface CvParsedHintsProps {
  sections: Record<string, string>;
  className?: string;
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

export function CvParsedHints({ sections, className }: CvParsedHintsProps) {
  const t = useTranslations("cv");
  const entries = Object.entries(sections);

  if (entries.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-kazi-navy mb-2">{t("parsedHintsTitle")}</p>
      <dl className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="text-xs">
            <dt className="text-gray-500">{sectionLabel(key, t)}</dt>
            <dd className="text-gray-800 mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
