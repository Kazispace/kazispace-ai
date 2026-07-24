import { describe, expect, it } from 'vitest';

import {
  hasInterviewHubNextAction,
  shouldClinicReplyRouteToInterviewHub,
} from '@/lib/clinic-interview-routing';

describe('clinic-interview-routing', () => {
  it('does not route on mock_interview next_action alone (KAZI-321)', () => {
    expect(
      shouldClinicReplyRouteToInterviewHub({
        nextActions: [{ type: 'mock_interview' }],
      })
    ).toBe(false);
    expect(
      shouldClinicReplyRouteToInterviewHub({
        nextActions: [{ type: 'mock_interview', path: '/interview' }],
      })
    ).toBe(true);
  });

  it('routes on open_interview next_action', () => {
    expect(
      shouldClinicReplyRouteToInterviewHub({
        nextActions: [{ type: 'open_interview', label: 'View feedback' }],
      })
    ).toBe(true);
  });

  it('does not route on interim mock_interview intent + start utterance', () => {
    expect(
      shouldClinicReplyRouteToInterviewHub({
        intent: 'mock_interview',
        userText: '我想练习面试',
      })
    ).toBe(false);
  });

  it('hasInterviewHubNextAction is false for unrelated actions', () => {
    expect(hasInterviewHubNextAction([{ type: 'complete_profile' }])).toBe(
      false
    );
  });
});
