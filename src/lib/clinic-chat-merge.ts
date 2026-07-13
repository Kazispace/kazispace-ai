import { isPlaceholderReply } from '@/lib/spaces/turn';
import type { ChatMessage } from '@/types';

function messageContentKey(message: ChatMessage): string {
  return `${message.role}\0${message.content.trim()}`;
}

/** Keep in-flight / not-yet-persisted turns when session history reloads. */
export function mergeClinicMessagesAfterHistoryLoad(
  local: ChatMessage[],
  fromServer: ChatMessage[]
): ChatMessage[] {
  if (fromServer.length === 0) return local;

  const serverKeys = new Set(fromServer.map(messageContentKey));

  const pendingLocal = local.filter((message) => {
    if (message.status === 'sending' || message.status === 'failed') return true;
    if (message.streamComplete === false) return true;
    if (serverKeys.has(messageContentKey(message))) return false;
    if (message.role === 'assistant' && isPlaceholderReply(message.content)) return true;
    return true;
  });

  if (pendingLocal.length === 0) return fromServer;

  return [...fromServer, ...pendingLocal];
}
