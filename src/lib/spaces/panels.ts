import type { SpaceDetail, SpacePanelConfig, SpacePanelSurface } from '@/types/spaces';

const JOB_SPRINT_DEFAULT_PANELS: SpacePanelConfig[] = [
  { panel_id: 'cv', surface: 'cv_workspace', default_visible: true },
  { panel_id: 'interview', surface: 'interview_irp', default_visible: false },
];

/**
 * KAZI-1069 — ET ability panel: a tab beside EPP, collapsed by default (Capability §5.5.5:
 * passive, the user opens it). Not in `default_visible` so it never opens on its own.
 */
const IELTS_PREP_ABILITY_PANEL: SpacePanelConfig = {
  panel_id: 'ability',
  surface: 'english_ability',
  default_visible: false,
};

const IELTS_PREP_DEFAULT_PANELS: SpacePanelConfig[] = [
  { panel_id: 'epp', surface: 'english_epp', default_visible: true },
  IELTS_PREP_ABILITY_PANEL,
];

const SURFACE_ALIASES: Record<string, SpacePanelSurface> = {
  cv_workspace: 'cv_workspace',
  cv: 'cv_workspace',
  interview_irp: 'interview_irp',
  interview: 'interview_irp',
  english_epp: 'english_epp',
  epp: 'english_epp',
  english_ability: 'english_ability',
  ability: 'english_ability',
};

/**
 * Spaces snapshot `rendering.panels` at creation (backend `templates_seed.py`), so every
 * IELTS Space created before KAZI-1069 lists only EPP. The ability panel is FE-owned and
 * read-only, so it is appended for `ielts_prep` when the snapshot lacks it.
 */
function withIeltsAbilityPanel(
  templateId: string | null | undefined,
  panels: SpacePanelConfig[]
): SpacePanelConfig[] {
  if (templateId !== 'ielts_prep') return panels;
  if (panels.some((panel) => panel.surface === 'english_ability')) return panels;
  return [...panels, IELTS_PREP_ABILITY_PANEL];
}

function normalizePanel(raw: Record<string, unknown>): SpacePanelConfig | null {
  const panel_id = typeof raw.panel_id === 'string' ? raw.panel_id : null;
  const surfaceRaw = typeof raw.surface === 'string' ? raw.surface : panel_id;
  if (!panel_id || !surfaceRaw) return null;

  const surface = SURFACE_ALIASES[surfaceRaw];
  if (!surface) return null;

  return {
    panel_id,
    surface,
    default_visible: raw.default_visible === true,
  };
}

export function resolveSpacePanels(
  space: Pick<SpaceDetail, 'template_id' | 'config_snapshot'>
): SpacePanelConfig[] {
  const rendering = space.config_snapshot?.rendering as
    | { panels?: unknown[] }
    | undefined;
  const fromConfig = rendering?.panels
    ?.map((item) =>
      item && typeof item === 'object'
        ? normalizePanel(item as Record<string, unknown>)
        : null
    )
    .filter((panel): panel is SpacePanelConfig => panel != null);

  if (fromConfig?.length) {
    return withIeltsAbilityPanel(space.template_id, fromConfig);
  }

  if (space.template_id === 'job_sprint') {
    return JOB_SPRINT_DEFAULT_PANELS;
  }

  if (space.template_id === 'ielts_prep') {
    return IELTS_PREP_DEFAULT_PANELS;
  }

  return [];
}

export function resolveDefaultPanelId(panels: SpacePanelConfig[]): string | null {
  if (panels.length === 0) return null;
  return panels.find((panel) => panel.default_visible)?.panel_id ?? panels[0]?.panel_id ?? null;
}

export function isValidPanelId(panels: SpacePanelConfig[], panelId: string | null): boolean {
  if (!panelId) return false;
  return panels.some((panel) => panel.panel_id === panelId);
}
