import type { AgentSessionSummary, ChatMessage } from '@/types';

export type RawAgentHistoryMessage = {
  id?: string;
  message_id?: string;
  role?: string;
  content?: string;
  text?: string;
  timestamp?: string;
  created_at?: string;
};

/** Map API history rows to chat messages; unknown roles become assistant. */
export function mapAgentHistoryToChatMessages(
  messages: RawAgentHistoryMessage[],
  sessionId: string
): ChatMessage[] {
  return messages.map((raw, i) => {
    const roleRaw = raw.role ?? 'assistant';
    const role: ChatMessage['role'] =
      roleRaw === 'user'
        ? 'user'
        : roleRaw === 'system'
          ? 'system'
          : 'assistant';
    return {
      id: raw.id ?? raw.message_id ?? `hist_${i}`,
      role,
      content: raw.content ?? raw.text ?? '',
      timestamp: raw.timestamp ?? raw.created_at ?? new Date().toISOString(),
      sessionId,
    };
  });
}

/** Stable ordering: active first, then most recently updated. */
export function sortAgentSessions(
  sessions: AgentSessionSummary[]
): AgentSessionSummary[] {
  return [...sessions].sort((a, b) => {
    const rank = (s: AgentSessionSummary) => {
      if (s.status === 'active') return 2;
      if (s.status === 'exited') return 1;
      return 0;
    };
    const diff = rank(b) - rank(a);
    if (diff !== 0) return diff;
    const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
    const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
    return bTime - aTime;
  });
}

export function dedupeAgentSessions(
  sessions: AgentSessionSummary[]
): AgentSessionSummary[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (seen.has(session.session_id)) return false;
    seen.add(session.session_id);
    return true;
  });
}

export function normalizeAgentSessions(
  sessions: AgentSessionSummary[]
): AgentSessionSummary[] {
  return sortAgentSessions(dedupeAgentSessions(sessions));
}

/** v1.3 §4 — exited and archived sessions are view-only in the UI. */
export function isAgentSessionReadOnly(status?: string | null): boolean {
  return status === 'exited' || status === 'archived';
}
