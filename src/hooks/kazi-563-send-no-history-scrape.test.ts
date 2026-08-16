import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-563 — success path must not 3× recover or always scrape full history.
 */
describe('KAZI-563 space send path no full-history scrape', () => {
  it('limits placeholder recovery via named perf policy', () => {
    const policy = readFileSync(
      path.resolve(__dirname, '../lib/spaces/perf-policy.ts'),
      'utf8'
    );
    expect(policy).toMatch(/SPACE_HISTORY_RECOVERY_ATTEMPTS\s*=\s*1/);

    const src = readFileSync(
      path.resolve(__dirname, './use-space-turn.ts'),
      'utf8'
    );
    expect(src).toMatch(/SPACE_HISTORY_RECOVERY_ATTEMPTS/);
    expect(src).not.toMatch(/HISTORY_RECOVERY_DELAY_MS/);
    expect(src).not.toMatch(/HISTORY_RECOVERY_ATTEMPTS\s*=\s*3/);
  });

  it('skips post-send history refresh when turn is authoritative', () => {
    const src = readFileSync(
      path.resolve(__dirname, './use-space-turn.ts'),
      'utf8'
    );
    expect(src).toMatch(/turnAuthoritative/);
    expect(src).toMatch(/isServerAssistantMessageId\(assistantMessageId\)/);
    expect(src).toMatch(/useSpaceHistoryQuery/);
  });
});
