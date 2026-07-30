export const WORKSPACE_ASSETS_INVALIDATE_EVENT = 'kazi-workspace-assets-invalidate';

export function publishWorkspaceAssetsInvalidate(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_ASSETS_INVALIDATE_EVENT));
}
