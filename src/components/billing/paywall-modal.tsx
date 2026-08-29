"use client";

import { useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/store";
import { useDialogFocusTrap } from "@/hooks/use-dialog-focus-trap";

interface PaywallModalProps {
  locale: string;
}

export function PaywallModal({ locale }: PaywallModalProps) {
  const t = useTranslations("paywall");
  const { paywallModalOpen, paywallTrigger, closePaywall } = useUIStore();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogFocusTrap({
    open: paywallModalOpen,
    onClose: closePaywall,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  if (!paywallModalOpen) return null;

  const isProLock = paywallTrigger === "PRO_FEATURE_LOCKED";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 relative animate-fade-up"
      >
        <button
          type="button"
          ref={closeButtonRef}
          onClick={closePaywall}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label={t("close")}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="paywall-title" className="text-xl font-bold text-kazi-navy pr-8">
          {isProLock ? t("proTitle") : t("creditsTitle")}
        </h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {isProLock ? t("proDescription") : t("creditsDescription")}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link href={`/${locale}/subscription`} onClick={closePaywall}>
            <Button className="w-full">
              {isProLock ? t("upgradePro") : t("buyCredits")}
            </Button>
          </Link>
          <Button variant="ghost" className="w-full" onClick={closePaywall}>
            {t("continueFree")}
          </Button>
        </div>
      </div>
    </div>
  );
}
