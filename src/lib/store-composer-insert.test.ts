/**
 * Studio's Get started (kazispace-ui D25) fills the main chat's composer through
 * `requestComposerInsert`, with its own "draft replaced" notice.
 */
import { describe, expect, it } from 'vitest';

import { useUIStore } from '@/lib/store';

describe('requestComposerInsert', () => {
  it('carries an optional notice for a replaced draft', () => {
    useUIStore.getState().requestComposerInsert('I want to practise for the IELTS exam', 'clinic', 'replace', 'Your draft was replaced');
    expect(useUIStore.getState().composerInsert).toMatchObject({
      text: 'I want to practise for the IELTS exam',
      target: 'clinic',
      mode: 'replace',
      replacedNotice: 'Your draft was replaced',
    });
    useUIStore.getState().requestComposerInsert('x', 'clinic');
    expect(useUIStore.getState().composerInsert?.replacedNotice).toBeUndefined();
    useUIStore.getState().clearComposerInsert();
  });
});
