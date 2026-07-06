'use client';

import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import type { EnglishSampleJobs } from '@/types';

interface EppSampleJobsPanelProps {
  sampleJobs: EnglishSampleJobs;
}

function matchLabel(
  t: ReturnType<typeof useTranslations<'english.aha'>>,
  match: string
) {
  switch (match) {
    case 'eligible':
      return t('matchEligible');
    case 'borderline':
      return t('matchBorderline');
    default:
      return t('matchGap');
  }
}

export function EppSampleJobsPanel({ sampleJobs }: EppSampleJobsPanelProps) {
  const t = useTranslations('english.aha');

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-kazi-navy">{t('eligibleJobs')}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {t('eligibleCount', { count: sampleJobs.eligible_count })}
          </p>
          {sampleJobs.disclaimer === 'preview_before_assessment' && (
            <p className="text-[10px] text-amber-700 mt-1">{t('previewDisclaimer')}</p>
          )}
        </div>

        <ul className="space-y-2">
          {sampleJobs.preview_items.map((job) => (
            <li
              key={job.title}
              className="text-xs border border-gray-100 rounded-lg px-3 py-2 bg-gray-50"
            >
              <p className="font-medium text-kazi-navy">{job.title}</p>
              <p className="text-gray-500 mt-0.5">
                {t('jobRequirement', {
                  required: job.required_level,
                  user: job.user_level,
                  match: matchLabel(t, job.match),
                })}
              </p>
            </li>
          ))}
        </ul>

        {sampleJobs.unlock_preview && sampleJobs.unlock_preview.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">{t('unlockPreview')}</p>
            <ul className="space-y-1">
              {sampleJobs.unlock_preview.map((job) => (
                <li key={job.title} className="text-xs text-gray-400">
                  {job.title} · L{job.required_level} ({t('levelsNeeded', { n: job.levels_needed })})
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
