"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { IrpReadinessPanel } from "@/components/interview/irp-readiness-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IRP_PROFILE_ENABLED } from "@/lib/constants";
import { useInterviewReadiness } from "@/hooks/use-interview-profile";
import { useBilling } from "@/hooks/use-billing";
import { isProPlan } from "@/lib/api-mappers";
import { parseReadinessCheckSource } from "@/types";

interface ReadinessPageProps {
  params: { locale: string };
}

function ReadinessPageContent({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const readinessSource = parseReadinessCheckSource(searchParams.get("source"));
  const t = useTranslations("interview.irp");

  const {
    readinessResult,
    isReadinessLoading,
    readinessError,
    isReadinessLimitError,
    refetchReadiness,
  } = useInterviewReadiness(jobId, { enabled: IRP_PROFILE_ENABLED, source: readinessSource });

  const { plan } = useBilling();
  const isProUser = isProPlan(plan);

  if (!IRP_PROFILE_ENABLED) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">{t("featureDisabled")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 gap-4">
      <div>
        <Link
          href={`/${locale}/interview${jobId ? `?job_id=${encodeURIComponent(jobId)}` : ""}`}
          className="text-xs text-kazi-orange font-medium"
        >
          {t("readiness.back")}
        </Link>
        <h1 className="text-lg font-bold text-kazi-navy mt-2">{t("readiness.pageTitle")}</h1>
      </div>

      {!jobId && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center space-y-3">
          <p className="text-sm text-gray-700">{t("readiness.jobRequired")}</p>
          <Button size="sm" asChild>
            <Link href={`/${locale}/jobs`}>{t("cta.viewJobs")}</Link>
          </Button>
        </div>
      )}

      {jobId && isReadinessLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
        </div>
      )}

      {jobId && readinessError && !isReadinessLoading && isReadinessLimitError && (
        <Card>
          <CardContent className="p-5 text-center space-y-3">
            <p className="text-sm text-gray-700">{t("readiness.freeLimit")}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" asChild>
                <Link href={`/${locale}/subscription`}>{t("readiness.upgradePro")}</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/${locale}/jobs`}>{t("cta.viewJobs")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {jobId && readinessError && !isReadinessLoading && !isReadinessLimitError && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center space-y-3">
          <p className="text-sm text-red-600">{readinessError}</p>
          <Button size="sm" onClick={() => void refetchReadiness()} disabled={isReadinessLoading}>
            {t("readiness.retry")}
          </Button>
        </div>
      )}

      {jobId && readinessResult && !isReadinessLoading && (
        <IrpReadinessPanel
          result={readinessResult}
          locale={locale}
          jobId={jobId}
          onRetry={() => void refetchReadiness()}
          isLoading={isReadinessLoading}
          isPro={isProUser}
        />
      )}

      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => router.push(`/${locale}/interview`)}
      >
        {t("readiness.backToInterview")}
      </Button>
    </div>
  );
}

export default function InterviewReadinessPage({ params }: ReadinessPageProps) {
  const t = useTranslations("interview");
  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      <Header locale={params.locale} />
      <main className="pt-16 flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {t("loading")}
            </div>
          }
        >
          <ReadinessPageContent locale={params.locale} />
        </Suspense>
      </main>
      <BottomNav locale={params.locale} />
    </div>
  );
}
