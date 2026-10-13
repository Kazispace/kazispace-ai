import { describe, expect, it } from 'vitest';

import { getSpacePanelLabel } from '@/lib/spaces/panel-labels';
import { resolveDefaultPanelId, resolveSpacePanels } from '@/lib/spaces/panels';
import type { SpaceDetail } from '@/types/spaces';

type SpaceLike = Pick<SpaceDetail, 'template_id' | 'config_snapshot'>;

const space = (template_id: string, panels?: unknown[]): SpaceLike =>
  ({
    template_id,
    config_snapshot: panels ? { rendering: { panels } } : {},
  }) as unknown as SpaceLike;

// Exactly what backend `spaces/templates_seed.py` writes for ielts_prep today.
const SEEDED_IELTS = [{ panel_id: 'epp', surface: 'english_epp', default_visible: true }];

describe('KAZI-1069 — ability panel in IELTS Spaces', () => {
  it('existing IELTS Spaces (snapshot lists only EPP) get the ability tab after EPP', () => {
    const panels = resolveSpacePanels(space('ielts_prep', SEEDED_IELTS));
    expect(panels.map((p) => p.surface)).toEqual(['english_epp', 'english_ability']);
  });

  it('the template default has it too', () => {
    const panels = resolveSpacePanels(space('ielts_prep'));
    expect(panels.map((p) => p.surface)).toEqual(['english_epp', 'english_ability']);
  });

  it('is collapsed by default: never the default panel, never default_visible', () => {
    const panels = resolveSpacePanels(space('ielts_prep', SEEDED_IELTS));
    expect(panels.find((p) => p.surface === 'english_ability')?.default_visible).toBe(false);
    expect(resolveDefaultPanelId(panels)).toBe('epp');
  });

  it('is not added twice when a snapshot already lists it', () => {
    const panels = resolveSpacePanels(
      space('ielts_prep', [...SEEDED_IELTS, { panel_id: 'ability', surface: 'english_ability' }])
    );
    expect(panels.filter((p) => p.surface === 'english_ability')).toHaveLength(1);
  });

  it('does not leak into other templates', () => {
    const panels = resolveSpacePanels(space('job_sprint'));
    expect(panels.some((p) => p.surface === 'english_ability')).toBe(false);
  });

  it('has its own tab label', () => {
    const t = (key: string) => `spaces.${key}`;
    expect(getSpacePanelLabel({ panel_id: 'ability', surface: 'english_ability' }, t)).toBe(
      'spaces.panelAbility'
    );
  });
});
