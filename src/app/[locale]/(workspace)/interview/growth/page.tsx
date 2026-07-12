"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { IrpGrowthHistory } from "@/components/interview/irp-growth-history";
import { Button } from "@/components/ui/button";
import { IRP_PROFILE_ENABLED } from "@/lib/constants";
import { useInterviewProfileHistory } from "@/hooks/use-interview-profile";
import { useBilling } from "@/hooks/use-billing";
import { isProPlan } from "@/lib/api-mappers";

interface GrowthPageProps {
  params: { locale: string };
}

function GrowthPageContent({ locale }: { locale: string }) {
  const t = useTranslations("interview.irp");
  const { history, isHistoryLoading, historyError, refetchHistory } =
    useInterviewProfileHistory({ enabled: IRP_PROFILE_ENABLED });

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
          href={`/${locale}/interview`}
          className="text-xs text-kazi-orange font-medium"
        >
          {t("growth.back")}
        </Link>
        <h1 className="text-lg font-bold text-kazi-navy mt-2">{t("growth.pageTitle")}</h1>
        <p className="text-xs text-gray-500 mt-1">{t("growth.subtitle")}</p>
      </div>

      {isHistoryLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
        </div>
      )}

      {historyError && !isHistoryLoading && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center space-y-3">
          <p className="text-sm text-red-600">{historyError}</p>
          <Button size="sm" onClick={() => void refetchHistory()}>
            {t("growth.retry")}
          </Button>
        </div>
      )}

      {history && !isHistoryLoading && !historyError && (
        <IrpGrowthHistory items={history.items} badges={history.badges} isPro={isProUser} />
      )}

      <Button size="sm" variant="outline" className="self-start" asChild>
        <Link href={`/${locale}/interview`}>{t("growth.backToInterview")}</Link>
      </Button>
    </div>
  );
}

export default function InterviewGrowthPage({ params }: GrowthPageProps) {
  const t = useTranslations("interview");
  return (
    <div className="min-h-0 h-full bg-gray-50 flex flex-col">
      <main className="flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {t("loading")}
            </div>
          }
        >
          <GrowthPageContent locale={params.locale} />
        </Suspense>
      </main>
    </div>
  );
}
