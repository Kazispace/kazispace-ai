import { isPlaceholderReply } from '@/lib/spaces/turn';
import type { ChatMessage } from '@/types';

/** Rows still owned by the client turn loop — not yet fully persisted in session history. */
export function isInFlightClinicMessage(message: ChatMessage): boolean {
  // Already bound to a server row — history reload must not append a second bubble.
  if (message.serverMessageId) return false;
  if (message.status === 'sending') return true;
  if (message.streamComplete === false) return true;
  if (message.role === 'assistant' && isPlaceholderReply(message.content)) return true;
  return false;
}

/** Keep in-flight turns when session history reloads; sent/failed rows defer to server. */
export function mergeClinicMessagesAfterHistoryLoad(
  local: ChatMessage[],
  fromServer: ChatMessage[]
): ChatMessage[] {
  if (fromServer.length === 0) return local;

  const serverIds = new Set(fromServer.map((message) => message.id));

  const pendingLocal = local.filter(
    (message) => isInFlightClinicMessage(message) && !serverIds.has(message.id)
  );

  if (pendingLocal.length === 0) return fromServer;

  return [...fromServer, ...pendingLocal];
}
