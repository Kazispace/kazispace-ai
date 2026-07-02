import { STORAGE_KEYS } from '@/lib/constants';

export interface CvAgentHandoff {
  sessionId?: string;
  greeting?: string;
}

export function setCvAgentHandoff(handoff: CvAgentHandoff): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.CV_AGENT_HANDOFF, JSON.stringify(handoff));
  } catch {
    // QuotaExceeded or disabled storage — /cv falls back to activate or getActiveAgent
  }
}

export function consumeCvAgentHandoff(): CvAgentHandoff | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEYS.CV_AGENT_HANDOFF);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEYS.CV_AGENT_HANDOFF);
  try {
    const parsed = JSON.parse(raw) as CvAgentHandoff;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
