"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { patchMe } from "@/lib/api-client";
import {
  LOCALE_LABELS,
  setManualLocaleOverride,
  switchLocalePath,
} from "@/lib/locale";
import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from "@/lib/constants";
import { useAuthStore, useUIStore } from "@/lib/store";
import { setUserInfo } from "@/lib/auth";
import { ChevronDown } from "lucide-react";

interface LocaleSwitcherProps {
  locale: string;
  variant?: "row" | "compact" | "header";
}

export function LocaleSwitcher({ locale, variant = "row" }: LocaleSwitcherProps) {
  const t = useTranslations("mine");
  const router = useRouter();
  const pathname = usePathname();
  const showToast = useUIStore((s) => s.showToast);
  const { isLoggedIn, updateUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const current = isSupportedLocale(locale) ? locale : "ru";

  const handleSelect = async (next: SupportedLocale) => {
    if (next === current) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    setManualLocaleOverride(next);

    let syncFailed = false;
    if (isLoggedIn) {
      const res = await patchMe({ primary_locale: next });
      if (res.success && res.data) {
        updateUser(res.data);
        setUserInfo(res.data);
      } else {
        syncFailed = true;
      }
    }

    setIsSaving(false);
    setIsOpen(false);
    if (syncFailed) {
      showToast(t("langChangeFailedToast"), "error");
    } else {
      showToast(t("langChangedToast", { lang: LOCALE_LABELS[next] }), "info");
    }
    router.push(switchLocalePath(pathname, next));
  };

  if (variant === "header") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          disabled={isSaving}
          className="flex items-center gap-1 text-sm text-white/80 hover:text-primary transition-colors"
        >
          {LOCALE_LABELS[current]}
          <ChevronDown className="w-4 h-4" />
        </button>
        {isOpen && (
          <LocaleMenu current={current} onSelect={(l) => void handleSelect(l)} onClose={() => setIsOpen(false)} />
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          disabled={isSaving}
          className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          {LOCALE_LABELS[current]}
          <ChevronDown className="w-4 h-4" />
        </button>
        {isOpen && (
          <LocaleMenu current={current} onSelect={(l) => void handleSelect(l)} onClose={() => setIsOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isSaving}
        className="w-full flex items-center justify-between p-0"
      >
        <span className="text-sm text-muted">{LOCALE_LABELS[current]}</span>
        <ChevronDown className="w-4 h-4 text-muted" />
      </button>
      {isOpen && (
        <LocaleMenu current={current} onSelect={(l) => void handleSelect(l)} onClose={() => setIsOpen(false)} />
      )}
    </div>
  );
}

function LocaleMenu({
  current,
  onSelect,
  onClose,
}: {
  current: SupportedLocale;
  onSelect: (locale: SupportedLocale) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-md border bg-white shadow-lg py-1">
        {SUPPORTED_LOCALES.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => onSelect(loc)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
              loc === current ? "font-semibold text-primary" : "text-gray-700"
            }`}
          >
            {LOCALE_LABELS[loc]}
          </button>
        ))}
      </div>
    </>
  );
}
