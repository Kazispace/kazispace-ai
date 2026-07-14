/**
 * Space template panel hint from turn envelope (ADR-006 / KAZI-182).
 * SSOT: meta.active_panel ↔ ui_hints.panel_id → workspace `?panel=`.
 */

function readPanelId(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;

  const direct = record.active_panel ?? record.activePanel;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const uiHints = record.ui_hints ?? record.uiHints;
  if (uiHints && typeof uiHints === 'object') {
    const hints = uiHints as Record<string, unknown>;
    const fromHints = hints.panel_id ?? hints.panelId;
    if (typeof fromHints === 'string' && fromHints.trim()) {
      return fromHints.trim();
    }
  }

  const meta = record.meta;
  if (meta && typeof meta === 'object') {
    return readPanelId(meta);
  }

  const spaceState = record.space_state ?? record.spaceState;
  if (spaceState && typeof spaceState === 'object') {
    return readPanelId(spaceState);
  }

  return null;
}

/**
 * Extract suggested panel_id from a Space turn response payload.
 * Prefer `meta.active_panel`, then `ui_hints.panel_id`, then envelope nesting.
 */
export function resolveActivePanelFromTurn(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  if (raw.meta != null) {
    const fromMeta = readPanelId(raw.meta);
    if (fromMeta) return fromMeta;
  }

  const fromUiHints = readPanelId({ ui_hints: raw.ui_hints ?? raw.uiHints });
  if (fromUiHints) return fromUiHints;

  const fromTopLevel = readPanelId(raw);
  if (fromTopLevel) return fromTopLevel;

  if (raw.envelope != null) {
    return resolveActivePanelFromTurn(raw.envelope);
  }

  return null;
}
