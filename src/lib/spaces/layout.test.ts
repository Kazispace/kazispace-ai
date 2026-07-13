import { describe, expect, it } from 'vitest';

import { resolveSpaceLayout } from '@/lib/spaces/layout';
import type { SpaceDetail } from '@/types/spaces';

function space(
  template_id: string,
  config_snapshot: SpaceDetail['config_snapshot'] = {}
): Pick<SpaceDetail, 'template_id' | 'config_snapshot'> {
  return { template_id, config_snapshot };
}

describe('resolveSpaceLayout', () => {
  it('prefers config_snapshot rendering layout', () => {
    expect(
      resolveSpaceLayout(
        space('blank_conversation', {
          rendering: { layout: 'chat_with_panels' },
        })
      )
    ).toBe('chat_with_panels');
  });

  it('maps blank_conversation to chat_only', () => {
    expect(resolveSpaceLayout(space('blank_conversation'))).toBe('chat_only');
  });

  it('maps panel templates to chat_with_panels', () => {
    expect(resolveSpaceLayout(space('job_sprint'))).toBe('chat_with_panels');
    expect(resolveSpaceLayout(space('ielts_prep'))).toBe('chat_with_panels');
  });
});
