import { describe, expect, it } from 'vitest';

import { resolveLatestClinicNextActions } from '@/lib/clinic/starter-prompts/clinic-nba';
import type { ChatNextAction } from '@/types/chat-envelope';

const continueMock: ChatNextAction[] = [
  { type: 'open_interview', label: 'Continue mock interview' },
];

describe('resolveLatestClinicNextActions', () => {
  it('returns empty when no messages', () => {
    expect(resolveLatestClinicNextActions([])).toEqual([]);
  });

  it('returns empty when no assistant messages', () => {
    expect(
      resolveLatestClinicNextActions([
        { role: 'user', nextActions: undefined },
      ])
    ).toEqual([]);
  });

  it('returns next_actions from the latest assistant', () => {
    expect(
      resolveLatestClinicNextActions([
        { role: 'assistant', nextActions: continueMock },
      ])
    ).toEqual(continueMock);
  });

  it('returns NBA from latest assistant even after a user turn (when a newer assistant reply follows)', () => {
    expect(
      resolveLatestClinicNextActions([
        { role: 'assistant', nextActions: [{ type: 'job_search' }] },
        { role: 'user' },
        { role: 'assistant', nextActions: continueMock },
      ])
    ).toEqual(continueMock);
  });

  it('returns empty when latest assistant has no next_actions', () => {
    expect(
      resolveLatestClinicNextActions([
        { role: 'assistant', nextActions: continueMock },
        { role: 'user' },
        { role: 'assistant', nextActions: [] },
      ])
    ).toEqual([]);
  });

  it('treats NBA as stale after a user follow-up (async QR mutex)', () => {
    expect(
      resolveLatestClinicNextActions([
        { role: 'assistant', nextActions: continueMock },
        { role: 'user' },
      ])
    ).toEqual([]);
  });

  it('async arrival: assistant gains next_actions while thread ends on assistant', () => {
    const messages = [{ role: 'assistant' as const, nextActions: undefined }];
    expect(resolveLatestClinicNextActions(messages)).toEqual([]);

    messages[0] = { role: 'assistant', nextActions: continueMock };
    expect(resolveLatestClinicNextActions(messages)).toEqual(continueMock);
  });
});
