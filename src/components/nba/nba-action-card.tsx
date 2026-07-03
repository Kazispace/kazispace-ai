'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Briefcase,
  FileText,
  Mic,
  Sparkles,
  Target,
  User,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { resolveNbaHref } from '@/lib/nba-routing';
import { cn } from '@/lib/utils';
import type { NextBestActionItem } from '@/types';

const ACTION_ICONS: Record<string, LucideIcon> = {
  complete_profile: User,
  start_interview: Mic,
  view_job_recommendations: Briefcase,
  start_job_focused_preparation: Target,
  continue_highest_leverage_preparation: FileText,
  return_via_new_job_opportunity: Briefcase,
  upgrade_to_unlock_more: Zap,
  use_pro_to_accelerate_results: Sparkles,
  edit_cv: FileText,
  pay_upgrade: Zap,
};

function actionI18nKey(actionType: string): string {
  return actionType.replace(/[^a-z0-9_]/gi, '_');
}

interface NbaActionCardProps {
  locale: string;
  action: NextBestActionItem;
  className?: string;
}

export function NbaActionCard({ locale, action, className }: NbaActionCardProps) {
  const t = useTranslations('nba');
  const key = actionI18nKey(action.action_type);
  const Icon = ACTION_ICONS[action.action_type] ?? Sparkles;
  const href = resolveNbaHref(locale, action.redirect_url, action.action_type);

  const title = t(`${key}.title` as 'complete_profile.title');
  const description = t(`${key}.description` as 'complete_profile.description');

  return (
    <div
      className={cn(
        'rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm',
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-kazi-orange mb-2">
        {t('sectionTitle')}
      </p>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-orange-100 text-kazi-orange">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-kazi-navy">{title}</h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>
          <Button size="sm" className="mt-3" asChild>
            <Link href={href}>{t('cta')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
