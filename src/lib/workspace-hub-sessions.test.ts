import { describe, expect, it } from 'vitest';

import { partitionSessionsByRecency, sortSessionsNewestFirst } from '@/lib/workspace-hub-sessions';
import type { AgentSessionSummary } from '@/types';

function session(
  id: string,
  updated_at: string | null
): AgentSessionSummary {
  return {
    session_id: id,
    agent_id: 'cv_builder',
    status: 'active',
    title: id,
    updated_at,
  };
}

describe('workspace-hub-sessions', () => {
  it('sorts by updated_at descending', () => {
    const sorted = sortSessionsNewestFirst([
      session('a', '2026-01-01T00:00:00Z'),
      session('b', '2026-06-01T00:00:00Z'),
    ]);
    expect(sorted.map((s) => s.session_id)).toEqual(['b', 'a']);
  });

  it('partitions recent vs older', () => {
    const list = Array.from({ length: 8 }, (_, i) =>
      session(`s${i}`, `2026-01-0${i + 1}T00:00:00Z`)
    );
    const { recent, older } = partitionSessionsByRecency(list, 6);
    expect(recent).toHaveLength(6);
    expect(older).toHaveLength(2);
  });
});
