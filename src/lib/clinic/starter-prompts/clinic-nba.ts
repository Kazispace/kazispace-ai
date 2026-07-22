import type { ChatMessage } from '@/types';
import type { ChatNextAction } from '@/types/chat-envelope';

type ClinicNbaMessage = Pick<ChatMessage, 'role' | 'nextActions'>;

/**
 * Latest assistant `next_actions` that still apply for Clinic Starter mutex (SDD §2.4.2).
 * Ignores stale NBA after the user sends a follow-up without a newer assistant reply.
 */
export function resolveLatestClinicNextActions(
  messages: ReadonlyArray<ClinicNbaMessage>
): ChatNextAction[] {
  if (messages.length === 0) return [];

  let latestAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      latestAssistantIdx = i;
      break;
    }
  }
  if (latestAssistantIdx < 0) return [];

  for (let i = latestAssistantIdx + 1; i < messages.length; i++) {
    if (messages[i].role === 'user') return [];
  }

  const actions = messages[latestAssistantIdx].nextActions;
  return actions && actions.length > 0 ? [...actions] : [];
}
