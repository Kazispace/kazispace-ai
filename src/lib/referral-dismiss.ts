import { STORAGE_KEYS } from './constants';

const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

type DismissMap = Record<string, number>;

function readDismissMap(): DismissMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REFERRAL_DISMISSED);
    if (!raw) return {};
    return JSON.parse(raw) as DismissMap;
  } catch {
    return {};
  }
}

function writeDismissMap(map: DismissMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.REFERRAL_DISMISSED, JSON.stringify(map));
}

export function isReferralDismissed(agentId: string): boolean {
  const dismissedAt = readDismissMap()[agentId];
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < DISMISS_TTL_MS;
}

export function dismissReferral(agentId: string): void {
  const map = readDismissMap();
  map[agentId] = Date.now();
  writeDismissMap(map);
}

export function clearExpiredReferralDismissals(): void {
  const map = readDismissMap();
  const now = Date.now();
  let changed = false;
  for (const agentId of Object.keys(map)) {
    if (now - map[agentId] >= DISMISS_TTL_MS) {
      delete map[agentId];
      changed = true;
    }
  }
  if (changed) writeDismissMap(map);
}
