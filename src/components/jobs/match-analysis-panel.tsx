'use client';

import { useTranslations } from 'next-intl';

import type { JobMatchAnalysis } from '@/types/jobs';

interface MatchAnalysisPanelProps {
  analysis: JobMatchAnalysis;
}

const DIMENSIONS = [
  { key: 'skills_match', labelKey: 'matchDimensions.skills' },
  { key: 'experience_match', labelKey: 'matchDimensions.experience' },
  { key: 'language_match', labelKey: 'matchDimensions.language' },
  { key: 'preference_match', labelKey: 'matchDimensions.preference' },
] as const;

export function MatchAnalysisPanel({ analysis }: MatchAnalysisPanelProps) {
  const t = useTranslations('jobs');
  const scores = analysis.scores;
  const hasScores = scores && DIMENSIONS.some((d) => scores[d.key] != null);

  if (!analysis.overall_reason && !hasScores) return null;

  return (
    <div className="space-y-4">
      {analysis.overall_reason && (
        <p className="text-sm text-gray-700 leading-relaxed">{analysis.overall_reason}</p>
      )}
      {hasScores && (
        <div className="grid grid-cols-2 gap-3">
          {DIMENSIONS.map(({ key, labelKey }) => {
            const value = scores?.[key];
            if (value == null) return null;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{t(labelKey)}</span>
                  <span className="font-medium text-kazi-navy">{value}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-kazi-orange rounded-full transition-all"
                    style={{ width: `${Math.min(100, value)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
