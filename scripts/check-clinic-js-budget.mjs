#!/usr/bin/env node
/**
 * KAZI-567 — public Clinic first-load JS budget (decoded bytes).
 * Runs after `next build`. Skips (exit 0) only when --optional and no .next.
 *
 * File-resolution mechanics (readJson/fileSize/manifest reading) live in
 * scripts/lib/js-budget-measure.mjs, shared with check-route-js-budgets.mjs
 * (KAZI-665) — only the "which page keys count as Clinic's first load"
 * predicate below is specific to this script.
 *
 *   node scripts/check-clinic-js-budget.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  readJson,
  collectManifestFiles,
  measureFiles,
  measureAllStaticChunks,
} from './lib/js-budget-measure.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = path.join(ROOT, '.next');
const OPTIONAL = process.argv.includes('--optional');
const BUDGET_PATH = path.join(ROOT, 'src/lib/perf/clinic-js-budget.json');

const clinicJsBudget = readJson(BUDGET_PATH);
const PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES =
  clinicJsBudget.public_clinic_first_js_decoded_bytes;
const TRANSFER_HINT_BYTES =
  clinicJsBudget.public_clinic_first_js_transfer_hint_bytes;

/** Public Clinic first paint: locale home (redirect) + /chat. */
function isClinicFirstLoadPage(key) {
  const normalized = String(key);
  return (
    normalized === '/[locale]/page' ||
    normalized.endsWith('/[locale]/page') ||
    normalized.includes('/(workspace)/chat') ||
    /\/chat\/page$/.test(normalized)
  );
}

function main() {
  if (!fs.existsSync(NEXT_DIR)) {
    if (OPTIONAL) {
      console.log('KAZI-567 JS budget skipped (no .next; --optional)');
      return;
    }
    console.error('KAZI-567 JS budget: .next missing. Run next build first.');
    process.exit(1);
  }

  const listed = collectManifestFiles(NEXT_DIR, isClinicFirstLoadPage);
  let { total, measured } = measureFiles(NEXT_DIR, ROOT, listed);

  // Fallback: all static chunks if manifests did not resolve files.
  if (total === 0) {
    ({ total, measured } = measureAllStaticChunks(NEXT_DIR));
  }

  const kb = (total / 1024).toFixed(1);
  const budgetKb = (PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES / 1024).toFixed(0);
  const hintKb = (TRANSFER_HINT_BYTES / 1024).toFixed(0);
  console.log(
    `KAZI-567 Clinic first-load JS: ${kb} KB decoded (${measured.length} files); budget ${budgetKb} KB decoded; transfer hint ${hintKb} KB (not a gate)`
  );

  if (total > PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES) {
    measured
      .sort((a, b) => b.size - a.size)
      .slice(0, 15)
      .forEach((row) => {
        console.error(`  ${(row.size / 1024).toFixed(1)} KB  ${row.rel}`);
      });
    console.error('KAZI-567 JS budget FAILED');
    process.exit(1);
  }

  console.log('KAZI-567 JS budget OK');
}

main();
