import { describe, expect, it } from 'vitest';

import {
  assertStarterAllowlist,
  isStarterConfigRenderable,
  resolveStarterCollapsed,
  resolveStarterConfig,
  STARTER_BY_TEMPLATE,
  starterCollapseStorageKey,
  TEMPLATE_ALLOWLIST,
} from '@/lib/spaces/starter-prompts/config';

describe('resolveStarterConfig (KAZI-240)', () => {
  it('returns sorted configs for the three official templates', () => {
    for (const id of Object.keys(STARTER_BY_TEMPLATE)) {
      const cfg = resolveStarterConfig(id, { assertInDev: true });
      expect(cfg).not.toBeNull();
      expect(cfg!.capabilities.length).toBeGreaterThan(0);
      expect(cfg!.examples.length).toBeGreaterThan(0);
    }
  });

  it('returns null for unknown template', () => {
    expect(resolveStarterConfig('stock_analysis')).toBeNull();
  });

  it('treats enabled+empty as not renderable', () => {
    expect(
      isStarterConfigRenderable({
        enabled: true,
        capabilities: [],
        examples: [],
      })
    ).toBe(false);
    expect(
      isStarterConfigRenderable({
        enabled: false,
        capabilities: [
          {
            id: 'x',
            labelKey: 'a',
            insertTextKey: 'b',
            priority: 1,
          },
        ],
        examples: [],
      })
    ).toBe(false);
  });

  it('blank never advertises search/research capability ids', () => {
    const cfg = resolveStarterConfig('blank_conversation')!;
    const ids = [
      ...cfg.capabilities.map((c) => c.capability_id),
      ...cfg.examples.map((e) => e.capability_id),
    ];
    expect(ids.every((id) => id === 'generic_chat')).toBe(true);
    expect(TEMPLATE_ALLOWLIST.blank_conversation).toEqual(['generic_chat']);
  });

  it('job_sprint chip mapping matches PRD §6.2', () => {
    const cfg = resolveStarterConfig('job_sprint')!;
    const byId = Object.fromEntries(cfg.capabilities.map((c) => [c.id, c]));
    expect(byId.cv.capability_id).toBe('cv_builder');
    expect(byId.cover.capability_id).toBe('cv_builder');
    expect(byId.interview.capability_id).toBe('mock_interview');
    expect(byId.salary.capability_id).toBe('mock_interview');
    expect(byId.match.capability_id).toBe('job_search');
  });

  it('assertStarterAllowlist throws on out-of-allowlist id', () => {
    expect(() =>
      assertStarterAllowlist('blank_conversation', {
        enabled: true,
        capabilities: [
          {
            id: 'bad',
            labelKey: 'x',
            insertTextKey: 'y',
            capability_id: 'web_search',
            priority: 1,
          },
        ],
        examples: [],
      })
    ).toThrow(/web_search/);
  });
});

describe('resolveStarterCollapsed (scheme A)', () => {
  it('defaults expanded with no preference and no user message', () => {
    expect(
      resolveStarterCollapsed({ hasUserMessage: false, stored: null })
    ).toBe(false);
  });

  it('defaults collapsed with no preference after first user message', () => {
    expect(
      resolveStarterCollapsed({ hasUserMessage: true, stored: null })
    ).toBe(true);
  });

  it('respects manual expand even when user messages exist', () => {
    expect(
      resolveStarterCollapsed({ hasUserMessage: true, stored: false })
    ).toBe(false);
  });

  it('respects manual collapse', () => {
    expect(
      resolveStarterCollapsed({ hasUserMessage: false, stored: true })
    ).toBe(true);
  });

  it('storage key is per spaceId', () => {
    expect(starterCollapseStorageKey('sp_1')).toBe('ks.starter.sp_1.collapsed');
  });
});
