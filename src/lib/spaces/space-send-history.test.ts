import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { SPACE_HISTORY_RECOVERY_ATTEMPTS } from '@/lib/spaces/perf-policy';
import { resolveSpaceSendHistory } from '@/lib/spaces/space-send-history';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

function historyWithAssistant(content: string): SpaceChatMessage[] {
  return [
    { id: 'u1', role: 'user', content: 'hi' },
    { id: 'a1', role: 'assistant', content },
  ];
}

describe('KAZI-563 space send history runtime', () => {
  it('authoritative response: 0 history fetches', async () => {
    const fetchHistory = vi.fn(async () => historyWithAssistant('should not run'));
    const outcome = await resolveSpaceSendHistory({
      reply: 'Hello from turn',
      assistantMessageId: '10482',
      fetchHistory,
    });
    expect(fetchHistory).toHaveBeenCalledTimes(0);
    expect(outcome.skipHistoryRefresh).toBe(true);
    expect(outcome.pending).toBe(false);
    expect(outcome.reply).toBe('Hello from turn');
  });

  it('placeholder: at most SPACE_HISTORY_RECOVERY_ATTEMPTS fetches', async () => {
    const fetchHistory = vi.fn(async () => historyWithAssistant('…'));
    const outcome = await resolveSpaceSendHistory({
      reply: '…',
      assistantMessageId: undefined,
      fetchHistory,
      recoveryAttempts: SPACE_HISTORY_RECOVERY_ATTEMPTS,
    });
    expect(fetchHistory).toHaveBeenCalledTimes(SPACE_HISTORY_RECOVERY_ATTEMPTS);
    expect(outcome.pending).toBe(true);
    expect(outcome.skipHistoryRefresh).toBe(true);
  });

  it('placeholder recovers in one shared fetch then skips extra scrape', async () => {
    const fetchHistory = vi.fn(async () =>
      historyWithAssistant('Recovered reply')
    );
    const outcome = await resolveSpaceSendHistory({
      reply: '...',
      assistantMessageId: undefined,
      fetchHistory,
    });
    expect(fetchHistory).toHaveBeenCalledTimes(1);
    expect(outcome.recoveredFromHistory).toBe(true);
    expect(outcome.reply).toBe('Recovered reply');
    expect(outcome.pending).toBe(false);
    // History already in hand — no second reconcile fetch inside helper.
    expect(fetchHistory).toHaveBeenCalledTimes(1);
  });

  it('missing server message id: exactly one reconciliation fetch', async () => {
    const fetchHistory = vi.fn(async () =>
      historyWithAssistant('From history')
    );
    const outcome = await resolveSpaceSendHistory({
      reply: 'Turn reply without id',
      assistantMessageId: 'local_tmp',
      fetchHistory,
    });
    expect(fetchHistory).toHaveBeenCalledTimes(1);
    expect(outcome.skipHistoryRefresh).toBe(false);
    expect(outcome.pending).toBe(false);
    expect(outcome.history).toHaveLength(2);
  });

  it('useSpaceTurn wires resolveSpaceSendHistory (no inline 3× loop)', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../hooks/use-space-turn.ts'),
      'utf8'
    );
    expect(src).toMatch(/resolveSpaceSendHistory/);
    expect(src).not.toMatch(/HISTORY_RECOVERY_DELAY_MS/);
    expect(src).not.toMatch(/HISTORY_RECOVERY_ATTEMPTS\s*=\s*3/);
  });
});
