/**
 * Space-scoped active capability (ADR-006 Worker isolation / KAZI-195).
 * Foreground SSOT: space.space_state.active_capability ↔ turn meta.active_capability.
 */

export function resolveActiveCapability(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;

  const direct = record.active_capability ?? record.activeCapability;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const meta = record.meta;
  if (meta && typeof meta === 'object') {
    const nested = meta as Record<string, unknown>;
    const fromMeta = nested.active_capability ?? nested.activeCapability;
    if (typeof fromMeta === 'string' && fromMeta.trim()) {
      return fromMeta.trim();
    }
  }

  const spaceState = record.space_state;
  if (spaceState && typeof spaceState === 'object') {
    return resolveActiveCapability(spaceState);
  }

  return null;
}

/**
 * Extract capability from a Space turn response payload.
 * Prefer `meta.active_capability`, then top-level field, then envelope meta.
 */
export function resolveActiveCapabilityFromTurn(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;

  if (raw.meta != null) {
    const fromMeta = resolveActiveCapability(raw.meta);
    if (fromMeta) return fromMeta;
  }

  const fromTopLevel = resolveActiveCapability(raw);
  if (fromTopLevel) return fromTopLevel;

  if (raw.envelope != null) {
    return resolveActiveCapability(raw.envelope);
  }

  return null;
}

/**
 * Whether Context Header may use global `activeAgentId` / agent sessions.
 * Hub routes: yes. Space surfaces (incl. clinic entry space): no.
 */
export function shouldUseGlobalAgentForContextHeader(options: {
  hubAgentId: string | null;
  spaceId: string | null;
}): boolean {
  if (options.hubAgentId) return true;
  if (options.spaceId) return false;
  return true;
}

/**
 * Human label for a space capability id — only when registered in the FE agent list.
 * Unknown / future BE ids must not leak snake_case identifiers into the UI.
 */
export function formatRegisteredCapabilityLabel(
  capabilityId: string,
  resolveAgent: (
    id: string
  ) => { emoji: string; name: string } | null | undefined
): string | null {
  const agent = resolveAgent(capabilityId);
  if (!agent) return null;
  return `${agent.emoji} ${agent.name}`;
}
