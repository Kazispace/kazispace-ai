import type { UserMessageActionMeta } from '@/types/chat-envelope';

/**
 * What a failed send was asked to send, so "Try again" (D13) re-sends the same
 * request rather than the bubble's display text alone. Without this, a retried
 * form answer or action select loses its `actionMeta` and reaches the backend
 * as free text.
 *
 * Kept in memory only: a failed bubble is retried in the same page session.
 */
export interface FailedSendOptions {
  /** The `text` argument of the original send. */
  text: string;
  displayContent?: string;
  actionMeta?: UserMessageActionMeta;
  pendingCapability?: 'web_search' | 'research';
}

const failedSends = new Map<string, FailedSendOptions>();

const key = (scope: string, messageId: string) => `${scope}:${messageId}`;

/** Record the options of a send whose bubble was just marked "Not sent". */
export function rememberFailedSend(
  scope: string,
  messageId: string,
  options: FailedSendOptions
): void {
  failedSends.set(key(scope, messageId), options);
}

/**
 * Take the options recorded for a "Not sent" bubble. The entry is removed;
 * a retry that fails again records it anew.
 */
export function takeFailedSend(
  scope: string,
  messageId: string
): FailedSendOptions | undefined {
  const k = key(scope, messageId);
  const options = failedSends.get(k);
  failedSends.delete(k);
  return options;
}
