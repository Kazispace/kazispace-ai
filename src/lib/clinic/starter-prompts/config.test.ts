import { describe, expect, it } from 'vitest';

import {
  CLINIC_STARTER_ALLOWLIST,
  CLINIC_STARTER_CONFIG,
  assertClinicStarterAllowlist,
  clinicStarterCollapseStorageKey,
  resolveClinicStarterConfig,
  shouldHideClinicStarterForNextActions,
} from '@/lib/clinic/starter-prompts/config';

describe('clinic starter config (KAZI-258)', () => {
  it('resolves a renderable independent clinic config', () => {
    const cfg = resolveClinicStarterConfig({ assertInDev: true });
    expect(cfg).not.toBeNull();
    expect(cfg!.capabilities.length).toBeGreaterThan(0);
    expect(cfg!.examples.length).toBeGreaterThan(0);
  });

  it('only uses clinic allowlist capability ids', () => {
    const allow = new Set<string>(CLINIC_STARTER_ALLOWLIST);
    const ids = [
      ...CLINIC_STARTER_CONFIG.capabilities.map((c) => c.capability_id),
      ...CLINIC_STARTER_CONFIG.examples.map((e) => e.capability_id),
    ];
    expect(ids.every((id) => id && allow.has(id))).toBe(true);
  });

  it('assert throws on out-of-allowlist id', () => {
    expect(() =>
      assertClinicStarterAllowlist({
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

  it('Phase B mutex: hide when next_actions non-empty', () => {
    expect(shouldHideClinicStarterForNextActions([])).toBe(false);
    expect(shouldHideClinicStarterForNextActions([{ type: 'job_search' }])).toBe(
      true
    );
  });

  it('collapse key is session-scoped', () => {
    expect(clinicStarterCollapseStorageKey('sess_1')).toBe(
      'ks.starter.clinic.sess_1.collapsed'
    );
    expect(clinicStarterCollapseStorageKey('')).toBe(
      'ks.starter.clinic.pending.collapsed'
    );
  });
});
