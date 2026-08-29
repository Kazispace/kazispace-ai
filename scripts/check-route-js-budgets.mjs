#!/usr/bin/env node
/**
 * KAZI-654 — per-route first-load JS budgets (decoded bytes) for the routes
 * with the worst recent perf incidents: Space, Interview, English, CV.
 * Same measurement approach as scripts/check-clinic-js-budget.mjs (KAZI-567),
 * generalized to check several `app-build-manifest.json` page keys instead
 * of just the public Clinic entry points. Runs after `next build`.
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

function collectRouteFiles(pageKey) {
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

function measureRoute({ page_key: pageKey }) {
  const listed = collectRouteFiles(pageKey);
  let total = 0;
  const measured = [];
  for (const rel of listed) {
    const size = fileSize(rel);
    if (size > 0) {
      total += size;
      measured.push({ rel, size });
    }
  }

  // Fallback: all static chunks if the manifest didn't resolve the page key.
  if (total === 0) {
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
    console.log(
      `KAZI-654 ${routeName} (${budget.page_key}) first-load JS: ${kb} KB decoded (${measured.length} files); budget ${budgetKb} KB decoded`
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
