import { describe, expect, it } from 'vitest';

import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import {
  assertChatFirstClinicHandoff,
  HUB_CHAT_FIRST_AGENT_IDS,
  HUB_ENTRY_CONTRACT,
  planClinicHandoff,
} from '@/lib/hub-entry-contract';
import { getAgentHubPath } from '@/lib/agent-transition/surfaces';
import { planNavigation } from '@/lib/agent-transition/navigation';

const LOCALE = 'en';

describe('HUB_ENTRY_CONTRACT', () => {
  it('declares chat-first invariants', () => {
    expect(HUB_ENTRY_CONTRACT).toEqual({
      opensSession: true,
      requiresGuidanceMessage: true,
      requiresComposer: true,
      infoPagesSecondary: true,
    });
  });
});

describe('assertChatFirstClinicHandoff', () => {
  it('returns chat-first root for every dedicated Hub agent', () => {
    const expected: Record<string, string> = {
      [CV_BUILDER_AGENT_ID]: '/en/cv',
      [MOCK_INTERVIEW_AGENT_ID]: '/en/interview',
      [ENGLISH_TUTOR_AGENT_ID]: '/en/english',
    };

    for (const agentId of HUB_CHAT_FIRST_AGENT_IDS) {
      const handoff = assertChatFirstClinicHandoff(LOCALE, agentId);
      expect(handoff, agentId).toEqual({
        href: expected[agentId],
        isChatFirstRoot: true,
      });
    }
  });

  it('returns null for in-clinic agents', () => {
    expect(assertChatFirstClinicHandoff(LOCALE, 'job_search')).toBeNull();
    expect(assertChatFirstClinicHandoff(LOCALE, 'career_sprint')).toBeNull();
  });

  it('hub paths never use secondary route suffixes', () => {
    for (const agentId of HUB_CHAT_FIRST_AGENT_IDS) {
      const path = getAgentHubPath(LOCALE, agentId);
      expect(path).toBeTruthy();
      expect(path).not.toMatch(/\/(passport|onboarding|profile|assessment|training|growth)$/);
    }
  });
});

describe('planClinicHandoff', () => {
  it('aligns with navigation SSOT for dedicated Hub agents', () => {
    for (const agentId of HUB_CHAT_FIRST_AGENT_IDS) {
      const plan = planClinicHandoff(LOCALE, agentId);
      expect(plan.shouldNavigate).toBe(true);
      expect(plan.href).toBe(getAgentHubPath(LOCALE, agentId));
    }
  });

  it('routes in-clinic agents back to clinic from hub surfaces', () => {
    for (const from of ['cv', 'interview', 'english'] as const) {
      const plan = planNavigation(LOCALE, from, 'job_search');
      expect(plan).toEqual({
        shouldNavigate: true,
        href: '/en/chat',
        targetSurface: 'clinic',
      });
    }
  });

  it('does not navigate for in-clinic agent when already on clinic', () => {
    const plan = planClinicHandoff(LOCALE, 'job_search');
    expect(plan).toEqual({
      shouldNavigate: false,
      href: null,
      targetSurface: 'clinic',
    });
  });
});
