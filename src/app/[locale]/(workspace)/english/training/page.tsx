"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { EppTrainingFlow } from "@/components/english/epp-training-flow";
import { EPP_PROFILE_ENABLED } from "@/lib/constants";

interface TrainingPageProps {
  params: { locale: string };
}

function TrainingPageContent({ locale }: { locale: string }) {
  const t = useTranslations("english");

  if (!EPP_PROFILE_ENABLED) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">{t("featureDisabled")}</p>
      </div>
    );
  }

  return <EppTrainingFlow locale={locale} />;
}

export default function EnglishTrainingPage({ params }: TrainingPageProps) {
  const t = useTranslations("english");
  return (
    <div className="min-h-0 h-full bg-gray-50 flex flex-col">
      <main className="flex-1 flex flex-col">
        <div className="px-4 pt-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${params.locale}/english`}>{t("training.back")}</Link>
          </Button>
        </div>
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {t("loading")}
            </div>
          }
        >
          <TrainingPageContent locale={params.locale} />
        </Suspense>
      </main>
    </div>
  );
}
