/** ADR-006 Spaces API — aligned with kazispace-backend serialize_space + Spaces SDD §1.4 */

export type SpaceStatus = 'active' | 'completed' | 'archived' | 'deleted';

export interface SpaceSummary {
  /** Public id: sp_* or __clinic__ */
  id: string;
  name: string;
  template_id: string;
  status: SpaceStatus;
  is_entry_point?: boolean;
  is_system?: boolean;
  master_session_id: string;
  last_active_at: string | null;
  template_icon?: string;
  template_display_name?: string;
}

export interface SpaceDetail extends SpaceSummary {
  config_snapshot: Record<string, unknown>;
  space_state: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
}

export interface SpaceListResponse {
  spaces: SpaceSummary[];
}

export interface SpaceTemplateItem {
  template_id: string;
  display_name: Record<string, string> | string;
  mvp?: boolean;
}

export interface SpaceTemplatesResponse {
  templates: SpaceTemplateItem[];
  coming_soon: SpaceTemplateItem[];
}

export interface CreateSpaceRequest {
  template_id: string;
  name?: string;
}

export interface SpaceTurnRequest {
  message: string;
  input_mode?: string;
}

export interface SpaceTurnResponse {
  space_id: string;
  reply_text?: string;
  envelope?: unknown;
  meta?: Record<string, unknown>;
}

/** ADR-006 rendering.panels[] — maps to template-internal surfaces. */
export type SpacePanelSurface = 'cv_workspace' | 'interview_irp' | 'english_epp';

export interface SpacePanelConfig {
  panel_id: string;
  surface: SpacePanelSurface;
  default_visible?: boolean;
}
