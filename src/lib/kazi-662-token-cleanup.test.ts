import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

/**
 * KAZI-662 — regression guard for the near-neighbor hex color sweep.
 * Not a general "no bare hex colors" gate (chart/data-viz colors and
 * global-error.tsx's necessarily-inline styles are legitimately out of
 * scope, see the ticket) — this only pins down the specific literals this
 * ticket resolved, so they can't silently drift back in.
 */

const SRC_DIR = path.resolve(__dirname, '../..', 'src');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_SOURCE_FILES = walk(SRC_DIR);

function occurrencesOf(hex: string): { file: string; line: number }[] {
  const pattern = new RegExp(hex, 'i');
  const hits: { file: string; line: number }[] = [];
  for (const file of ALL_SOURCE_FILES) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (pattern.test(line)) hits.push({ file: path.relative(SRC_DIR, file), line: index + 1 });
    });
  }
  return hits;
}

describe('KAZI-662 resolved near-neighbor hex literals do not reappear as bracket classes', () => {
  const mergedAway = [
    '#F7F8FA',
    '#C9CDD4',
    '#ECEEF2',
    '#E8F3FF',
    '#E0E3E8',
  ] as const;

  for (const hex of mergedAway) {
    it(`${hex} no longer appears as a literal Tailwind value`, () => {
      const hits = occurrencesOf(`\\[${hex}\\]`);
      expect(hits, JSON.stringify(hits)).toEqual([]);
    });
  }

  it('#FAFAFA no longer appears as a literal Tailwind value (merged into workspace-header)', () => {
    const hits = occurrencesOf('\\[#FAFAFA\\]');
    expect(hits, JSON.stringify(hits)).toEqual([]);
  });

  it('keeps exactly the two deliberately-preserved literals (#D0E3FF, #D0D3D9) and no more', () => {
    // These are confirmed-intentional one-off design choices (see inline
    // comments), not near-neighbors — this test isn't asking them to go
    // away, just pinning the count so a silent third instance is caught.
    expect(occurrencesOf('border-\\[#D0E3FF\\]')).toHaveLength(1);
    expect(occurrencesOf('border-\\[#D0D3D9\\]')).toHaveLength(1);
  });
});

describe('KAZI-662 new workspace tokens are wired up', () => {
  const tailwindConfig = readFileSync(
    path.resolve(SRC_DIR, '..', 'tailwind.config.ts'),
    'utf8'
  );

  it('defines workspace.placeholder (#C9CDD4, promoted from an 8-site literal)', () => {
    expect(tailwindConfig).toMatch(/placeholder:\s*'#C9CDD4'/);
  });

  it('keeps workspace.secondary formally adopted, not flagged pending sign-off', () => {
    expect(tailwindConfig).toMatch(/secondary:\s*'#4E5969'/);
    expect(tailwindConfig).not.toMatch(/pending design sign-off/i);
  });

  it('at least one call site uses workspace-placeholder (the token isn\'t dead)', () => {
    const hits = occurrencesOf('workspace-placeholder');
    expect(hits.length).toBeGreaterThan(0);
  });
});
