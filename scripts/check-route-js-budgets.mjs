#!/usr/bin/env node
/**
 * KAZI-654 — JS budgets (decoded bytes) for the bundles behind the routes
 * with the worst recent perf incidents: Space, Interview, English, CV.
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
 *   on its own; see the JSON's `measures` field.
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
 * Runs after `next build`.
 *
 *   node scripts/check-route-js-budgets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = path.join(ROOT, '.next');
const OPTIONAL = process.argv.includes('--optional');
const BUDGET_PATH = path.join(ROOT, 'src/lib/perf/route-js-budgets.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const routeBudgets = readJson(BUDGET_PATH).routes;

function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

function collectPageKeyFiles(pageKey) {
  const files = new Set();
  const buildManifest = path.join(NEXT_DIR, 'build-manifest.json');
  const appBuildManifest = path.join(NEXT_DIR, 'app-build-manifest.json');

  if (fs.existsSync(buildManifest)) {
    const manifest = readJson(buildManifest);
    for (const key of ['polyfillFiles', 'lowPriorityFiles', 'rootMainFiles']) {
      for (const file of manifest[key] ?? []) files.add(file);
    }
  }

  if (fs.existsSync(appBuildManifest)) {
    const manifest = readJson(appBuildManifest);
    const pageFiles = manifest.pages?.[pageKey];
    if (Array.isArray(pageFiles)) {
      for (const file of pageFiles) files.add(file);
    }
  }

  return [...files].filter((file) => file.endsWith('.js'));
}

function collectLoadableFiles(loadableKey) {
  const loadableManifestPath = path.join(NEXT_DIR, 'react-loadable-manifest.json');
  if (!fs.existsSync(loadableManifestPath)) {
    throw new Error('react-loadable-manifest.json missing — run next build first.');
  }
  const manifest = readJson(loadableManifestPath);
  const entry = manifest[loadableKey];
  if (!entry || !Array.isArray(entry.files)) {
    // Fail loud, not silent: a missing entry means the dynamic import this
    // budget targets was renamed/moved/removed, and the config is stale —
    // NOT that its bundle shrank to zero. Falling back to "measure
    // everything" (like page_key mode does) would report a nonsense total
    // for a single-chunk target; better to force the budget config to be
    // updated to match the real import.
    throw new Error(
      `react-loadable-manifest.json has no entry "${loadableKey}" — update route-js-budgets.json to the current dynamic import's source path.`
    );
  }
  return entry.files.filter((file) => file.endsWith('.js'));
}

function fileSize(rel) {
  const candidates = [
    path.join(NEXT_DIR, rel),
    path.join(NEXT_DIR, 'static', rel.replace(/^static\//, '')),
    path.join(ROOT, rel),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.statSync(candidate).size;
  }
  return 0;
}

function measureRoute(budget) {
  const listed = budget.loadable_key
    ? collectLoadableFiles(budget.loadable_key)
    : collectPageKeyFiles(budget.page_key);
  let total = 0;
  const measured = [];
  for (const rel of listed) {
    const size = fileSize(rel);
    if (size > 0) {
      total += size;
      measured.push({ rel, size });
    }
  }

  // Fallback: all static chunks if page_key mode didn't resolve any files.
  // (loadable_key mode never reaches here on a bad key — collectLoadableFiles
  // throws instead, so this only guards a page_key manifest miss.)
  if (total === 0 && !budget.loadable_key) {
    for (const file of walkJs(path.join(NEXT_DIR, 'static'))) {
      const size = fs.statSync(file).size;
      total += size;
      measured.push({ rel: path.relative(NEXT_DIR, file), size });
    }
  }

  return { total, measured };
}

function main() {
  if (!fs.existsSync(NEXT_DIR)) {
    if (OPTIONAL) {
      console.log('KAZI-654 route JS budgets skipped (no .next; --optional)');
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
