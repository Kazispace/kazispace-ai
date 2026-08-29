'use client';

import { useTranslations } from 'next-intl';

interface InterviewProgressProps {
  questionIndex: number;
  questionCount: number;
}

export function InterviewProgress({ questionIndex, questionCount }: InterviewProgressProps) {
  const t = useTranslations('interview');
  const pct = questionCount > 0 ? (questionIndex / questionCount) * 100 : 0;

  return (
    <div className="px-4 py-2 border-b border-gray-100 bg-white">
      <p className="text-xs text-gray-500 mb-1">
        {t('progressLabel', { current: questionIndex, total: questionCount })}
      </p>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-red-600 transition-all duration-300"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
