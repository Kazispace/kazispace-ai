import { describe, expect, it } from 'vitest';

import {
  isValidPanelId,
  resolveDefaultPanelId,
  resolveSpacePanels,
} from '@/lib/spaces/panels';
import type { SpaceDetail } from '@/types/spaces';

function space(
  template_id: string,
  config_snapshot: SpaceDetail['config_snapshot'] = {}
): Pick<SpaceDetail, 'template_id' | 'config_snapshot'> {
  return { template_id, config_snapshot };
}

describe('resolveSpacePanels', () => {
  it('reads panels from config_snapshot', () => {
    const panels = resolveSpacePanels(
      space('job_sprint', {
        rendering: {
          panels: [
            { panel_id: 'cv', surface: 'cv_workspace', default_visible: true },
            { panel_id: 'interview', surface: 'interview_irp' },
          ],
        },
      })
    );
    expect(panels).toHaveLength(2);
    expect(panels[0]?.surface).toBe('cv_workspace');
  });

  it('falls back to job_sprint defaults', () => {
    const panels = resolveSpacePanels(space('job_sprint'));
    expect(panels.map((p) => p.panel_id)).toEqual(['cv', 'interview']);
    expect(resolveDefaultPanelId(panels)).toBe('cv');
    expect(isValidPanelId(panels, 'interview')).toBe(true);
    expect(isValidPanelId(panels, 'epp')).toBe(false);
  });

  it('falls back to ielts_prep defaults', () => {
    const panels = resolveSpacePanels(space('ielts_prep'));
    expect(panels).toEqual([
      { panel_id: 'epp', surface: 'english_epp', default_visible: true },
    ]);
    expect(resolveDefaultPanelId(panels)).toBe('epp');
  });
});
