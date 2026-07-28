import { buildClinicChatHref, buildClinicCvRailOpenHref } from '@/lib/cv-entry';
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
  | { type: 'jobs' }
  | { type: 'profile' }
  | { type: 'job'; jobId: string }
  | { type: 'cv' }
  | { type: 'cv_job'; jobId: string }
  | { type: 'interview' }
  | { type: 'interview_job'; jobId: string };

/** Routes that clinic-shell must handle after landing on /chat. */
export function shouldPersistTmaAction(action: TmaPendingAction): boolean {
  return action.type === 'activate_agent' || action.type === 'clinic';
}

export function routeForTmaAction(locale: string, action: TmaPendingAction): string {
  switch (action.type) {
    case 'subscription':
      return `/${locale}/subscription`;
    case 'jobs':
      return `/${locale}/jobs`;
    case 'profile':
      return `/${locale}/profile`;
    case 'job':
      return `/${locale}/jobs/${encodeURIComponent(action.jobId)}`;
    case 'cv':
      return buildClinicCvRailOpenHref(locale);
    case 'cv_job':
      return buildClinicCvRailOpenHref(locale, action.jobId);
    case 'interview':
      return `/${locale}/interview`;
    case 'interview_job':
      return `/${locale}/interview?job_id=${encodeURIComponent(action.jobId)}`;
    case 'activate_agent':
    case 'clinic':
    case 'restore':
    default:
      return `/${locale}/chat`;
  }
}

export function parseStartParam(startParam: string | null | undefined): TmaPendingAction {
  if (!startParam) return { type: 'restore' };

  const param =
    startParam.length > MAX_TMA_PARAM_ID_LEN
      ? startParam.slice(0, MAX_TMA_PARAM_ID_LEN)
      : startParam;

  if (param === 'clinic') {
    return { type: 'clinic' };
  }

  if (param === 'jobs') {
    return { type: 'jobs' };
  }

  if (param === 'profile') {
    return { type: 'profile' };
  }

  if (param === 'cv') {
    return { type: 'cv' };
  }

  if (param === 'interview') {
    return { type: 'interview' };
  }

  if (param.startsWith('interview_job_')) {
    return {
      type: 'interview_job',
      jobId: clampId(param.slice('interview_job_'.length), 'jobId'),
    };
  }

  if (param.startsWith('cv_job_')) {
    return {
      type: 'cv_job',
      jobId: clampId(param.slice('cv_job_'.length), 'jobId'),
    };
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

export function clearPendingTmaAction(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEYS.TMA_PENDING_ACTION);
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
  if (shouldPersistTmaAction(action)) {
    setPendingTmaAction(action);
  } else {
    clearPendingTmaAction();
  }
  return action;
}
