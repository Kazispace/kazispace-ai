"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { EppAssessmentFlow } from "@/components/english/epp-assessment-flow";
import { EPP_PROFILE_ENABLED } from "@/lib/constants";

interface AssessmentPageProps {
  params: { locale: string };
}

function AssessmentPageContent({ locale }: { locale: string }) {
  const t = useTranslations("english");

  if (!EPP_PROFILE_ENABLED) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">{t("featureDisabled")}</p>
      </div>
    );
  }

  return <EppAssessmentFlow locale={locale} />;
}

export default function EnglishAssessmentPage({ params }: AssessmentPageProps) {
  const t = useTranslations("english");
  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      <Header locale={params.locale} />
      <main className="pt-16 flex-1 flex flex-col">
        <div className="px-4 pt-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${params.locale}/english`}>{t("assessment.back")}</Link>
          </Button>
        </div>
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {t("loading")}
            </div>
          }
        >
          <AssessmentPageContent locale={params.locale} />
        </Suspense>
      </main>
      <BottomNav locale={params.locale} />
    </div>
  );
}
