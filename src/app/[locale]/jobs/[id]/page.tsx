"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin, ExternalLink } from "lucide-react";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useJobDetail } from "@/hooks/use-jobs";
import { useUIStore } from "@/lib/store";

interface JobDetailPageProps {
  params: { locale: string; id: string };
}

export default function JobDetailPage({ params }: JobDetailPageProps) {
  const { locale, id } = params;
  const router = useRouter();
  const t = useTranslations("jobs");
  const { job, isLoading, error, needsLogin } = useJobDetail(id);
  const openPaywall = useUIStore((s) => s.openPaywall);

  const locked = job?.pro_features_locked === true;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <Link
          href={`/${locale}/jobs`}
          className="text-sm text-kazi-orange font-medium mb-4 inline-block"
        >
          {t("backToList")}
        </Link>

        {needsLogin ? (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-700 mb-4">{t("loginBanner")}</p>
            <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
              {t("signIn")}
            </Button>
          </div>
        ) : isLoading ? (
          <p className="text-center text-gray-500 py-12">{t("detailLoading")}</p>
        ) : error || !job ? (
          <p className="text-center text-red-500 py-12">{t("detailError")}</p>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-kazi-navy mb-1">{job.title}</h1>
            <p className="text-gray-600 mb-2">{job.company}</p>
            {job.location && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mb-4">
                <MapPin className="w-4 h-4" />
                {job.location}
                {job.work_mode ? ` · ${job.work_mode}` : ""}
              </p>
            )}
            {job.match_score != null && (
              <Badge className="mb-4">
                {t("matchScore", { score: job.match_score })}
              </Badge>
            )}
            {job.salary && (
              <p className="text-lg font-semibold text-kazi-orange mb-4">
                {job.salary}
              </p>
            )}

            {locked && (
              <Card className="mb-4 border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-sm text-amber-900">
                  {t("proLocked")}
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => openPaywall("PRO_FEATURE_LOCKED")}
                  >
                    {t("unlockPro")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {job.description_text && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {job.description_text}
                  </p>
                </CardContent>
              </Card>
            )}

            {!locked && job.why_matched && job.why_matched.length > 0 && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h2 className="font-semibold text-kazi-navy mb-2">
                    {t("whyMatched")}
                  </h2>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {job.why_matched.map((line, i) => (
                      <li key={`why-${i}`}>{line}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {!locked && job.gap_to_close && job.gap_to_close.length > 0 && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h2 className="font-semibold text-kazi-navy mb-2">{t("gaps")}</h2>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {job.gap_to_close.map((line, i) => (
                      <li key={`gap-${i}`}>{line}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {job.apply_url && !locked && (
              <Button asChild className="w-full gap-2">
                <a href={job.apply_url} target="_blank" rel="noopener noreferrer">
                  {t("apply")}
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
          </>
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
