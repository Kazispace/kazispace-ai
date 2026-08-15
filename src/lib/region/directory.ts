import { parse as parseYaml } from 'yaml';

import bundledYaml from './directory.bundled.yaml';
import { normalizePhone } from './phone';
import type {
  DataRegion,
  PublicStatus,
  RegionDirectory,
  RegionDirectoryRow,
  ResolvedHome,
} from './types';
import { DEFAULT_BOOTSTRAP_API_BASE } from './types';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function parsePublicStatus(raw: unknown): PublicStatus {
  if (raw === 'advertised' || raw === 'not_ready' || raw === 'disabled') {
    return raw;
  }
  // Missing status on older payloads → treat as advertised only if we must;
  // bundled file always sets status. Public GET only returns advertised rows.
  return 'advertised';
}

function parseDataRegion(raw: unknown): DataRegion | undefined {
  if (raw === 'cn-mainland' || raw === 'global') return raw;
  return undefined;
}

export function parseRegionDirectory(raw: unknown): RegionDirectory | null {
  const row = asRecord(raw);
  if (!row) return null;

  const schemaVersion = readString(row.schema_version) ?? '1.0';
  const directoryVersion = readNumber(row.directory_version);
  const defaultDataRegion = parseDataRegion(row.default_data_region);
  if (directoryVersion == null || !defaultDataRegion) return null;

  const regionsRaw = row.regions;
  if (!Array.isArray(regionsRaw) || regionsRaw.length === 0) return null;

  const regions: RegionDirectoryRow[] = [];
  for (const item of regionsRaw) {
    const r = asRecord(item);
    if (!r) continue;
    const dataRegion = parseDataRegion(r.data_region);
    const regionId = readString(r.region_id);
    const apiBase = readString(r.api_base);
    const currency = readString(r.currency) ?? 'USD';
    const prefixes = Array.isArray(r.phone_prefixes)
      ? r.phone_prefixes
          .map((p) => (typeof p === 'string' ? p.trim() : ''))
          .filter(Boolean)
      : [];
    if (!dataRegion || !regionId || !apiBase) continue;
    regions.push({
      data_region: dataRegion,
      region_id: regionId,
      api_base: normalizeApiBase(apiBase),
      currency,
      phone_prefixes: prefixes,
      public_status: parsePublicStatus(r.public_status),
    });
  }

  if (regions.length === 0) return null;

  return {
    schema_version: schemaVersion,
    directory_version: directoryVersion,
    default_data_region: defaultDataRegion,
    regions,
  };
}

function loadBundledDirectory(): RegionDirectory {
  const parsed = parseRegionDirectory(parseYaml(bundledYaml));
  if (!parsed) {
    throw new Error('Invalid bundled region directory');
  }
  return parsed;
}

/** Immutable full directory (includes not_ready CN). */
export const BUNDLED_DIRECTORY: RegionDirectory = loadBundledDirectory();

let advertisedApiBases: Set<string> | null = null;
let publicRefreshPromise: Promise<void> | null = null;

export function bootstrapBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return normalizeApiBase(fromEnv || DEFAULT_BOOTSTRAP_API_BASE);
}

export function allowNotReadyLiveHost(): boolean {
  return process.env.NEXT_PUBLIC_REGION_ALLOW_NOT_READY === '1';
}

export function getBundledApiBases(): Set<string> {
  return new Set(BUNDLED_DIRECTORY.regions.map((r) => r.api_base));
}

export function isKnownApiBase(apiBase: string): boolean {
  return getBundledApiBases().has(normalizeApiBase(apiBase));
}

/** Advertised api_base set: last successful public GET, else bundled advertised rows. */
export function getAdvertisedApiBases(): Set<string> {
  if (advertisedApiBases && advertisedApiBases.size > 0) {
    return new Set(advertisedApiBases);
  }
  return new Set(
    BUNDLED_DIRECTORY.regions
      .filter((r) => r.public_status === 'advertised')
      .map((r) => r.api_base)
  );
}

/** Test / inject helper — replace advertised set without touching prefix map. */
export function setAdvertisedApiBasesForTests(bases: Iterable<string> | null): void {
  advertisedApiBases =
    bases == null
      ? null
      : new Set(Array.from(bases).map(normalizeApiBase));
}

function applyPublicDirectory(publicDir: RegionDirectory): void {
  // Public payload only updates advertised set — never overwrite bundled prefix map.
  const next = new Set<string>();
  for (const row of publicDir.regions) {
    // Only accept hosts that exist in the bundled map.
    if (!isKnownApiBase(row.api_base)) continue;
    if (row.public_status === 'advertised' || row.public_status === undefined) {
      next.add(row.api_base);
    }
  }
  // Public GET historically omits public_status; treat listed rows as advertised.
  if (next.size === 0) {
    for (const row of publicDir.regions) {
      if (isKnownApiBase(row.api_base)) next.add(row.api_base);
    }
  }
  if (next.size > 0) {
    advertisedApiBases = next;
  }
}

/**
 * Resolve home cluster from the **full bundled** directory.
 * Ignores public_status — +86 → CN even when not_ready.
 */
export function resolveHome(phone: string): ResolvedHome {
  const normalized = normalizePhone(phone);
  const allPrefixes = BUNDLED_DIRECTORY.regions.flatMap((r) =>
    r.phone_prefixes.map((p) => ({ prefix: p, row: r }))
  );

  let best: { prefix: string; row: RegionDirectoryRow } | null = null;
  for (const entry of allPrefixes) {
    if (normalized.startsWith(entry.prefix)) {
      if (!best || entry.prefix.length > best.prefix.length) {
        best = entry;
      }
    }
  }

  const row =
    best?.row ??
    BUNDLED_DIRECTORY.regions.find(
      (r) => r.data_region === BUNDLED_DIRECTORY.default_data_region
    ) ??
    BUNDLED_DIRECTORY.regions[0];

  return {
    data_region: row.data_region,
    region_id: row.region_id,
    api_base: row.api_base,
    currency: row.currency,
    phone_prefixes: row.phone_prefixes,
    public_status: row.public_status,
    phone: normalized,
  };
}

export function findRowByApiBase(apiBase: string): RegionDirectoryRow | undefined {
  const normalized = normalizeApiBase(apiBase);
  return BUNDLED_DIRECTORY.regions.find((r) => r.api_base === normalized);
}

/**
 * Refresh advertised set from bootstrap host public directory.
 * Does not mutate bundled prefix → api_base map.
 * Does not change an existing session.home_api_base (caller responsibility).
 */
export async function refreshPublicDirectory(
  fetchImpl: typeof fetch = fetch
): Promise<RegionDirectory | null> {
  if (publicRefreshPromise) {
    await publicRefreshPromise;
    return null;
  }

  publicRefreshPromise = (async () => {
    try {
      const url = `${bootstrapBase()}/api/v1/public/region-directory`;
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;
      const json = await response.json();
      const parsed = parseRegionDirectory(json);
      if (parsed) applyPublicDirectory(parsed);
    } catch {
      // Keep bundled advertised fallback.
    } finally {
      publicRefreshPromise = null;
    }
  })();

  await publicRefreshPromise;
  return null;
}

/** Ensure a cold-start refresh has been attempted (idempotent). */
export function ensureDirectoryLoaded(
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  return refreshPublicDirectory(fetchImpl).then(() => undefined);
}

export { normalizePhone };
export { matchLongestPrefix } from './phone';
