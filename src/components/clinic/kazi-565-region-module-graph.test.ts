import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');

function readSrc(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

/**
 * KAZI-565 module-graph gates (R2): YAML parser must not sit on the
 * Providers → store → auth → session cold path; bundled directory is JSON.
 */
describe('KAZI-565 region directory module graph', () => {
  it('directory.ts loads JSON and does not import yaml', () => {
    const src = readSrc('lib/region/directory.ts');
    expect(src).toMatch(/directory\.bundled\.json/);
    expect(src).not.toMatch(/from ['"]yaml['"]/);
    expect(src).not.toMatch(/directory\.bundled\.yaml/);
    expect(src).not.toMatch(/parseYaml/);
  });

  it('store and auth use region/session leaf — not region barrel', () => {
    const store = readSrc('lib/store.ts');
    expect(store).toMatch(/from ['"]\.\/region\/session['"]/);
    expect(store).not.toMatch(/from ['"]\.\/region['"]/);

    const auth = readSrc('lib/auth.ts');
    expect(auth).toMatch(/from ['"]\.\/region\/session['"]/);
    expect(auth).not.toMatch(/from ['"]\.\/region['"]/);
  });

  it('Providers cold path: no static region barrel; idle dynamic import only', () => {
    const providers = readSrc('components/providers.tsx');
    expect(providers).not.toMatch(
      /import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/region['"]/
    );
    expect(providers).toMatch(/import\(['"]@\/lib\/region['"]\)/);

    // Walk Providers → store → auth → session static imports for yaml.
    const chain = [
      readSrc('lib/store.ts'),
      readSrc('lib/auth.ts'),
      readSrc('lib/region/session.ts'),
      readSrc('lib/region/directory.ts'),
    ].join('\n');
    expect(chain).not.toMatch(/from ['"]yaml['"]/);
  });

  it('bundled JSON exists and matches directory_version', () => {
    const json = JSON.parse(
      readSrc('lib/region/directory.bundled.json')
    ) as { directory_version: number; regions: unknown[] };
    expect(json.directory_version).toBe(4);
    expect(json.regions.length).toBeGreaterThan(0);
  });

  it('RUM policy uses region leaves — not the barrel or yaml', () => {
    const policy = readSrc('lib/region/rum-policy.ts');
    const reporter = readSrc('components/perf/web-vitals-reporter.tsx');
    expect(policy).toMatch(/from ['"]\.\/directory['"]/);
    expect(policy).toMatch(/from ['"]\.\/session['"]/);
    expect(policy).not.toMatch(/from ['"]@\/lib\/region['"]/);
    expect(policy).not.toMatch(/from ['"]yaml['"]/);
    expect(reporter).toMatch(/from ['"]@\/lib\/region\/rum-policy['"]/);
    expect(reporter).not.toMatch(/from ['"]@\/lib\/region['"]/);
  });

  it('YAML mirror and JSON snapshot are semantically equal', () => {
    const { spawnSync } = require('child_process') as typeof import('child_process');
    const result = spawnSync(
      process.execPath,
      ['scripts/sync-region-directory.mjs', '--check'],
      { cwd: path.resolve(root, '..'), encoding: 'utf8' }
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toMatch(/YAML↔JSON snapshot OK/);
  });
});
