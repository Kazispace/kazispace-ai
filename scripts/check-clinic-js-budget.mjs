#!/usr/bin/env node
/**
 * KAZI-567 — public Clinic first-load JS budget (decoded bytes).
 * Runs after `next build`. Skips (exit 0) only when --optional and no .next.
 *
 *   node scripts/check-clinic-js-budget.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = path.join(ROOT, '.next');
const OPTIONAL = process.argv.includes('--optional');
const BUDGET_PATH = path.join(ROOT, 'src/lib/perf/clinic-js-budget.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const clinicJsBudget = readJson(BUDGET_PATH);
const PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES =
  clinicJsBudget.public_clinic_first_js_decoded_bytes;
const TRANSFER_HINT_BYTES =
  clinicJsBudget.public_clinic_first_js_transfer_hint_bytes;

function walkJs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

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

function collectFirstLoadFiles() {
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
    for (const [pageKey, pageFiles] of Object.entries(manifest.pages ?? {})) {
      if (!isClinicFirstLoadPage(pageKey) || !Array.isArray(pageFiles)) continue;
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

function main() {
  if (!fs.existsSync(NEXT_DIR)) {
    if (OPTIONAL) {
      console.log('KAZI-567 JS budget skipped (no .next; --optional)');
      return;
    }
    console.error('KAZI-567 JS budget: .next missing. Run next build first.');
    process.exit(1);
  }

  const listed = collectFirstLoadFiles();
  let total = 0;
  const measured = [];
  for (const rel of listed) {
    const size = fileSize(rel);
    if (size > 0) {
      total += size;
      measured.push({ rel, size });
    }
  }

  // Fallback: all static chunks if manifests did not resolve files.
  if (total === 0) {
    for (const file of walkJs(path.join(NEXT_DIR, 'static'))) {
      const size = fs.statSync(file).size;
      total += size;
      measured.push({ rel: path.relative(NEXT_DIR, file), size });
    }
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
