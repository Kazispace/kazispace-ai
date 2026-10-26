/**
 * KAZI-1171 (Owen 2026-10-26): `/english` is gone — no page, no entry. This pins it:
 * no route folder, no link to it anywhere in `src`, and old URLs redirect to Studio.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const ROOT = path.resolve(SRC, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|json)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('KAZI-1171 — no /english', () => {
  it('has no route folder', () => {
    expect(existsSync(path.join(SRC, 'app/[locale]/(workspace)/english'))).toBe(false);
  });

  it('nothing in src links to /english', () => {
    // A path segment, ⛔ API paths (`/api/v1/english/...`) or module paths (`@/components/english/...`).
    const link = /[`'"]\/(?:\$\{[^}]+\}|[a-z]{2})\/english\b|\/\$\{locale\}\/english\b/;
    const hits = files(SRC).filter((f) => link.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it('old URLs redirect to Studio', async () => {
    const config = (await import(path.join(ROOT, 'next.config.js'))).default as {
      redirects: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>>;
    };
    const rules = await config.redirects();
    expect(rules).toEqual(
      expect.arrayContaining([
        { source: '/:locale/english', destination: '/:locale/clinic/hub', permanent: false },
        { source: '/:locale/english/:path*', destination: '/:locale/clinic/hub', permanent: false },
      ])
    );
  });
});
