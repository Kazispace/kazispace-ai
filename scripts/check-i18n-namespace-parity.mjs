#!/usr/bin/env node
/**
 * KAZI-657 — catch a locale message file silently losing a whole top-level
 * namespace (this is exactly how zh.json ended up missing billing/ledger/
 * jobs/referral/paywall/subscription/credits/nba/workflow/tma: merge-messages.ts
 * falls back to English per-key, so a missing namespace never crashes and
 * nobody notices until a user reports "why is this screen in English").
 *
 * Hard gate: zh.json only, since that's the locale this ticket brought to
 * full namespace parity with real (not machine-translated) Chinese.
 *
 * While building this check we found ru.json is at full namespace parity
 * already, but kk.json and uz.json are each missing the entire `spaces`
 * namespace (154 keys) — the same bug class this ticket fixed for zh, just
 * in two other locales. Translating ~150 keys of production UI copy into
 * Kazakh/Uzbek isn't something to do without a native speaker (see this
 * ticket's own guidance against shipping pure MT), so that's flagged as a
 * warning here rather than silently fixed or silently ignored — tracked as
 * KAZI-666 (non-blocking; add 'kk'/'uz' to HARD_GATE_LOCALES once that
 * ticket lands real translations).
 *
 * Not a hard gate at all (yet): full deep-key parity. Every locale is also
 * missing hundreds of individual keys within namespaces it does have —
 * real, pre-existing i18n debt, but fixing it is separate from — and much
 * larger than — this check's job (stopping a *namespace* from silently
 * vanishing again). Deep-key gaps are printed as a non-blocking report so
 * the debt stays visible.
 *
 *   node scripts/check-i18n-namespace-parity.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N_DIR = path.join(ROOT, 'src/lib/i18n');
const LOCALES = ['ru', 'kk', 'uz', 'zh'];
const HARD_GATE_LOCALES = new Set(['zh']);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flattenKeys(obj, prefix = '') {
  let out = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out = out.concat(flattenKeys(value, fullKey));
    } else {
      out.push(fullKey);
    }
  }
  return out;
}

function main() {
  const en = readJson(path.join(I18N_DIR, 'en.json'));
  const enNamespaces = Object.keys(en);
  const enDeepKeys = new Set(flattenKeys(en));

  let failed = false;

  for (const locale of LOCALES) {
    const data = readJson(path.join(I18N_DIR, `${locale}.json`));
    const missingNamespaces = enNamespaces.filter(
      (ns) => !Object.prototype.hasOwnProperty.call(data, ns)
    );

    if (missingNamespaces.length > 0) {
      const isHardGate = HARD_GATE_LOCALES.has(locale);
      failed = failed || isHardGate;
      const log = isHardGate ? console.error : console.warn;
      log(
        `KAZI-657 ${isHardGate ? '' : '(warning, non-blocking) '}${locale}.json is missing ${missingNamespaces.length} top-level namespace(s): ${missingNamespaces.join(', ')}`
      );
    } else {
      console.log(`KAZI-657 ${locale}.json: all ${enNamespaces.length} namespaces present`);
    }

    const localeDeepKeys = new Set(flattenKeys(data));
    const missingDeepKeys = [...enDeepKeys].filter((k) => !localeDeepKeys.has(k));
    if (missingDeepKeys.length > 0) {
      console.log(
        `  (info, non-blocking) ${locale}.json is missing ${missingDeepKeys.length} individual key(s) within existing namespaces — falls back to English per-key, not a hard gate here.`
      );
    }
  }

  if (failed) {
    console.error('KAZI-657 i18n namespace parity FAILED');
    process.exit(1);
  }
  console.log('KAZI-657 i18n namespace parity OK');
}

main();
