import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readSrc(rel: string) {
  return readFileSync(path.resolve(__dirname, rel), 'utf8');
}

describe('KAZI-580 wiring', () => {
  it('fetchChatHistory always goes through the window query builder', () => {
    const src = readSrc('../api-client.ts');
    expect(src).toMatch(/windowedHistoryQuery/);
    expect(src).toMatch(/buildChatHistoryQuery/);
    expect(src).toMatch(/limit/);
    expect(src).toMatch(/fields/);
    expect(src).toMatch(/ids/);
  });

  it('Space and Clinic hydrate stubs on scroll, not via timeout/opacity', () => {
    const pane = readSrc('../../components/spaces/space-chat-pane.tsx');
    const shell = readSrc('../../components/clinic/clinic-shell.tsx');
    expect(pane).toMatch(/useHistoryStubHydrate/);
    expect(pane).toMatch(/hydrateHistoryStubs/);
    expect(shell).toMatch(/useHistoryStubHydrate/);
    expect(shell).toMatch(/hydrateHistoryStubs/);
    expect(pane).not.toMatch(/setTimeout\s*\(/);
    expect(readSrc('../../hooks/use-history-stub-hydrate.ts')).toMatch(
      /IntersectionObserver/
    );
    expect(readSrc('../../hooks/use-history-stub-hydrate.ts')).toMatch(
      /MutationObserver/
    );
    expect(readSrc('../../hooks/use-history-stub-hydrate.ts')).not.toMatch(
      /setTimeout\s*\(/
    );
    expect(readSrc('../../hooks/use-history-stub-hydrate.ts')).toMatch(
      /HISTORY_STUB_HYDRATE_MAX_ATTEMPTS/
    );
    expect(readSrc('../../hooks/use-history-stub-hydrate.ts')).toMatch(
      /dataset\.failed/
    );
  });

  it('send path still must not scrape full history on success', () => {
    const src = readSrc('../../hooks/use-space-turn.ts');
    expect(src).toMatch(/skipHistoryRefresh/);
    expect(src).toMatch(/hydrateHistoryStubs/);
  });
});
