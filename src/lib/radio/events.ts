/**
 * Playback events (KAZI-1209 part 5; kazispace-ui personal-radio.md, Data · Playback events).
 *
 * The app reports what happened during playback with `POST events`, in batches of at most 50. Events are
 * never shown to the user and never block playback. What happens to a batch depends on the answer:
 *
 * | Answer | The batch |
 * | --- | --- |
 * | `200` | Done: dropped, its `rejected` events included |
 * | `422` | Dropped: the same batch would fail again |
 * | `403` / `404` | The whole queue is dropped: the radio is no longer open to this user, or is off |
 * | `401` | The queue is kept until the user is signed in again |
 * | `503`, another server error, no network | Kept and sent again later, waiting longer each time |
 *
 * A batch sent again keeps its `client_event_id`s, so the server counts it once. `player_left` is sent as
 * the user leaves and is not waited for or retried. Clearing radio memory drops every unsent event.
 * Payloads carry only the keys listed for their kind: never what the user said, or any other free text.
 */
import { newRadioRequestId } from '@/lib/radio/api';
import { postRadioEvents } from '@/lib/radio/player-api';
import type { RadioClientEvent, RadioEventKind } from '@/types/radio';

export const EVENTS_BATCH_MAX = 50;
export const EVENTS_RETRY_FIRST_MS = 5_000;
export const EVENTS_RETRY_MAX_MS = 5 * 60_000;

type Payload = Record<string, string | number | boolean | null>;
type Where = { saveId?: string | null; programId?: string | null };

/** The keys each kind may carry (the contract's ClientEventIn description). */
const PAYLOAD_KEYS: Record<RadioEventKind, readonly string[]> = {
  radio_interrupted: ['node_id', 'position_ms'],
  radio_summary_shown: ['glossary_count', 'recommended_story_id'],
  node_finished: ['node_id', 'render_id'],
  replay: ['node_id', 'seq'],
  speed_changed: ['from', 'to'],
  ttfa: ['target', 'cached', 'ms', 'render_id'],
  program_finished: ['variant_band', 'position_ms'],
  player_left: ['node_id', 'seq', 'offset_ms', 'position_ms'],
};

let queue: RadioClientEvent[] = [];
let sending = false;
let blockedUntilSignIn = false;
let retryMs = EVENTS_RETRY_FIRST_MS;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clean(kind: RadioEventKind, payload: Payload): Payload {
  const out: Payload = {};
  for (const key of PAYLOAD_KEYS[kind]) {
    const v = payload[key];
    if (v !== undefined && v !== null) out[key] = v;
  }
  return out;
}

export function makeRadioEvent(kind: RadioEventKind, where: Where, payload: Payload = {}): RadioClientEvent {
  return {
    client_event_id: newRadioRequestId('ev'),
    kind,
    save_id: where.saveId ?? null,
    program_id: where.saveId ? null : where.programId ?? null,
    payload: clean(kind, payload),
  };
}

/** Adds an event to the queue; it is sent with the next flush. */
export function trackRadioEvent(kind: RadioEventKind, where: Where, payload: Payload = {}): void {
  queue.push(makeRadioEvent(kind, where, payload));
}

function scheduleRetry(): void {
  if (retryTimer || typeof window === 'undefined') return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushRadioEvents();
  }, retryMs);
  retryMs = Math.min(retryMs * 2, EVENTS_RETRY_MAX_MS);
}

/** Sends the queue in batches of at most 50. Never throws; never blocks playback. */
export async function flushRadioEvents(): Promise<void> {
  if (sending || blockedUntilSignIn || queue.length === 0) return;
  sending = true;
  try {
    while (queue.length) {
      const batch = queue.slice(0, EVENTS_BATCH_MAX);
      const res = await postRadioEvents(batch);
      if (res.success || res.status === 422) {
        queue = queue.filter((e) => !batch.includes(e));
        retryMs = EVENTS_RETRY_FIRST_MS;
        continue;
      }
      if (res.status === 403 || res.status === 404) {
        queue = [];
        return;
      }
      if (res.status === 401) {
        blockedUntilSignIn = true;
        return;
      }
      scheduleRetry();
      return;
    }
  } catch {
    scheduleRetry();
  } finally {
    sending = false;
  }
}

/** `player_left`: sent as the user leaves, not waited for, not retried, and not kept on failure. */
export function sendPlayerLeft(where: Where, payload: Payload): void {
  const ev = makeRadioEvent('player_left', where, payload);
  void postRadioEvents([ev]).catch(() => undefined);
  void flushRadioEvents();
}

/** The user signed in again: a queue held for `401` may be sent. */
export function resumeRadioEventsAfterSignIn(): void {
  blockedUntilSignIn = false;
  void flushRadioEvents();
}

/** Clearing radio memory (settings or Me) drops every event not sent yet. */
export function dropRadioEvents(): void {
  queue = [];
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  retryMs = EVENTS_RETRY_FIRST_MS;
}

/** For tests. */
export function radioEventQueue(): readonly RadioClientEvent[] {
  return queue;
}
export function resetRadioEventsForTest(): void {
  dropRadioEvents();
  sending = false;
  blockedUntilSignIn = false;
}
