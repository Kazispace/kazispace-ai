/** Region Profile FE types (KAZI-533 / IR-FE-1). */

export type DataRegion = 'cn-mainland' | 'global';

export type PublicStatus = 'advertised' | 'not_ready' | 'disabled';

export interface RegionDirectoryRow {
  data_region: DataRegion;
  region_id: string;
  api_base: string;
  currency: string;
  phone_prefixes: string[];
  public_status: PublicStatus;
}

export interface RegionDirectory {
  schema_version: string;
  directory_version: number;
  default_data_region: DataRegion;
  regions: RegionDirectoryRow[];
}

export interface ResolvedHome {
  data_region: DataRegion;
  region_id: string;
  api_base: string;
  currency: string;
  phone_prefixes: string[];
  public_status: PublicStatus;
  /** Normalized E.164-ish phone used for matching. */
  phone: string;
}

export interface RegionSession {
  token: string;
  home_api_base: string;
  data_region: DataRegion;
  directory_version: number;
}

export const REGION_SESSION_STORAGE_KEY = 'kazi.region.session';

export const DEFAULT_BOOTSTRAP_API_BASE = 'https://bot.kazispace.ai';
