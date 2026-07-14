import { describe, expect, it } from 'vitest';

import {
  formatRegisteredCapabilityLabel,
  resolveActiveCapability,
  resolveActiveCapabilityFromTurn,
  shouldUseGlobalAgentForContextHeader,
} from '@/lib/spaces/capability';

describe('resolveActiveCapability', () => {
  it('reads space_state.active_capability', () => {
    expect(
      resolveActiveCapability({ active_capability: 'cv_builder' })
    ).toBe('cv_builder');
  });

  it('reads nested space_state on a detail-like object', () => {
    expect(
      resolveActiveCapability({
        id: 'sp_1',
        space_state: { active_capability: 'english_tutor' },
      })
    ).toBe('english_tutor');
  });

  it('returns null when blank / absent', () => {
    expect(resolveActiveCapability({})).toBeNull();
    expect(resolveActiveCapability({ active_capability: '  ' })).toBeNull();
  });
});

describe('resolveActiveCapabilityFromTurn', () => {
  it('reads meta.active_capability on turn payload', () => {
    expect(
      resolveActiveCapabilityFromTurn({
        reply_text: 'hi',
        meta: { active_capability: 'english_tutor' },
      })
    ).toBe('english_tutor');
  });

  it('reads envelope.meta', () => {
    expect(
      resolveActiveCapabilityFromTurn({
        envelope: { meta: { active_capability: 'mock_interview' } },
      })
    ).toBe('mock_interview');
  });

  it('reads top-level active_capability when meta omitted', () => {
    expect(
      resolveActiveCapabilityFromTurn({
        reply_text: 'hi',
        active_capability: 'cv_builder',
      })
    ).toBe('cv_builder');
  });
});

describe('shouldUseGlobalAgentForContextHeader', () => {
  it('allows hub routes', () => {
    expect(
      shouldUseGlobalAgentForContextHeader({
        hubAgentId: 'cv_builder',
        spaceId: null,
      })
    ).toBe(true);
  });

  it('blocks global agent on space surfaces (incl. clinic entry)', () => {
    expect(
      shouldUseGlobalAgentForContextHeader({
        hubAgentId: null,
        spaceId: '__clinic__',
      })
    ).toBe(false);
    expect(
      shouldUseGlobalAgentForContextHeader({
        hubAgentId: null,
        spaceId: 'sp_1',
      })
    ).toBe(false);
  });

  it('allows clinic path without spaceId (legacy / spaces off)', () => {
    expect(
      shouldUseGlobalAgentForContextHeader({
        hubAgentId: null,
        spaceId: null,
      })
    ).toBe(true);
  });
});

describe('formatRegisteredCapabilityLabel', () => {
  it('formats known agents and hides unknown ids', () => {
    expect(
      formatRegisteredCapabilityLabel('cv_builder', (id) =>
        id === 'cv_builder' ? { emoji: '📄', name: 'CV' } : null
      )
    ).toBe('📄 CV');
    expect(
      formatRegisteredCapabilityLabel('future_agent', () => null)
    ).toBeNull();
  });
});
