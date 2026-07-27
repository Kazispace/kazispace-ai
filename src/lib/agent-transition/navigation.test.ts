import { afterEach, describe, expect, it, vi } from 'vitest';

import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import {
  isNavigationPending,
  planNavigation,
} from '@/lib/agent-transition/navigation';
import type { AgentSurfaceId } from '@/lib/agent-transition/types';

const LOCALE = 'en';
const SURFACES: AgentSurfaceId[] = ['clinic', 'cv', 'interview', 'english'];

describe('planNavigation', () => {
  it('returns to clinic from hub surfaces', () => {
    for (const from of ['cv', 'interview', 'english'] as const) {
      const plan = planNavigation(LOCALE, from, null);
      expect(plan).toEqual({
        shouldNavigate: true,
        href: '/en/chat',
        targetSurface: 'clinic',
      });
    }
  });

  it('does not navigate when already on clinic and target is null', () => {
    const plan = planNavigation(LOCALE, 'clinic', null);
    expect(plan.shouldNavigate).toBe(false);
    expect(plan.href).toBeNull();
    expect(plan.targetSurface).toBe('clinic');
  });

  it('does not navigate for same-surface hub agent', () => {
    expect(planNavigation(LOCALE, 'cv', CV_BUILDER_AGENT_ID)).toMatchObject({
      shouldNavigate: false,
      href: null,
      targetSurface: 'cv',
    });
    expect(planNavigation(LOCALE, 'interview', MOCK_INTERVIEW_AGENT_ID)).toMatchObject({
      shouldNavigate: false,
      targetSurface: 'interview',
    });
  });

  it('navigates cross-surface for dedicated hub agents', () => {
    const cases: Array<{
      from: AgentSurfaceId;
      agentId: string;
      href: string;
      surface: AgentSurfaceId;
    }> = [
      { from: 'clinic', agentId: CV_BUILDER_AGENT_ID, href: '/en/chat?cv=1', surface: 'cv' },
      {
        from: 'clinic',
        agentId: MOCK_INTERVIEW_AGENT_ID,
        href: '/en/interview',
        surface: 'interview',
      },
      {
        from: 'clinic',
        agentId: ENGLISH_TUTOR_AGENT_ID,
        href: '/en/english',
        surface: 'english',
      },
      {
        from: 'cv',
        agentId: MOCK_INTERVIEW_AGENT_ID,
        href: '/en/interview',
        surface: 'interview',
      },
      {
        from: 'interview',
        agentId: CV_BUILDER_AGENT_ID,
        href: '/en/chat?cv=1',
        surface: 'cv',
      },
      {
        from: 'english',
        agentId: CV_BUILDER_AGENT_ID,
        href: '/en/chat?cv=1',
        surface: 'cv',
      },
    ];

    for (const { from, agentId, href, surface } of cases) {
      const plan = planNavigation(LOCALE, from, agentId);
      expect(plan, `${from} → ${agentId}`).toEqual({
        shouldNavigate: true,
        href,
        targetSurface: surface,
      });
    }
  });

  it('routes in-clinic agents to clinic chat surface', () => {
    const plan = planNavigation(LOCALE, 'cv', 'job_search');
    expect(plan).toEqual({
      shouldNavigate: true,
      href: '/en/chat',
      targetSurface: 'clinic',
    });
  });

  it('covers all from-surface × to-null combinations', () => {
    for (const from of SURFACES) {
      const plan = planNavigation(LOCALE, from, null);
      expect(plan.targetSurface).toBe('clinic');
      expect(plan.shouldNavigate).toBe(from !== 'clinic');
    }
  });
});

describe('isNavigationPending', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when navigation is not required', () => {
    expect(
      isNavigationPending({
        shouldNavigate: false,
        href: null,
        targetSurface: 'cv',
      })
    ).toBe(false);
  });

  it('compares pathname and query for navigation targets', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/en/chat', search: '' },
    });
    expect(
      isNavigationPending({
        shouldNavigate: true,
        href: '/en/chat?cv=1',
        targetSurface: 'cv',
      })
    ).toBe(true);

    vi.stubGlobal('window', {
      location: { pathname: '/en/interview', search: '' },
    });
    expect(
      isNavigationPending({
        shouldNavigate: true,
        href: '/en/interview?job_id=1',
        targetSurface: 'interview',
      })
    ).toBe(true);

    vi.stubGlobal('window', {
      location: { pathname: '/en/interview', search: '?job_id=1' },
    });
    expect(
      isNavigationPending({
        shouldNavigate: true,
        href: '/en/interview?job_id=1',
        targetSurface: 'interview',
      })
    ).toBe(false);
  });
});
