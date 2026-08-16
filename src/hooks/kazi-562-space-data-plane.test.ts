import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-562 — Space detail + history must share cache / abort on switch.
 */
describe('KAZI-562 space detail share + history warm/abort', () => {
  it('useSpaceDetail uses TanStack Query shared key', () => {
    const src = readFileSync(
      path.resolve(__dirname, './use-space-detail.ts'),
      'utf8'
    );
    expect(src).toMatch(/@tanstack\/react-query/);
    expect(src).toMatch(/space-detail/);
    expect(src).toMatch(/CLINIC_SPACE_ID/);
    expect(src).toMatch(/staleTime:\s*30_000/);
  });

  it('useSpaceTurn aborts history fetch and reuses warm slice', () => {
    const src = readFileSync(
      path.resolve(__dirname, './use-space-turn.ts'),
      'utf8'
    );
    expect(src).toMatch(/AbortController/);
    expect(src).toMatch(/abort\.abort\(\)/);
    expect(src).toMatch(/hasWarmCache/);
    expect(src).toMatch(/cached\.messages\.length\s*>\s*0/);
    expect(src).toMatch(/cached\.masterSessionId === resolvedMasterId/);
  });
});
