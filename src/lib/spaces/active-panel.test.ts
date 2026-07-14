import { describe, expect, it } from 'vitest';

import { resolveActivePanelFromTurn } from '@/lib/spaces/active-panel';

describe('resolveActivePanelFromTurn', () => {
  it('reads meta.active_panel on turn payload', () => {
    expect(
      resolveActivePanelFromTurn({
        reply_text: 'hi',
        meta: { active_panel: 'interview' },
      })
    ).toBe('interview');
  });

  it('reads ui_hints.panel_id when meta.active_panel absent', () => {
    expect(
      resolveActivePanelFromTurn({
        reply_text: 'hi',
        ui_hints: { panel_id: 'cv' },
      })
    ).toBe('cv');
  });

  it('prefers meta.active_panel over ui_hints.panel_id', () => {
    expect(
      resolveActivePanelFromTurn({
        meta: { active_panel: 'interview' },
        ui_hints: { panel_id: 'cv' },
      })
    ).toBe('interview');
  });

  it('reads envelope.meta', () => {
    expect(
      resolveActivePanelFromTurn({
        envelope: { meta: { active_panel: 'cv' } },
      })
    ).toBe('cv');
  });

  it('returns null when blank / absent', () => {
    expect(resolveActivePanelFromTurn({})).toBeNull();
    expect(
      resolveActivePanelFromTurn({ meta: { active_panel: '  ' } })
    ).toBeNull();
  });
});
