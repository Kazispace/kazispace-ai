import { findRowByApiBase } from './directory';
import { getSession } from './session';
import type { RegionSession } from './types';
import rumRegionPolicyJson from './rum-region-policy.json';

export type RumRegionRow = {
  enabled: boolean;
  endpoint: string;
  sample_rate: number;
  retention: string;
  log_sink: string;
};

export type RumRegionPolicyFile = {
  schema_version: string;
  fail_closed: boolean;
  same_origin_path: string;
  by_region_id: Record<string, RumRegionRow>;
};

export type ResolvedRumPolicy = RumRegionRow & {
  region_id: string | null;
};

export const RUM_REGION_POLICY: RumRegionPolicyFile = rumRegionPolicyJson;

const DISABLED: ResolvedRumPolicy = {
  region_id: null,
  enabled: false,
  endpoint: '',
  sample_rate: 0,
  retention: 'undeclared',
  log_sink: 'undeclared',
};

const SAMPLE_KEY = 'ks.rum.sample.v1';

function envForceOff(): boolean {
  const raw = process.env.NEXT_PUBLIC_RUM_ENABLED?.trim().toLowerCase();
  return raw === '0' || raw === 'false' || raw === 'off';
}

export function isAllowedRumEndpoint(endpoint: string): boolean {
  if (endpoint === RUM_REGION_POLICY.same_origin_path) return true;
  if (!endpoint.startsWith('https://')) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.pathname === RUM_REGION_POLICY.same_origin_path;
  } catch {
    return false;
  }
}

export function resolveRegionIdForRum(
  session: RegionSession | null
): string | null {
  if (!session) return null;
  return findRowByApiBase(session.home_api_base)?.region_id ?? null;
}

/**
 * Region Profile RUM contract. Missing session / unknown region / undeclared
 * endpoint → off (fail-closed). Does not infer guest = bundled default region.
 */
export function resolveRumClientPolicy(
  sessionOverride?: RegionSession | null
): ResolvedRumPolicy {
  if (envForceOff()) return DISABLED;

  const session =
    sessionOverride !== undefined ? sessionOverride : getSession();
  const regionId = resolveRegionIdForRum(session);
  if (!regionId) return DISABLED;

  const row = RUM_REGION_POLICY.by_region_id[regionId];
  if (!row || !row.enabled || !isAllowedRumEndpoint(row.endpoint)) {
    return {
      region_id: regionId,
      enabled: false,
      endpoint: '',
      sample_rate: 0,
      retention: row?.retention ?? 'undeclared',
      log_sink: row?.log_sink ?? 'undeclared',
    };
  }

  const sampleRate = Number(row.sample_rate);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    return {
      region_id: regionId,
      enabled: false,
      endpoint: '',
      sample_rate: 0,
      retention: row.retention,
      log_sink: row.log_sink,
    };
  }

  return {
    region_id: regionId,
    enabled: true,
    endpoint: row.endpoint,
    sample_rate: Math.min(1, sampleRate),
    retention: row.retention,
    log_sink: row.log_sink,
  };
}

export function shouldSampleRum(
  sampleRate: number,
  random: () => number = Math.random
): boolean {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  if (typeof window === 'undefined') return random() < sampleRate;
  try {
    const existing = sessionStorage.getItem(SAMPLE_KEY);
    if (existing === '1') return true;
    if (existing === '0') return false;
    const ok = random() < sampleRate;
    sessionStorage.setItem(SAMPLE_KEY, ok ? '1' : '0');
    return ok;
  } catch {
    return random() < sampleRate;
  }
}
