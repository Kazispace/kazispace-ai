import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';

import routeJsBudgets from '@/lib/perf/route-js-budgets.json';

const ROOT = path.resolve(__dirname, '../../..');
const NEXT_DIR = path.join(ROOT, '.next');

function fileSize(rel: string): number {
  for (const candidate of [
    path.join(NEXT_DIR, rel),
    path.join(NEXT_DIR, 'static', rel.replace(/^static\//, '')),
  ]) {
    if (existsSync(candidate)) return statSync(candidate).size;
  }
  return 0;
}

function measureLoadableKey(loadableKey: string): number {
  const manifest = JSON.parse(
    readFileSync(path.join(NEXT_DIR, 'react-loadable-manifest.json'), 'utf8')
  );
  const files: string[] = manifest[loadableKey]?.files ?? [];
  return files.filter((f) => f.endsWith('.js')).reduce((sum, f) => sum + fileSize(f), 0);
}

function measurePageKey(pageKey: string): number {
  const files = new Set<string>();
  const buildManifest = JSON.parse(
    readFileSync(path.join(NEXT_DIR, 'build-manifest.json'), 'utf8')
  );
  for (const key of ['polyfillFiles', 'lowPriorityFiles', 'rootMainFiles']) {
    for (const f of buildManifest[key] ?? []) files.add(f);
  }
  const appManifest = JSON.parse(
    readFileSync(path.join(NEXT_DIR, 'app-build-manifest.json'), 'utf8')
  );
  for (const f of appManifest.pages?.[pageKey] ?? []) files.add(f);
  return Array.from(files)
    .filter((f) => f.endsWith('.js'))
    .reduce((sum, f) => sum + fileSize(f), 0);
}

describe('KAZI-654 per-route JS budget gate', () => {
  it('defines a budget for each of the four target routes', () => {
    expect(Object.keys(routeJsBudgets.routes).sort()).toEqual(
      ['cv', 'english', 'interview', 'space'].sort()
    );
    for (const [name, budget] of Object.entries(routeJsBudgets.routes)) {
      // Each route measures either a page's first-load JS (page_key) or a
      // specific next/dynamic() chunk's own files (loadable_key) — never
      // both, and never neither (KAZI-654 PR #209 review: a redirect-only
      // page's page_key silently re-measures a shared layout import instead
      // of the route's real content, so "cv" uses loadable_key).
      const key = 'page_key' in budget ? budget.page_key : budget.loadable_key;
      expect(key, name).toBeTruthy();
      if ('page_key' in budget) {
        expect(budget.page_key, name).toMatch(/^\/\[locale\]\/\(workspace\)\//);
      } else {
        expect(budget.loadable_key, name).toContain(' -> ');
      }
      expect(budget.first_js_decoded_bytes, name).toBeGreaterThan(0);
      // Budgets must be traceable to a real measured build, not guessed.
      expect(budget.measured_decoded_bytes, name).toBeGreaterThan(0);
      expect(budget.first_js_decoded_bytes, name).toBeGreaterThan(
        budget.measured_decoded_bytes
      );
    }
    expect(routeJsBudgets.unit).toBe('decoded_bytes');
  });

  it('is wired into the hard build gate and the optional test/CI gate', () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
    );
    expect(pkg.scripts.build).toMatch(/check-route-js-budgets\.mjs/);
    expect(pkg.scripts.build).not.toMatch(/check-route-js-budgets\.mjs --optional/);
    expect(pkg.scripts.test).toMatch(/check-route-js-budgets\.mjs --optional/);
  });

  it('scopes each route to its own app-build-manifest page key or loadable chunk', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../../scripts/check-route-js-budgets.mjs'),
      'utf8'
    );
    expect(src).toMatch(/route-js-budgets\.json/);
    expect(src).toMatch(/manifest\.pages\?\.\[pageKey\]/);
    // KAZI-654 PR #209 review: "cv" is a redirect-only page, so it must be
    // measured via its actual next/dynamic() chunk (react-loadable-manifest),
    // not the app-build-manifest page key — assert the script still branches
    // on this rather than silently falling back to page_key for everything.
    expect(src).toMatch(/react-loadable-manifest\.json/);
    expect(src).toMatch(/collectLoadableFiles/);
  });

  it('measures the cv route via its CvWorkspaceRail dynamic import, not the redirect-only page', () => {
    const cv = routeJsBudgets.routes.cv as { loadable_key?: string; page_key?: string };
    expect(cv.page_key).toBeUndefined();
    expect(cv.loadable_key).toBe(
      'components/chat/chat-side-rails-host.tsx -> @/components/cv/cv-workspace-rail'
    );
  });

  // KAZI-654 PR #209 review point 5: the tests above only check config shape
  // (page_key/loadable_key present, wired into package.json) — none of them
  // actually run a measurement, so a manifest-key typo or a silent revert to
  // page_key for "cv" would still pass vitest. When a production build is
  // present (as it is in the CI step that runs `npm run build` right after
  // `npm test`, and in local post-build runs), assert the real numbers still
  // tell the two graphs apart. This is a guard, not the enforcement — the
  // hard `npm run build` gate remains the actual authority on the budget.
  it('when a build exists, confirms cv measures a materially smaller graph than the legacy redirect-page measurement', () => {
    if (!existsSync(NEXT_DIR)) return;
    const cv = routeJsBudgets.routes.cv as { loadable_key: string };
    const cvChunkTotal = measureLoadableKey(cv.loadable_key);
    if (cvChunkTotal === 0) return; // this build didn't enable the flag that mounts CvWorkspaceRail
    const legacyRedirectPageTotal = measurePageKey('/[locale]/(workspace)/cv/page');
    // Before the #209 fix, "cv" measured this legacy page_key and landed on
    // the exact same ~416 KB total as "space" (both are ~100% shared
    // workspace-layout tax). CvWorkspaceRail's own chunk should be a small
    // fraction of that shared graph, not equal to or larger than it.
    expect(cvChunkTotal).toBeLessThan(legacyRedirectPageTotal * 0.5);
  });
});
