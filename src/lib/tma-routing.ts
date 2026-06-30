import { STORAGE_KEYS } from './constants';
import { resolveStartParam } from './telegram';

/** TMA SDD §3.3: start_param ≤ 64 chars; cap stored ids defensively */
const MAX_TMA_PARAM_ID_LEN = 64;

function clampId(value: string, label: string): string {
  if (value.length <= MAX_TMA_PARAM_ID_LEN) return value;
  if (typeof console !== 'undefined') {
    console.warn(`[tma-routing] ${label} truncated to ${MAX_TMA_PARAM_ID_LEN} chars`);
  }
  return value.slice(0, MAX_TMA_PARAM_ID_LEN);
}

export type TmaPendingAction =
  | { type: 'activate_agent'; agentId: string }
  | { type: 'clinic' }
  | { type: 'restore' }
  | { type: 'subscription' }
  | { type: 'job'; jobId: string };

export function parseStartParam(startParam: string | null | undefined): TmaPendingAction {
  if (!startParam) return { type: 'restore' };

  const param =
    startParam.length > MAX_TMA_PARAM_ID_LEN
      ? startParam.slice(0, MAX_TMA_PARAM_ID_LEN)
      : startParam;

  if (param === 'clinic') {
    return { type: 'clinic' };
  }

  if (param.startsWith('agent_')) {
    return {
      type: 'activate_agent',
      agentId: clampId(param.slice('agent_'.length), 'agentId'),
    };
  }

  if (param.startsWith('job_')) {
    return {
      type: 'job',
      jobId: clampId(param.slice('job_'.length), 'jobId'),
    };
  }

  if (param === 'billing_pro') {
    return { type: 'subscription' };
  }

  return { type: 'restore' };
}

export function setPendingTmaAction(action: TmaPendingAction): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.TMA_PENDING_ACTION, JSON.stringify(action));
  } catch {
    // QuotaExceeded or disabled storage — non-fatal; routing falls back to restore
  }
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
