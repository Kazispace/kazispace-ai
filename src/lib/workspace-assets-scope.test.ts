import { describe, expect, it } from 'vitest';

import { resolveWorkspaceAssetListScope } from '@/lib/workspace-assets-scope';

describe('resolveWorkspaceAssetListScope', () => {
  it('uses user scope for blank conversation Space', () => {
    expect(
      resolveWorkspaceAssetListScope({
        id: 'sp_blank',
        template_id: 'blank_conversation',
      })
    ).toEqual({ scope: 'user' });
  });

  it('uses space scope for job_sprint', () => {
    expect(
      resolveWorkspaceAssetListScope({
        id: 'sp_sprint',
        template_id: 'job_sprint',
      })
    ).toEqual({ scope: 'space', spaceId: 'sp_sprint' });
  });

  it('uses space scope for ielts_prep', () => {
    expect(
      resolveWorkspaceAssetListScope({
        id: 'sp_ielts',
        template_id: 'ielts_prep',
      })
    ).toEqual({ scope: 'space', spaceId: 'sp_ielts' });
  });

  it('defaults to user scope when space is absent', () => {
    expect(resolveWorkspaceAssetListScope(null)).toEqual({ scope: 'user' });
    expect(resolveWorkspaceAssetListScope(undefined)).toEqual({ scope: 'user' });
  });
});
