#!/usr/bin/env node
/**
 * KAZI-654 — JS budgets (decoded bytes) for the bundles behind the routes
 * with the worst recent perf incidents: Space, Interview, English, CV.
 *
 * File-resolution mechanics (readJson/fileSize/manifest reading) live in
 * scripts/lib/js-budget-measure.mjs, shared with check-clinic-js-budget.mjs
 * (KAZI-665) — this script only decides *which* files each route's budget
 * asks about, via the two modes below.
 *
 * Two measurement modes, because "first-load JS for this page" is not the
 * same question for every route here (review finding on PR #209 — thanks,
 * this caught a real gap):
 *
 * - `page_key` mode (interview, english, space): same approach as
 *   scripts/check-clinic-js-budget.mjs (KAZI-567) — sum the files
 *   `app-build-manifest.json` lists as first-load JS for that page.
 *   `spaces/[spaceId]/page.tsx` itself renders nothing (KAZI-573: its
 *   layout hosts `SpaceWorkspaceKeepAlive`, which *statically* imports
 *   `SpaceWorkspace` — eagerly, for every route under `(workspace)`). So
 *   this "space" number is really gating that eager import's weight, not
 *   route-owned code — legitimate to gate, just not what the label implies
 *   on its own; see the JSON's `budget_policy`/`scope_note` fields.
 *
 * - `loadable_key` mode (cv): `/[locale]/(workspace)/cv/page.tsx` is a
 *   redirect-only stub (real CV UI never renders there), so measuring its
 *   page_key was actually re-measuring the same shared "space" graph above
 *   under a different name — it caught nothing CV-specific. The actual CV
 *   builder (`CvWorkspaceRail`) is its own `next/dynamic()` chunk mounted
 *   from Clinic's chat-side-rails-host.tsx, never part of any page's
 *   first-load graph. `.next/react-loadable-manifest.json` maps that
 *   dynamic import's source location to its real chunk file list — that's
 *   what this mode measures instead.
 *
 * What "space" is actually gating (review finding on PR #209): its page_key
 * (`spaces/[spaceId]/page.tsx`) renders `null` — its whole measured total is
 * the *shared* (workspace) layout tax (SessionNav + SpaceWorkspaceKeepAlive,
 * which eagerly imports `SpaceWorkspace`) that interview/english/cv also pay
 * as part of their own totals. "space" is the most sensitive detector for a
 * regression there (its budget has the least headroom relative to a graph
 * that's ~100% shared chunks), but interview/english would eventually trip
 * too if that shared tax grew enough. This is intentional: KAZI-573 made
 * `SpaceWorkspaceKeepAlive` an eager import for every workspace route, so
 * gating its weight via the cheapest page to measure it from is legitimate.
 *
 * Budgets here are a starting gate, not a target size (see
 * route-js-budgets.json's `budget_policy`) — see also `scope_note` there for
 * why Hub/login/Clinic aren't gated by this script.
 *
 * Runs after `next build`.
 *
 *   node scripts/check-route-js-budgets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  readJson,
  collectManifestFiles,
  collectLoadableFiles,
  measureFiles,
  measureAllStaticChunks,
} from './lib/js-budget-measure.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = path.join(ROOT, '.next');
const OPTIONAL = process.argv.includes('--optional');
const BUDGET_PATH = path.join(ROOT, 'src/lib/perf/route-js-budgets.json');

const routeBudgets = readJson(BUDGET_PATH).routes;

function measureRoute(budget) {
  if (budget.loadable_key) {
    // collectLoadableFiles throws loud on a missing/stale entry — never
    // silently falls through to the static-chunk fallback below.
    return measureFiles(NEXT_DIR, ROOT, collectLoadableFiles(NEXT_DIR, budget.loadable_key));
  }

  const listed = collectManifestFiles(NEXT_DIR, (pageKey) => pageKey === budget.page_key);
  const result = measureFiles(NEXT_DIR, ROOT, listed);
  // Fallback: all static chunks if page_key mode didn't resolve any files.
  return result.total === 0 ? measureAllStaticChunks(NEXT_DIR) : result;
}

// CI runs `npm test` (this in --optional mode) *before* `npm run build` —
// and `next lint` (which runs even earlier) leaves behind a stub `.next`
// (cache dir, no manifests) that makes `fs.existsSync(NEXT_DIR)` true on its
// own. --optional must treat "no usable build" the same whether `.next` is
// completely absent or just a lint-stage stub, or collectLoadableFiles's
// deliberately-loud throw for a missing manifest fires on every CI test run,
// not just on a genuinely stale config (PR #209 review round 3).
function hasUsableNextBuild() {
  return (
    fs.existsSync(path.join(NEXT_DIR, 'app-build-manifest.json')) &&
    fs.existsSync(path.join(NEXT_DIR, 'react-loadable-manifest.json'))
  );
}

function main() {
  if (!fs.existsSync(NEXT_DIR) || (OPTIONAL && !hasUsableNextBuild())) {
    if (OPTIONAL) {
      console.log('KAZI-654 route JS budgets skipped (no full .next build; --optional)');
      return;
    }
    console.error('KAZI-654 route JS budgets: .next missing. Run next build first.');
    process.exit(1);
  }

  let failed = false;

  for (const [routeName, budget] of Object.entries(routeBudgets)) {
    const { total, measured } = measureRoute(budget);
    const kb = (total / 1024).toFixed(1);
    const budgetKb = (budget.first_js_decoded_bytes / 1024).toFixed(0);
    const targetKey = budget.loadable_key ?? budget.page_key;
    const label = budget.loadable_key ? 'loadable chunk' : 'first-load JS';
    console.log(
      `KAZI-654 ${routeName} (${targetKey}) ${label}: ${kb} KB decoded (${measured.length} files); budget ${budgetKb} KB decoded`
    );

    if (total > budget.first_js_decoded_bytes) {
      measured
        .sort((a, b) => b.size - a.size)
        .slice(0, 15)
        .forEach((row) => {
          console.error(`  ${(row.size / 1024).toFixed(1)} KB  ${row.rel}`);
        });
      console.error(`KAZI-654 ${routeName} JS budget FAILED`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log('KAZI-654 route JS budgets OK');
}

main();
