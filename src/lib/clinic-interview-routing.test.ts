import { describe, expect, it } from 'vitest';

import {
  hasInterviewHubNextAction,
  isMockInterviewStartUtterance,
  shouldClinicReplyRouteToInterviewHub,
} from '@/lib/clinic-interview-routing';

describe('clinic-interview-routing', () => {
  it('detects mock interview start utterances', () => {
    expect(isMockInterviewStartUtterance('我想练习面试')).toBe(true);
    expect(isMockInterviewStartUtterance('帮我练习面试')).toBe(true);
    expect(isMockInterviewStartUtterance('模拟面试')).toBe(true);
    expect(isMockInterviewStartUtterance('How do I prepare for interview?')).toBe(
      false
    );
  });

  it('rejects non-practice interview utterances (false positives)', () => {
    expect(isMockInterviewStartUtterance('我想面试这家公司')).toBe(false);
    expect(isMockInterviewStartUtterance('帮我看看面试结果')).toBe(false);
  });

  it('routes on mock_interview next_action (KAZI-138 referral)', () => {
    expect(
      shouldClinicReplyRouteToInterviewHub({
        nextActions: [{ type: 'mock_interview', path: '/interview' }],
      })
    ).toBe(true);
    expect(
      shouldClinicReplyRouteToInterviewHub({
        nextActions: [{ type: 'open_interview', label: 'View feedback' }],
      })
    ).toBe(true);
  });

  it('routes on interim inline intent + start utterance only', () => {
    expect(
      shouldClinicReplyRouteToInterviewHub({
        intent: 'mock_interview',
        userText: '我想练习面试',
      })
    ).toBe(true);
    expect(
      shouldClinicReplyRouteToInterviewHub({
        intent: 'mock_interview',
        userText: '贸易经理',
      })
    ).toBe(false);
  });

  it('hasInterviewHubNextAction is false for unrelated actions', () => {
    expect(hasInterviewHubNextAction([{ type: 'complete_profile' }])).toBe(
      false
    );
  });
});
