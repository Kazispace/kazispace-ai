import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-563 — success path must not 3× recover or always scrape full history.
 */
describe('KAZI-563 space send path no full-history scrape', () => {
  it('limits placeholder recovery to a single history read', () => {
    const src = readFileSync(
      path.resolve(__dirname, './use-space-turn.ts'),
      'utf8'
    );
    expect(src).toMatch(/HISTORY_RECOVERY_ATTEMPTS\s*=\s*1/);
    expect(src).not.toMatch(/HISTORY_RECOVERY_ATTEMPTS\s*=\s*3/);
    expect(src).not.toMatch(/HISTORY_RECOVERY_DELAY_MS/);
  });

  it('skips post-send history refresh when turn is authoritative', () => {
    const src = readFileSync(
      path.resolve(__dirname, './use-space-turn.ts'),
      'utf8'
    );
    expect(src).toMatch(/turnAuthoritative/);
    expect(src).toMatch(/isServerAssistantMessageId\(assistantMessageId\)/);
  });
});
