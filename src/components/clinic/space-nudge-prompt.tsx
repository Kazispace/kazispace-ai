'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  spaceNudgeEmoji,
  type SpaceNudgePayload,
} from '@/lib/spaces/space-nudge';
import { TEMPLATE_I18N_KEYS } from '@/lib/spaces/constants';

interface SpaceNudgePromptProps {
  nudge: SpaceNudgePayload;
  onAccept: () => void;
  onDismiss: () => void;
  disabled?: boolean;
}

/** Inline Clinic → Space conversion card (ADR-006 D10 / KAZI-181). Not a modal. */
export function SpaceNudgePrompt({
  nudge,
  onAccept,
  onDismiss,
  disabled,
}: SpaceNudgePromptProps) {
  const t = useTranslations('spaces');
  const i18nKey = TEMPLATE_I18N_KEYS[nudge.templateId];
  // Never surface raw snake_case ids (defense in depth; parser already whitelists).
  const templateTitle = i18nKey ? t(i18nKey.title) : t('nudgeGenericTemplate');
  // `{template}` = human template display name for translators.
  const reason =
    nudge.reason?.trim() ||
    t('nudgeDefaultReason', { template: templateTitle });
  const cta =
    nudge.ctaLabel?.trim() ||
    t('nudgeCta', { template: templateTitle });
  const emoji = spaceNudgeEmoji(nudge.templateId);

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-gray-200/80 pt-3">
      <p className="text-sm leading-relaxed text-gray-600">{reason}</p>
      <Button
        type="button"
        className="w-[80%] self-center"
        onClick={onAccept}
        disabled={disabled}
      >
        {emoji} {cta}
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        disabled={disabled}
        className="self-center text-sm text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
      >
        {t('nudgeDismiss')}
      </button>
    </div>
  );
}
