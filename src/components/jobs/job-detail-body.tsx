'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, MapPin } from 'lucide-react';

import { JobLogo } from '@/components/jobs/job-logo';
import { MatchAnalysisPanel } from '@/components/jobs/match-analysis-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useJobDetail } from '@/hooks/use-jobs';
import {
  getJobApplyUrl,
  getJobGaps,
  getJobWhyMatched,
} from '@/lib/jobs-display';
import {
  getJobCtaHref,
  shouldRenderDetailPrimaryCta,
} from '@/lib/job-cta';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface JobDetailBodyProps {
  jobId: string;
  locale: string;
  className?: string;
  /** Compact padding for side rail vs full page. */
  density?: 'page' | 'rail';
}

/** Shared job detail body for `/jobs/[id]` and in-chat detail rail. */
export function JobDetailBody({
  jobId,
  locale,
  className,
  density = 'page',
}: JobDetailBodyProps) {
  const router = useRouter();
  const t = useTranslations('jobs');
  const { job, isLoading, error, needsLogin } = useJobDetail(jobId);
  const openPaywall = useUIStore((s) => s.openPaywall);

  const locked = job?.pro_features_locked === true;
  const whyMatched = job ? getJobWhyMatched(job) : [];
  const gaps = job ? getJobGaps(job) : [];
  const applyUrl = job ? getJobApplyUrl(job) : null;
  const isRail = density === 'rail';

  const handlePrimaryCta = (cta: string, id: string) => {
    if (cta === 'unlock_pro') {
      openPaywall('PRO_FEATURE_LOCKED');
      return;
    }
    const href = getJobCtaHref(locale, cta, id);
    if (href) router.push(href);
  };

  return (
    <div className={cn(isRail ? 'px-4 py-3' : undefined, className)}>
      {needsLogin ? (
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-6 text-center">
          <p className="mb-4 text-sm text-gray-700">{t('loginBanner')}</p>
          <Button size="sm" onClick={() => router.push(`/${locale}/login`)}>
            {t('signIn')}
          </Button>
        </div>
      ) : isLoading ? (
        <p className="py-12 text-center text-gray-500">{t('detailLoading')}</p>
      ) : error || !job ? (
        <p className="py-12 text-center text-red-500">{t('detailError')}</p>
      ) : (
        <>
          <div className="mb-3 flex gap-3">
            <JobLogo
              logoUrl={job.logo_url}
              company={job.company}
              className={isRail ? 'h-10 w-10' : 'h-12 w-12'}
              iconClassName={isRail ? 'h-5 w-5' : 'h-6 w-6'}
            />
            <div className="min-w-0">
              <h1
                className={cn(
                  'font-bold text-kazi-navy',
                  isRail ? 'text-lg leading-snug' : 'text-2xl'
                )}
              >
                {job.title}
              </h1>
              <p className="text-gray-600">{job.company}</p>
            </div>
          </div>

          {job.location && (
            <p className="mb-3 flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-4 w-4 shrink-0" />
              {job.location}
              {job.work_mode ? ` · ${job.work_mode}` : ''}
            </p>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {job.match_score != null && (
              <Badge>{t('matchScore', { score: job.match_score })}</Badge>
            )}
          </div>

          {job.salary && (
            <p
              className={cn(
                'mb-4 font-semibold text-kazi-orange',
                isRail ? 'text-base' : 'text-lg'
              )}
            >
              {job.salary}
            </p>
          )}

          {locked && (
            <Card className="mb-4 border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-900">
                {t('proLocked')}
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => openPaywall('PRO_FEATURE_LOCKED')}
                >
                  {t('unlockPro')}
                </Button>
              </CardContent>
            </Card>
          )}

          {job.description_text && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {job.description_text}
                </p>
              </CardContent>
            </Card>
          )}

          {job.required_skills && job.required_skills.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <h2 className="mb-2 font-semibold text-kazi-navy">
                  {t('requiredSkills')}
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
                <h2 className="mb-3 font-semibold text-kazi-navy">
                  {t('overallMatch')}
                </h2>
                <MatchAnalysisPanel analysis={job.match_analysis} />
              </CardContent>
            </Card>
          )}

          {!locked && whyMatched.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <h2 className="mb-2 font-semibold text-kazi-navy">
                  {t('whyMatched')}
                </h2>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
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
                <h2 className="mb-2 font-semibold text-kazi-navy">{t('gaps')}</h2>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                  {gaps.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-2 pb-4">
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
                  {t('apply')}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
