import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { resolveActionLabel } from '@/lib/chat-envelope';
import type { ChatNextAction } from '@/types/chat-envelope';

const ROUTED_ACTION_TYPES = new Set([
  'upgrade_pro',
  'unlock_pro',
  'complete_profile',
  'return_to_clinic',
  'regenerate',
  'accept_cv',
  'confirm',
]);

export function isRoutedCvAction(type: string): boolean {
  return ROUTED_ACTION_TYPES.has(type);
}

/** Quick-reply CTAs (role/status pickers) send payload text; routed CTAs use handlers. */
export function quickReplyLabel(action: ChatNextAction, locale: string): string {
  if (action.payload) return action.payload;
  return resolveActionLabel(action, locale);
}

export function handleCvNextAction(
  action: ChatNextAction,
  deps: {
    locale: string;
    router: AppRouterInstance;
    openPaywall: (code: string) => void;
    sendPayload: (payload: string, showUserBubble?: boolean) => void;
    intakeConfirm: () => void;
    acceptCv: () => void;
    regenerateCv: () => void;
  }
): void {
  switch (action.type) {
    case 'upgrade_pro':
    case 'unlock_pro':
      deps.openPaywall('PRO_FEATURE_LOCKED');
      return;
    case 'complete_profile':
      deps.router.push(`/${deps.locale}/profile`);
      return;
    case 'return_to_clinic':
      deps.router.push(`/${deps.locale}/chat`);
      return;
    case 'regenerate':
      deps.regenerateCv();
      return;
    case 'confirm':
      deps.intakeConfirm();
      return;
    case 'accept_cv':
      deps.acceptCv();
      return;
    default:
      if (action.payload) {
        deps.sendPayload(action.payload);
        return;
      }
      deps.sendPayload(resolveActionLabel(action, deps.locale));
  }
}
