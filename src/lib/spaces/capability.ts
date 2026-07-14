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
 * Extract capability from a Space turn response payload
 * (`meta.active_capability` or nested envelope meta).
 */
export function resolveActiveCapabilityFromTurn(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  const fromMeta = resolveActiveCapability(raw.meta ?? raw);
  if (fromMeta) return fromMeta;
  if (raw.envelope) {
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
