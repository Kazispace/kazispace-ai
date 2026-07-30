/** P0 feature flag — parallel UAT with v1 hub (SSOT §9). */
export function isWorkspaceAssetRailV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_WORKSPACE_ASSET_RAIL_V2 === 'true';
}
