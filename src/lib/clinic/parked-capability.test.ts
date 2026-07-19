import { describe, expect, it } from 'vitest';

import {
  isParkInteractiveAgentId,
  isParkedInteractiveSession,
  needsParkReplaceConfirm,
  selectParkedInteractiveSession,
} from '@/lib/clinic/parked-capability';
import type { AgentSessionSummary } from '@/types';

function session(
  partial: Partial<AgentSessionSummary> &
    Pick<AgentSessionSummary, 'session_id' | 'agent_id'>
): AgentSessionSummary {
  return {
    status: 'active',
    title: 't',
    ...partial,
  };
}

describe('isParkInteractiveAgentId', () => {
  it('accepts MVP interactive ids', () => {
    expect(isParkInteractiveAgentId('job_search')).toBe(true);
    expect(isParkInteractiveAgentId('cv_builder')).toBe(true);
    expect(isParkInteractiveAgentId('web_search')).toBe(false);
  });
});

describe('isParkedInteractiveSession', () => {
  it('requires active + parked', () => {
    expect(
      isParkedInteractiveSession(
        session({ session_id: '1', agent_id: 'job_search', parked: true })
      )
    ).toBe(true);
    expect(
      isParkedInteractiveSession(
        session({ session_id: '1', agent_id: 'job_search', parked: false })
      )
    ).toBe(false);
    expect(
      isParkedInteractiveSession(
        session({
          session_id: '1',
          agent_id: 'job_search',
          status: 'exited',
          parked: true,
        })
      )
    ).toBe(false);
  });

  it('ignores delivery lifecycle_kind', () => {
    expect(
      isParkedInteractiveSession(
        session({
          session_id: '1',
          agent_id: 'web_search',
          parked: true,
          lifecycle_kind: 'delivery',
        })
      )
    ).toBe(false);
  });
});

describe('selectParkedInteractiveSession', () => {
  it('returns latest parked interactive', () => {
    const picked = selectParkedInteractiveSession([
      session({
        session_id: 'a',
        agent_id: 'job_search',
        parked: true,
        updated_at: '2026-07-01T00:00:00Z',
      }),
      session({
        session_id: 'b',
        agent_id: 'cv_builder',
        parked: true,
        updated_at: '2026-07-02T00:00:00Z',
      }),
    ]);
    expect(picked?.session_id).toBe('b');
  });
});

describe('needsParkReplaceConfirm', () => {
  const parked = session({
    session_id: '1',
    agent_id: 'job_search',
    parked: true,
  });

  it('requires confirm when opening a different interactive', () => {
    expect(needsParkReplaceConfirm(parked, 'cv_builder')).toBe(true);
  });

  it('skips confirm when resuming the same agent', () => {
    expect(needsParkReplaceConfirm(parked, 'job_search')).toBe(false);
  });

  it('skips for non-interactive targets', () => {
    expect(needsParkReplaceConfirm(parked, 'web_search')).toBe(false);
  });
});
