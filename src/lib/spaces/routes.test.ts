import { describe, expect, it } from 'vitest';

import { isSpacesIndexPath } from '@/lib/spaces/routes';

describe('isSpacesIndexPath', () => {
  it('matches bare /spaces only', () => {
    expect(isSpacesIndexPath('/spaces')).toBe(true);
    expect(isSpacesIndexPath('/spaces/sp_abc')).toBe(false);
    expect(isSpacesIndexPath('/chat')).toBe(false);
  });
});
