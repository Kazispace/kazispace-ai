import { fetchAgentMessages, fetchCurrentAgentSessions } from '@/lib/agent-api';
import { getAgentHubPath } from '@/lib/agent-transition/surfaces';
import { AGENT_REGISTRY, getAgentLabel } from '@/lib/agents/registry';
import { apiRequest } from '@/lib/api-client';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import type { ApiResponse } from '@/types';
import type {
  SessionLibraryFile,
  SessionLibraryFilesResponse,
  SessionLibrarySearchHit,
  SessionLibrarySearchResponse,
  SessionMessageSearchHit,
} from '@/types/session-library';
import type { AgentSessionSummary } from '@/types';

function useMockFallback(error?: string): boolean {
  if (process.env.NEXT_PUBLIC_AGENT_API_MOCK === 'true') return true;
  if (!error) return false;
  return error.includes('404') || error.includes('Not Found');
}

function hubSegmentForAgent(agentId: string): string | null {
  const path = getAgentHubPath('en', agentId);
  if (!path) return null;
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

function mockFilesForSession(
  session: AgentSessionSummary,
  locale = 'en'
): SessionLibraryFile[] {
  const hub = hubSegmentForAgent(session.agent_id);
  const agent = AGENT_REGISTRY.find((entry) => entry.agentId === session.agent_id);
  const agentName = agent ? getAgentLabel(agent, locale, 'name') : session.agent_id;
  const base = {
    agent_id: session.agent_id,
    session_id: session.session_id,
    session_title: session.title,
    hub_segment: hub,
    updated_at: session.updated_at ?? null,
  };

  if (session.agent_id === CV_BUILDER_AGENT_ID) {
    return [
      {
        file_id: `${session.session_id}_resume_md`,
        name: 'resume.md',
        mime_type: 'text/markdown',
        ...base,
      },
      {
        file_id: `${session.session_id}_upload`,
        name: 'uploaded-resume.pdf',
        mime_type: 'application/pdf',
        ...base,
      },
    ];
  }

  if (session.agent_id === MOCK_INTERVIEW_AGENT_ID) {
    return [
      {
        file_id: `${session.session_id}_prep`,
        name: 'interview-prep.md',
        mime_type: 'text/markdown',
        ...base,
      },
    ];
  }

  return [
    {
      file_id: `${session.session_id}_notes`,
      name: `${agentName}-notes.md`,
      mime_type: 'text/markdown',
      ...base,
    },
  ];
}

async function loadCurrentSessions(): Promise<AgentSessionSummary[]> {
  const res = await fetchCurrentAgentSessions();
  return res.success && res.data ? res.data.sessions : [];
}

function buildMockGlobalFiles(sessions: AgentSessionSummary[]): SessionLibraryFile[] {
  return sessions.flatMap((session) => mockFilesForSession(session));
}

function buildMockSessionFiles(
  sessionId: string,
  agentId?: string | null
): SessionLibraryFile[] {
  const session: AgentSessionSummary = {
    session_id: sessionId,
    agent_id: agentId ?? CV_BUILDER_AGENT_ID,
    status: 'active',
    title: 'Current session',
  };
  return mockFilesForSession(session);
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

async function buildMockSearchHits(query: string): Promise<SessionLibrarySearchHit[]> {
  const sessions = await loadCurrentSessions();
  const hits: SessionLibrarySearchHit[] = [];

  for (const session of sessions) {
    const agent = AGENT_REGISTRY.find((entry) => entry.agentId === session.agent_id);
    const agentName = agent ? getAgentLabel(agent, 'en', 'name') : session.agent_id;
    const hub = hubSegmentForAgent(session.agent_id);
    const title = `${agentName} · ${session.title}`;

    if (matchesQuery(title, query) || matchesQuery(session.title, query)) {
      hits.push({
        hit_id: `session_${session.session_id}`,
        type: 'session',
        title,
        snippet: session.pipeline_state ?? session.status,
        agent_id: session.agent_id,
        session_id: session.session_id,
        hub_segment: hub,
      });
    }

    for (const file of mockFilesForSession(session)) {
      if (matchesQuery(file.name, query)) {
        hits.push({
          hit_id: `file_${file.file_id}`,
          type: 'file',
          title: file.name,
          snippet: title,
          agent_id: file.agent_id,
          session_id: file.session_id,
          hub_segment: file.hub_segment,
        });
      }
    }
  }

  return hits;
}

export async function fetchGlobalLibraryFiles(): Promise<
  ApiResponse<SessionLibraryFilesResponse>
> {
  const res = await apiRequest<SessionLibraryFilesResponse>('/api/v1/library/files');
  if (res.success && res.data) return res;
  if (useMockFallback(res.error)) {
    const sessions = await loadCurrentSessions();
    return { success: true, data: { files: buildMockGlobalFiles(sessions) } };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function fetchSessionFiles(
  sessionId: string,
  agentId?: string | null
): Promise<ApiResponse<SessionLibraryFilesResponse>> {
  const res = await apiRequest<SessionLibraryFilesResponse>(
    `/api/v1/agents/sessions/${encodeURIComponent(sessionId)}/files`
  );
  if (res.success && res.data) return res;
  if (useMockFallback(res.error)) {
    return {
      success: true,
      data: { files: buildMockSessionFiles(sessionId, agentId) },
    };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function searchLibrary(
  query: string
): Promise<ApiResponse<SessionLibrarySearchResponse>> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { success: true, data: { hits: [] } };
  }

  const res = await apiRequest<SessionLibrarySearchResponse>(
    `/api/v1/library/search?q=${encodeURIComponent(trimmed)}`
  );
  if (res.success && res.data) return res;
  if (useMockFallback(res.error)) {
    const hits = await buildMockSearchHits(trimmed);
    return { success: true, data: { hits } };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function searchSessionMessages(
  sessionId: string,
  query: string
): Promise<SessionMessageSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetchAgentMessages(sessionId);
  if (!res.success || !res.data?.messages?.length) return [];

  const hits: SessionMessageSearchHit[] = [];
  for (let index = 0; index < res.data.messages.length; index += 1) {
    const message = res.data.messages[index];
    const content = message.content ?? '';
    if (!content || !matchesQuery(content, trimmed)) continue;
    const role = message.role ?? 'assistant';
    const idx = content.toLowerCase().indexOf(trimmed.toLowerCase());
    const start = Math.max(0, idx - 24);
    const end = Math.min(content.length, idx + trimmed.length + 48);
    const snippet =
      (start > 0 ? '…' : '') +
      content.slice(start, end) +
      (end < content.length ? '…' : '');
    hits.push({
      message_id: message.id ?? `msg_${index}`,
      role,
      snippet,
    });
  }
  return hits;
}
