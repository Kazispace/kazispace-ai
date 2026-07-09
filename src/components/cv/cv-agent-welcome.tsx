'use client';

import { FileUp, MessageSquare, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface CvAgentWelcomeProps {
  onPrompt: (text: string) => void;
  onUploadClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function CvAgentWelcome({
  onPrompt,
  onUploadClick,
  disabled,
  className,
}: CvAgentWelcomeProps) {
  const t = useTranslations('cv');

  const suggestions = [
    {
      key: 'upload',
      icon: FileUp,
      label: t('welcomePromptUpload'),
      action: onUploadClick,
    },
    {
      key: 'experience',
      icon: MessageSquare,
      label: t('welcomePromptExperience'),
      action: () => onPrompt(t('welcomePromptExperienceText')),
    },
    {
      key: 'tailor',
      icon: Target,
      label: t('welcomePromptTailor'),
      action: () => onPrompt(t('welcomePromptTailorText')),
    },
  ] as const;

  return (
    <div className={cn('w-full py-6', className)}>
      <div className="rounded-2xl bg-clinic-bubble border border-gray-200/80 px-5 py-5">
        <p className="text-[15px] leading-relaxed text-gray-800">{t('agentWelcome')}</p>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {suggestions.map(({ key, icon: Icon, label, action }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={action}
            className={cn(
              'flex items-start gap-3 rounded-xl border border-gray-200/80 bg-white p-4 text-left',
              'hover:border-kazi-orange/40 hover:shadow-sm transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-kazi-navy/5 text-kazi-navy">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-medium text-kazi-navy leading-snug">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
