import type { SpaceDetail } from '@/types/spaces';
import type { WorkspaceAssetScope } from '@/types/workspace-asset';

/** Templates that scope hub assets to the current Space (SSOT §3.4.5). */
const SPACE_SCOPED_TEMPLATES = new Set(['job_sprint', 'ielts_prep']);

export interface WorkspaceAssetListScope {
  scope: WorkspaceAssetScope;
  spaceId?: string;
}

/**
 * Clinic + blank Space → scope=user.
 * job_sprint / ielts_prep → scope=space + space_id.
 */
export function resolveWorkspaceAssetListScope(
  space?: Pick<SpaceDetail, 'id' | 'template_id'> | null
): WorkspaceAssetListScope {
  if (space && SPACE_SCOPED_TEMPLATES.has(space.template_id)) {
    return { scope: 'space', spaceId: space.id };
  }
  return { scope: 'user' };
}
