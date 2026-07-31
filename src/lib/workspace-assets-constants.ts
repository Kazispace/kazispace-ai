/** P0 feature flag — parallel UAT with v1 hub (SSOT §9). */
export function isWorkspaceAssetRailV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_ASSET_RAIL_V2 === 'true';
}

/** Hub lists user-wide assets; do not pass space_id (Clinic + all Spaces). */
export const WORKSPACE_ASSET_HUB_SCOPE = 'user' as const;

/** BE POST /reindex not shipped in #301 — gate retry UI until follow-up lands. */
export function isWorkspaceAssetReindexEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_ASSET_REINDEX_ENABLED === 'true';
}
