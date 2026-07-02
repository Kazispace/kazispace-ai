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
import { JobLogo } from "@/components/jobs/job-logo";
import { MatchAnalysisPanel } from "@/components/jobs/match-analysis-panel";
import { useJobDetail } from "@/hooks/use-jobs";
import {
  getJobApplyUrl,
  getJobGaps,
  getJobWhyMatched,
} from "@/lib/jobs-display";
import {
  getJobCtaHref,
  shouldRenderDetailPrimaryCta,
} from "@/lib/job-cta";
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
  const whyMatched = job ? getJobWhyMatched(job) : [];
  const gaps = job ? getJobGaps(job) : [];
  const applyUrl = job ? getJobApplyUrl(job) : null;

  const handlePrimaryCta = (cta: string, jobId: string) => {
    if (cta === "unlock_pro") {
      openPaywall("PRO_FEATURE_LOCKED");
      return;
    }
    const href = getJobCtaHref(locale, cta, jobId);
    if (href) router.push(href);
  };

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
            <div className="flex gap-3 mb-3">
              <JobLogo
                logoUrl={job.logo_url}
                company={job.company}
                className="w-12 h-12"
                iconClassName="w-6 h-6"
              />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-kazi-navy">{job.title}</h1>
                <p className="text-gray-600">{job.company}</p>
              </div>
            </div>

            {job.location && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                <MapPin className="w-4 h-4 shrink-0" />
                {job.location}
                {job.work_mode ? ` · ${job.work_mode}` : ""}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              {job.match_score != null && (
                <Badge>{t("matchScore", { score: job.match_score })}</Badge>
              )}
            </div>

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

            {job.required_skills && job.required_skills.length > 0 && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h2 className="font-semibold text-kazi-navy mb-2">
                    {t("requiredSkills")}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {job.required_skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!locked && job.match_analysis && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h2 className="font-semibold text-kazi-navy mb-3">
                    {t("overallMatch")}
                  </h2>
                  <MatchAnalysisPanel analysis={job.match_analysis} />
                </CardContent>
              </Card>
            )}

            {!locked && whyMatched.length > 0 && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h2 className="font-semibold text-kazi-navy mb-2">
                    {t("whyMatched")}
                  </h2>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {whyMatched.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {!locked && gaps.length > 0 && (
              <Card className="mb-4">
                <CardContent className="p-4">
                  <h2 className="font-semibold text-kazi-navy mb-2">{t("gaps")}</h2>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {gaps.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-2">
              {shouldRenderDetailPrimaryCta(job.primary_cta, locked) && (
                <Button
                  className="w-full"
                  onClick={() => handlePrimaryCta(job.primary_cta!, job.job_id)}
                >
                  {t(`cta.${job.primary_cta}`)}
                </Button>
              )}
              {applyUrl && !locked && (
                <Button asChild className="w-full gap-2">
                  <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                    {t("apply")}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          </>
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
