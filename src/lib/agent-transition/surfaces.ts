/**
 * Template-internal rendering surfaces (ADR-006).
 *
 * `cv_builder` is **not** a dedicated Hub route — CV workspace opens in the
 * Clinic/Space chat column + right rail (`lib/cv-entry.ts`).
 *
 * `/interview` remains a dedicated Hub chat-first route for now.
 *
 * The English tutor has no page of its own (KAZI-1171, Owen 2026-10-26: `/english`
 * is gone). Its surface is the user's English Space: `/spaces?template=ielts_prep`
 * opens the latest one or creates it.
 */
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { buildClinicChatHref, buildClinicCvRailOpenHref } from '@/lib/cv-entry';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { englishSpaceHref } from '@/lib/spaces/routes';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import type { AgentSurfaceId } from '@/lib/agent-transition/types';

const HUB_AGENT_TO_SURFACE: Record<string, AgentSurfaceId> = {
  [MOCK_INTERVIEW_AGENT_ID]: 'interview',
  [ENGLISH_TUTOR_AGENT_ID]: 'english',
};

/** SSOT list of agents with dedicated Hub surfaces (chat-first entry). */
export const DEDICATED_HUB_AGENT_IDS = Object.freeze(
  Object.keys(HUB_AGENT_TO_SURFACE)
) as readonly string[];

const SURFACE_TO_HUB_AGENT: Partial<Record<AgentSurfaceId, string>> = {
  cv: CV_BUILDER_AGENT_ID,
  interview: MOCK_INTERVIEW_AGENT_ID,
  english: ENGLISH_TUTOR_AGENT_ID,
};

const SURFACE_PATH: Record<AgentSurfaceId, (locale: string) => string> = {
  clinic: (locale) => buildClinicChatHref(locale),
  cv: (locale) => buildClinicCvRailOpenHref(locale),
  interview: (locale) => `/${locale}/interview`,
  english: (locale) => englishSpaceHref(locale),
};

const PATH_SEGMENT_TO_SURFACE: Record<string, AgentSurfaceId> = {
  chat: 'clinic',
  cv: 'cv',
  interview: 'interview',
};

export function isDedicatedHubAgent(agentId: string): boolean {
  return agentId in HUB_AGENT_TO_SURFACE;
}

export function resolveSurfaceForAgent(agentId: string): AgentSurfaceId {
  if (agentId === CV_BUILDER_AGENT_ID) return 'cv';
  return HUB_AGENT_TO_SURFACE[agentId] ?? 'clinic';
}

export function getSurfacePath(locale: string, surfaceId: AgentSurfaceId): string {
  return SURFACE_PATH[surfaceId](locale);
}

export function getAgentHubPath(locale: string, agentId: string): string | null {
  if (agentId === CV_BUILDER_AGENT_ID) {
    return buildClinicChatHref(locale);
  }
  const surface = HUB_AGENT_TO_SURFACE[agentId];
  return surface ? getSurfacePath(locale, surface) : null;
}

export function resolveSurfaceFromPathname(pathname: string): AgentSurfaceId {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return 'clinic';
  return PATH_SEGMENT_TO_SURFACE[segments[1]] ?? 'clinic';
}

export function getDedicatedHubAgentFromPathname(pathname: string): string | null {
  const surface = resolveSurfaceFromPathname(pathname);
  return SURFACE_TO_HUB_AGENT[surface] ?? null;
}
