"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CvNewSessionDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CvNewSessionDialog({
  open,
  onConfirm,
  onCancel,
}: CvNewSessionDialogProps) {
  const t = useTranslations("cv");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-new-session-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 relative animate-fade-up">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label={t("newCvConfirmCancel")}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="cv-new-session-title" className="text-xl font-bold text-kazi-navy pr-8">
          {t("newCvConfirmTitle")}
        </h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {t("newCvConfirmBody")}
        </p>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="ghost" onClick={onCancel}>
            {t("newCvConfirmCancel")}
          </Button>
          <Button onClick={onConfirm}>{t("newCvConfirmAction")}</Button>
        </div>
      </div>
    </div>
  );
}
