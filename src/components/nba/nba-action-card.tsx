'use client';

import Link from 'next/link';
import { useMessages, useTranslations } from 'next-intl';
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

type NbaMessages = Record<string, { title?: string; description?: string } | string>;

function resolveNbaCopy(
  messages: NbaMessages,
  t: ReturnType<typeof useTranslations<'nba'>>,
  actionKey: string,
  field: 'title' | 'description',
  apiFallback: string
): string {
  const actionEntry = messages[actionKey];
  if (actionEntry && typeof actionEntry === 'object' && actionEntry[field]) {
    return t(`${actionKey}.${field}` as 'complete_profile.title');
  }
  const defaultEntry = messages.default;
  if (defaultEntry && typeof defaultEntry === 'object' && defaultEntry[field]) {
    return t(`default.${field}` as 'default.title');
  }
  return apiFallback || t(`default.${field}` as 'default.title');
}

interface NbaActionCardProps {
  locale: string;
  action: NextBestActionItem;
  className?: string;
}

export function NbaActionCard({ locale, action, className }: NbaActionCardProps) {
  const t = useTranslations('nba');
  const messages = (useMessages().nba ?? {}) as NbaMessages;
  const key = actionI18nKey(action.action_type);
  const Icon = ACTION_ICONS[action.action_type] ?? Sparkles;
  const href = resolveNbaHref(locale, action.redirect_url, action.action_type);

  const title = resolveNbaCopy(messages, t, key, 'title', action.title);
  const description = resolveNbaCopy(
    messages,
    t,
    key,
    'description',
    action.description
  );

  return (
    <div
      className={cn(
        'rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm',
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-kazi-orange mb-2">
        {t('sectionTitle')}
      </p>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-blue-100 text-kazi-orange">
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
