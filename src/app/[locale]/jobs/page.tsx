"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Lock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobLogo } from "@/components/jobs/job-logo";
import { useJobRecommendations } from "@/hooks/use-jobs";
import { isKnownMatchLevel } from "@/lib/jobs-display";
import {
  getJobCtaHref,
  shouldRenderListPrimaryCta,
  shouldShowLegacyUnlockButton,
  shouldShowProfileFallbackCta,
} from "@/lib/job-cta";
import { useUIStore } from "@/lib/store";

interface JobsPageProps {
  params: { locale: string };
}

export default function JobsPage({ params }: JobsPageProps) {
  const { locale } = params;
  const router = useRouter();
  const t = useTranslations("jobs");
  const { items, isProUser, upgradeHint, engineTotal, isLoading, error, needsLogin } =
    useJobRecommendations();
  const openPaywall = useUIStore((s) => s.openPaywall);
  const showProfileCta = shouldShowProfileFallbackCta(items);

  const handlePrimaryCta = (cta: string, jobId: string) => {
    if (cta === "unlock_pro") {
      openPaywall("PRO_FEATURE_LOCKED");
      return;
    }
    const href = getJobCtaHref(
      locale,
      cta,
      jobId,
      cta === 'assess_readiness' ? { readinessSource: 'job_search_list' } : undefined
    );
    if (href) router.push(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-2">{t("title")}</h1>
        {engineTotal != null && (
          <p className="text-sm text-gray-500 mb-6">
            {t("engineTotal", { count: engineTotal })}
          </p>
        )}

        {needsLogin ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-700 mb-4">{t("loginBanner")}</p>
            <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
              {t("signIn")}
            </Button>
          </div>
        ) : isLoading ? (
          <p className="text-center text-gray-500 py-12">{t("loading")}</p>
        ) : error ? (
          <p className="text-center text-red-500 py-12">{t("loadError")}</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-500 py-12">{t("empty")}</p>
        ) : (
          <>
            {showProfileCta && (
              <Card className="mb-4 border-primary/30 bg-blue-50">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-700 mb-3">{t("profileCtaHint")}</p>
                  <Button size="sm" onClick={() => router.push(`/${locale}/chat`)}>
                    {t("ctaCompleteProfile")}
                  </Button>
                </CardContent>
              </Card>
            )}
            <ul className="space-y-3">
              {items.map((job) => (
                <li key={job.job_id}>
                  <Card className={job.is_locked ? "border-amber-200/80" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex gap-3 min-w-0">
                          <JobLogo logoUrl={job.logo_url} company={job.company} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="font-semibold text-kazi-navy">
                                {job.title}
                              </h2>
                              {job.is_locked && (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-amber-800 bg-amber-50"
                                >
                                  <Lock className="w-3 h-3" />
                                  {t("locked")}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{job.company}</p>
                            {job.location && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {job.location}
                                {job.work_mode ? ` · ${job.work_mode}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {job.match_score != null && (
                            <Badge variant="secondary">
                              {t("matchScore", { score: job.match_score })}
                            </Badge>
                          )}
                          {job.match_level && isKnownMatchLevel(job.match_level) && (
                            <span className="text-[10px] text-gray-500">
                              {t(`matchLevel.${job.match_level}`)}
                            </span>
                          )}
                        </div>
                      </div>

                      {job.salary && (
                        <p className="text-sm font-medium text-primary mt-2">
                          {job.salary}
                        </p>
                      )}

                      {!job.is_locked &&
                        job.why_matched &&
                        job.why_matched.length > 0 && (
                          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                            {job.why_matched[0]}
                          </p>
                        )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" asChild>
                          <Link href={`/${locale}/jobs/${job.job_id}`}>
                            {t("viewDetails")}
                          </Link>
                        </Button>
                        {shouldRenderListPrimaryCta(job.primary_cta) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              handlePrimaryCta(job.primary_cta!, job.job_id)
                            }
                          >
                            {t(`cta.${job.primary_cta}`)}
                          </Button>
                        )}
                        {shouldShowLegacyUnlockButton(job) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1"
                            onClick={() => openPaywall("PRO_FEATURE_LOCKED")}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            {t("unlockPro")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}

        {!isProUser && upgradeHint && items.length > 0 && (
          <p className="text-xs text-gray-500 text-center mt-6">{upgradeHint}</p>
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
