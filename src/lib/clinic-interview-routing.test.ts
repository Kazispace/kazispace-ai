import { describe, expect, it } from 'vitest';

import {
  hasInterviewHubNextAction,
  shouldClinicReplyRouteToInterviewHub,
} from '@/lib/clinic-interview-routing';

describe('clinic-interview-routing', () => {
  it('does not route on mock_interview next_action alone (KAZI-321)', () => {
    expect(
      shouldClinicReplyRouteToInterviewHub([{ type: 'mock_interview' }])
    ).toBe(false);
    expect(
      shouldClinicReplyRouteToInterviewHub([
        { type: 'mock_interview', path: '/interview' },
      ])
    ).toBe(true);
  });

  it('routes on open_interview next_action', () => {
    expect(
      shouldClinicReplyRouteToInterviewHub([
        { type: 'open_interview', label: 'View feedback' },
      ])
    ).toBe(true);
  });

  it('hasInterviewHubNextAction is false for unrelated actions', () => {
    expect(hasInterviewHubNextAction([{ type: 'complete_profile' }])).toBe(
      false
    );
  });
});
