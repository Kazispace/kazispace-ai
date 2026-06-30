import { STORAGE_KEYS } from './constants';
import { resolveStartParam } from './telegram';

export type TmaPendingAction =
  | { type: 'activate_agent'; agentId: string }
  | { type: 'clinic' }
  | { type: 'restore' }
  | { type: 'subscription' }
  | { type: 'job'; jobId: string };

export function parseStartParam(startParam: string | null | undefined): TmaPendingAction {
  if (!startParam) return { type: 'restore' };

  if (startParam === 'clinic') {
    return { type: 'clinic' };
  }

  if (startParam.startsWith('agent_')) {
    return { type: 'activate_agent', agentId: startParam.slice('agent_'.length) };
  }

  if (startParam.startsWith('job_')) {
    return { type: 'job', jobId: startParam.slice('job_'.length) };
  }

  if (startParam === 'billing_pro') {
    return { type: 'subscription' };
  }

  return { type: 'restore' };
}

export function setPendingTmaAction(action: TmaPendingAction): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEYS.TMA_PENDING_ACTION, JSON.stringify(action));
}

export function consumePendingTmaAction(): TmaPendingAction | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEYS.TMA_PENDING_ACTION);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEYS.TMA_PENDING_ACTION);
  try {
    return JSON.parse(raw) as TmaPendingAction;
  } catch {
    return null;
  }
}

export function captureStartParamFromContext(search?: string): TmaPendingAction {
  const startParam = resolveStartParam(search);
  const action = parseStartParam(startParam);
  setPendingTmaAction(action);
  return action;
}
