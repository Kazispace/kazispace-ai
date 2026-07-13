import type { SpaceDetail } from '@/types/spaces';

/**
 * Resolves CV job context for job_sprint panels.
 *
 * Phase B: `?job_id=` URL query (deep link / share override).
 * TODO(KAZI-172 Phase C): primary source → `space.space_state.job_id` or
 * `config_snapshot`; URL only as explicit override.
 */
export function resolveSpaceJobId(
  space: Pick<SpaceDetail, 'space_state' | 'config_snapshot'>,
  searchParams: { get: (key: string) => string | null }
): string | null {
  const fromUrl = searchParams.get('job_id');
  if (fromUrl) {
    return fromUrl;
  }

  const fromState = (space.space_state as { job_id?: unknown } | undefined)?.job_id;
  if (typeof fromState === 'string' && fromState.trim()) {
    return fromState.trim();
  }

  return null;
}
