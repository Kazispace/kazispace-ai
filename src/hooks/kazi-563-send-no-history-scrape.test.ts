import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-563 — success path wiring (runtime coverage in space-send-history.test.ts).
 */
describe('KAZI-563 space send path wiring', () => {
  it('limits placeholder recovery via named perf policy', () => {
    const policy = readFileSync(
      path.resolve(__dirname, '../lib/spaces/perf-policy.ts'),
      'utf8'
    );
    expect(policy).toMatch(/SPACE_HISTORY_RECOVERY_ATTEMPTS\s*=\s*1/);
  });

  it('useSpaceTurn uses resolveSpaceSendHistory helper', () => {
    const src = readFileSync(
      path.resolve(__dirname, './use-space-turn.ts'),
      'utf8'
    );
    expect(src).toMatch(/resolveSpaceSendHistory/);
    expect(src).toMatch(/useSpaceHistoryQuery/);
    expect(src).toMatch(/skipHistoryRefresh/);
  });
});
