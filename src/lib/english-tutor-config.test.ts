import { describe, expect, it } from 'vitest';
import {
  ENGLISH_TUTOR_AGENT_ID,
  shouldRouteToEnglishEpp,
} from '@/lib/english-tutor-config';

describe('shouldRouteToEnglishEpp', () => {
  it('matches routedAgentId english_tutor', () => {
    expect(
      shouldRouteToEnglishEpp({ routedAgentId: ENGLISH_TUTOR_AGENT_ID })
    ).toBe(true);
  });

  it('matches intent english_tutor', () => {
    expect(shouldRouteToEnglishEpp({ intent: ENGLISH_TUTOR_AGENT_ID })).toBe(
      true
    );
  });

  it('matches next_actions type english_tutor', () => {
    expect(
      shouldRouteToEnglishEpp({
        nextActions: [{ type: ENGLISH_TUTOR_AGENT_ID, label: 'English' }],
      })
    ).toBe(true);
  });

  it('ignores unrelated agent routing', () => {
    expect(
      shouldRouteToEnglishEpp({
        intent: 'cv_builder',
        routedAgentId: 'job_search',
        nextActions: [{ type: 'open_list', label: 'Jobs' }],
      })
    ).toBe(false);
  });
});
