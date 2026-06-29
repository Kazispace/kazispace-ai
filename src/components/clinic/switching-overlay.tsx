"use client";

import { useTranslations } from "next-intl";

export function SwitchingOverlay() {
  const t = useTranslations("clinic");

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="text-4xl mb-4 animate-pulse">🔄</div>
      <p className="text-sm font-medium text-kazi-navy">{t("switching")}</p>
    </div>
  );
}
