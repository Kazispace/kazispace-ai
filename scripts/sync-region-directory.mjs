#!/usr/bin/env node
/**
 * KAZI-565 / KAZI-533 — YAML (SSOT mirror) → JSON (FE runtime snapshot).
 * Dev/CI only. Never imported by client chunks.
 *
 *   node scripts/sync-region-directory.mjs          # write JSON
 *   node scripts/sync-region-directory.mjs --check  # fail if stale
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const YAML_PATH = path.join(ROOT, 'src/lib/region/directory.bundled.yaml');
const JSON_PATH = path.join(ROOT, 'src/lib/region/directory.bundled.json');

/**
 * Minimal YAML subset for the region directory snapshot
 * (maps, list-of-maps, inline string arrays, # comments).
 */
function parseDirectoryYaml(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });

  const root = {};
  let regions = null;
  let currentRegion = null;

  const scalar = (raw) => {
    const value = raw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^-?\d+$/.test(value)) return Number(value);
    return value;
  };

  const parseInlineStringArray = (raw) => {
    const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
    if (!inner.trim()) return [];
    return inner.split(',').map((part) => scalar(part));
  };

  for (const line of lines) {
    const indent = line.match(/^ */)[0].length;
    const body = line.trim();

    if (indent === 0 && body.includes(':') && !body.startsWith('-')) {
      currentRegion = null;
      const idx = body.indexOf(':');
      const key = body.slice(0, idx).trim();
      const rest = body.slice(idx + 1).trim();
      if (key === 'regions') {
        regions = [];
        root.regions = regions;
        continue;
      }
      root[key] = rest ? scalar(rest) : null;
      continue;
    }

    if (body.startsWith('- ') && regions) {
      currentRegion = {};
      regions.push(currentRegion);
      const after = body.slice(2);
      if (after.includes(':')) {
        const idx = after.indexOf(':');
        const key = after.slice(0, idx).trim();
        const rest = after.slice(idx + 1).trim();
        currentRegion[key] = rest.startsWith('[')
          ? parseInlineStringArray(rest)
          : scalar(rest);
      }
      continue;
    }

    if (currentRegion && body.includes(':')) {
      const idx = body.indexOf(':');
      const key = body.slice(0, idx).trim();
      const rest = body.slice(idx + 1).trim();
      currentRegion[key] = rest.startsWith('[')
        ? parseInlineStringArray(rest)
        : scalar(rest);
    }
  }

  return root;
}

function normalizeDirectory(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid directory snapshot');
  }
  const regions = Array.isArray(raw.regions) ? raw.regions : [];
  return {
    schema_version: String(raw.schema_version ?? ''),
    directory_version: Number(raw.directory_version),
    default_data_region: String(raw.default_data_region ?? ''),
    regions: regions.map((row) => ({
      data_region: String(row.data_region ?? ''),
      region_id: String(row.region_id ?? ''),
      api_base: String(row.api_base ?? '').replace(/\/+$/, ''),
      currency: String(row.currency ?? ''),
      phone_prefixes: Array.isArray(row.phone_prefixes)
        ? row.phone_prefixes.map(String)
        : [],
      public_status: String(row.public_status ?? ''),
    })),
  };
}

function encodeJson(dir) {
  return `${JSON.stringify(dir, null, 2)}\n`;
}

function main() {
  const check = process.argv.includes('--check');
  const yamlText = fs.readFileSync(YAML_PATH, 'utf8');
  const fromYaml = normalizeDirectory(parseDirectoryYaml(yamlText));
  const expected = encodeJson(fromYaml);

  if (check) {
    const actual = fs.readFileSync(JSON_PATH, 'utf8');
    if (actual !== expected) {
      console.error(
        'KAZI-565 directory snapshot stale: YAML/JSON semantic mismatch.\n' +
          'Run: node scripts/sync-region-directory.mjs'
      );
      process.exit(1);
    }
    console.log('KAZI-565 directory YAML↔JSON snapshot OK');
    return;
  }

  fs.writeFileSync(JSON_PATH, expected);
  console.log(`Wrote ${path.relative(ROOT, JSON_PATH)}`);
}

main();
