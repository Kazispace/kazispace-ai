"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { EppGrowthHistory } from "@/components/english/epp-growth-history";
import { Button } from "@/components/ui/button";
import { EPP_PROFILE_ENABLED } from "@/lib/constants";
import { useEnglishProfileHistory } from "@/hooks/use-english-profile";

interface GrowthPageProps {
  params: { locale: string };
}

function GrowthPageContent({ locale }: { locale: string }) {
  const t = useTranslations("english.growth");
  const { history, isHistoryLoading, historyError, refetchHistory } =
    useEnglishProfileHistory({ enabled: EPP_PROFILE_ENABLED });

  if (!EPP_PROFILE_ENABLED) {
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
          href={`/${locale}/english`}
          className="text-xs text-kazi-orange font-medium"
        >
          {t("back")}
        </Link>
        <h1 className="text-lg font-bold text-kazi-navy mt-2">{t("pageTitle")}</h1>
        <p className="text-xs text-gray-500 mt-1">{t("subtitle")}</p>
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
            {t("retry")}
          </Button>
        </div>
      )}

      {history && !isHistoryLoading && !historyError && (
        <EppGrowthHistory items={history.items} />
      )}

      <Button size="sm" variant="outline" className="self-start" asChild>
        <Link href={`/${locale}/english/passport`}>{t("backToPassport")}</Link>
      </Button>
    </div>
  );
}

export default function EnglishGrowthPage({ params }: GrowthPageProps) {
  const t = useTranslations("english");
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
