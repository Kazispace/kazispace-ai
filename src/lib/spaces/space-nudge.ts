import { STORAGE_KEYS } from '@/lib/constants';
import {
  isSupportedSpaceTemplate,
  TEMPLATE_EMOJI,
} from '@/lib/spaces/constants';

/** Clinic → Space progressive nudge (ADR-006 / KAZI-181). */
export type SpaceNudgePayload = {
  templateId: string;
  suggestedName?: string;
  /** Pre-resolved display string (from LocalizedLabel or plain). */
  ctaLabel?: string;
  reason?: string;
  dismissed?: boolean;
};

/** FE dismiss window — aligns with template nudge.dismiss_cooldown_days (default 30). */
export const SPACE_NUDGE_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type DismissMap = Record<string, number>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readDismissMap(): DismissMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SPACE_NUDGE_DISMISSED);
    if (!raw) return {};
    return JSON.parse(raw) as DismissMap;
  } catch {
    return {};
  }
}

function writeDismissMap(map: DismissMap): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SPACE_NUDGE_DISMISSED, JSON.stringify(map));
}

export function isSpaceNudgeDismissed(templateId: string): boolean {
  const dismissedAt = readDismissMap()[templateId];
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < SPACE_NUDGE_DISMISS_TTL_MS;
}

export function dismissSpaceNudge(templateId: string): void {
  const map = readDismissMap();
  map[templateId] = Date.now();
  writeDismissMap(map);
}

export function clearExpiredSpaceNudgeDismissals(): void {
  const map = readDismissMap();
  const now = Date.now();
  let changed = false;
  for (const templateId of Object.keys(map)) {
    if (now - map[templateId] >= SPACE_NUDGE_DISMISS_TTL_MS) {
      delete map[templateId];
      changed = true;
    }
  }
  if (changed) writeDismissMap(map);
}

function resolveCtaLabel(raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    for (const key of ['en', 'zh', 'ru', 'kk', 'uz']) {
      const v = map[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return undefined;
}

export function parseSpaceNudgeRecord(
  raw: Record<string, unknown>
): SpaceNudgePayload | null {
  const templateId =
    typeof raw.template_id === 'string'
      ? raw.template_id.trim()
      : typeof raw.templateId === 'string'
        ? raw.templateId.trim()
        : '';
  if (!templateId || !isSupportedSpaceTemplate(templateId)) return null;

  const suggestedName =
    typeof raw.suggested_name === 'string'
      ? raw.suggested_name.trim()
      : typeof raw.suggestedName === 'string'
        ? raw.suggestedName.trim()
        : undefined;

  const ctaLabel = resolveCtaLabel(raw.cta_label ?? raw.ctaLabel);
  const reason =
    typeof raw.reason === 'string'
      ? raw.reason.trim()
      : typeof raw.message === 'string'
        ? raw.message.trim()
        : undefined;

  return {
    templateId,
    ...(suggestedName ? { suggestedName } : {}),
    ...(ctaLabel ? { ctaLabel } : {}),
    ...(reason ? { reason } : {}),
  };
}

/** Parse `type: space_nudge` component or standalone object. */
export function parseSpaceNudgeComponent(item: unknown): SpaceNudgePayload | null {
  const record = asRecord(item);
  if (!record) return null;
  if (record.type != null && record.type !== 'space_nudge') return null;
  return parseSpaceNudgeRecord(record);
}

function collectComponents(root: Record<string, unknown>): unknown[] {
  const buckets = [
    root.components,
    asRecord(root.envelope)?.components,
    asRecord(root.assistant_response)?.components,
    asRecord(root.response)?.components,
  ];
  const out: unknown[] = [];
  for (const bucket of buckets) {
    if (Array.isArray(bucket)) out.push(...bucket);
  }
  return out;
}

/**
 * Extract Clinic → Space nudge from a chat / turn payload.
 * Prefers `components[]` with `type: space_nudge`; falls back to root `space_nudge`.
 */
export function extractSpaceNudge(data: unknown): SpaceNudgePayload | null {
  const root = asRecord(data);
  if (!root) return null;

  for (const item of collectComponents(root)) {
    const nudge = parseSpaceNudgeComponent(item);
    if (nudge) return nudge;
  }

  const nested =
    asRecord(root.space_nudge) ??
    asRecord(asRecord(root.assistant_response)?.space_nudge) ??
    asRecord(asRecord(root.response)?.space_nudge) ??
    asRecord(asRecord(root.envelope)?.space_nudge);
  if (nested) {
    return parseSpaceNudgeRecord({ type: 'space_nudge', ...nested });
  }

  return null;
}

export function spaceNudgeEmoji(templateId: string): string {
  return TEMPLATE_EMOJI[templateId] ?? '✨';
}
