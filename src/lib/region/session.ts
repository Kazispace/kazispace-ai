import {
  BUNDLED_DIRECTORY,
  findRowByApiBase,
  isKnownApiBase,
} from './directory';
import type { DataRegion, RegionSession } from './types';
import { REGION_SESSION_STORAGE_KEY } from './types';

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function isDataRegion(value: unknown): value is DataRegion {
  return value === 'cn-mainland' || value === 'global';
}

export function parseRegionSession(raw: unknown): RegionSession | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const token = typeof row.token === 'string' ? row.token.trim() : '';
  const homeApiBase =
    typeof row.home_api_base === 'string'
      ? normalizeApiBase(row.home_api_base.trim())
      : '';
  const dataRegion = row.data_region;
  const directoryVersion = row.directory_version;

  if (!token) return null;
  if (!homeApiBase || !isKnownApiBase(homeApiBase)) return null;
  if (!isDataRegion(dataRegion)) return null;
  if (typeof directoryVersion !== 'number' || !Number.isFinite(directoryVersion)) {
    return null;
  }

  // data_region must match the bundled row for that api_base when possible.
  const rowMatch = findRowByApiBase(homeApiBase);
  if (rowMatch && rowMatch.data_region !== dataRegion) return null;

  return {
    token,
    home_api_base: homeApiBase,
    data_region: dataRegion,
    directory_version: directoryVersion,
  };
}

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(REGION_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value == null) {
      window.localStorage.removeItem(REGION_SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(REGION_SESSION_STORAGE_KEY, value);
    }
  } catch {
    // ignore quota / private mode
  }
}

/** Atomic session blob. Missing/invalid fields → null (and clear). */
export function getSession(): RegionSession | null {
  const raw = readStorage();
  if (!raw) return null;
  try {
    const parsed = parseRegionSession(JSON.parse(raw));
    if (!parsed) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export function setSession(session: RegionSession): void {
  const parsed = parseRegionSession(session);
  if (!parsed) {
    clearSession();
    return;
  }
  writeStorage(JSON.stringify(parsed));
}

export function clearSession(): void {
  writeStorage(null);
}

/** Build a session from OTP verify fields; rejects unknown home_api_base. */
export function buildSessionFromVerify(input: {
  token: string;
  home_api_base?: string | null;
  data_region?: string | null;
  directory_version?: number | null;
  /** Fallback when BE omits fields (e.g. TMA on intl). */
  fallbackHome?: { api_base: string; data_region: DataRegion };
}): RegionSession | null {
  const token = input.token.trim();
  if (!token) return null;

  const home =
    (input.home_api_base && normalizeApiBase(input.home_api_base)) ||
    input.fallbackHome?.api_base ||
    '';
  if (!home || !isKnownApiBase(home)) return null;

  const row = findRowByApiBase(home);
  const dataRegion = isDataRegion(input.data_region)
    ? input.data_region
    : input.fallbackHome?.data_region ?? row?.data_region;
  if (!dataRegion) return null;

  const directoryVersion =
    typeof input.directory_version === 'number' &&
    Number.isFinite(input.directory_version)
      ? input.directory_version
      : BUNDLED_DIRECTORY.directory_version;

  return parseRegionSession({
    token,
    home_api_base: home,
    data_region: dataRegion,
    directory_version: directoryVersion,
  });
}
