import { describe, expect, it } from 'vitest';

import {
  assertChatFirstClinicHandoff,
  HUB_CHAT_FIRST_AGENT_IDS,
  HUB_ENTRY_CONTRACT,
  planClinicHandoff,
} from '@/lib/hub-entry-contract';
import {
  DEDICATED_HUB_AGENT_IDS,
  getAgentHubPath,
  isDedicatedHubAgent,
} from '@/lib/agent-transition/surfaces';
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

  it('keeps HUB_CHAT_FIRST_AGENT_IDS in sync with isDedicatedHubAgent', () => {
    expect(HUB_CHAT_FIRST_AGENT_IDS).toEqual(DEDICATED_HUB_AGENT_IDS);
    for (const agentId of DEDICATED_HUB_AGENT_IDS) {
      expect(isDedicatedHubAgent(agentId)).toBe(true);
    }
  });
});

describe('assertChatFirstClinicHandoff', () => {
  it('returns chat-first root for every dedicated Hub agent', () => {
    for (const agentId of HUB_CHAT_FIRST_AGENT_IDS) {
      const handoff = assertChatFirstClinicHandoff(LOCALE, agentId);
      expect(handoff, agentId).toEqual({
        href: getAgentHubPath(LOCALE, agentId),
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
