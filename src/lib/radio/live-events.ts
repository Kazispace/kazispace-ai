/**
 * Live Room playback events (KAZI-1287; kazispace-ui live-room.md, Playback events).
 *
 * What the user does with the host's lines, so KaziSpace can see whether the English part is used.
 * Nothing the user says or hears is ever in an event: only a kind, where the line was, and its `seq`.
 *
 * | When | What happens to the batch |
 * | --- | --- |
 * | Sent when the session ends, and when the app goes to the background | |
 * | `200` | Done |
 * | The network failed | Sent again once, at the next of those moments; then dropped |
 * | `422` (malformed: nothing stored), `409`, `403`, `404`, anything else | Dropped. A `422` is never retried |
 *
 * A resent event keeps its `client_event_id`, so the server counts it once.
 */
import { newRadioRequestId } from '@/lib/radio/api';
import { postLiveEvents } from '@/lib/radio/live-api';
import type { LiveClientEvent, LiveEventKind, LivePart } from '@/types/radio-live';

export const LIVE_EVENTS_BATCH_MAX = 50;
/** `seq` is 1 to 20; a line outside that is not reported. */
export const LIVE_EVENT_SEQ_MAX = 20;

interface Batch {
  events: LiveClientEvent[];
  failedOnce: boolean;
}

export class LiveEventQueue {
  private readonly sessionId: string;
  private readonly post: typeof postLiveEvents;
  private queue: LiveClientEvent[] = [];
  private retry: Batch[] = [];

  constructor(sessionId: string, post: typeof postLiveEvents = postLiveEvents) {
    this.sessionId = sessionId;
    this.post = post;
  }

  /** `live_replay` carries the line's part and seq; `live_slow` and `live_key_word_tap` leave seq out. */
  add(kind: LiveEventKind, part: LivePart, seq?: number): void {
    if (seq !== undefined && (!Number.isInteger(seq) || seq < 1 || seq > LIVE_EVENT_SEQ_MAX)) return;
    const ev: LiveClientEvent = { client_event_id: newRadioRequestId('lev'), kind, part };
    if (seq !== undefined) ev.seq = seq;
    this.queue.push(ev);
  }

  /** The session ended, or the app went to the background: send what is waiting. Never throws. */
  flush(): void {
    const batches: Batch[] = [...this.retry];
    this.retry = [];
    while (this.queue.length) batches.push({ events: this.queue.splice(0, LIVE_EVENTS_BATCH_MAX), failedOnce: false });
    for (const b of batches) {
      void this.post(this.sessionId, b.events)
        .then((res) => {
          if (!res.success && res.errorCode === 'NETWORK_ERROR' && !b.failedOnce) this.retry.push({ events: b.events, failedOnce: true });
        })
        .catch(() => {
          if (!b.failedOnce) this.retry.push({ events: b.events, failedOnce: true });
        });
    }
  }

  /** For tests: events not sent yet, and batches waiting to be sent again. */
  get pending(): { queued: number; retry: number } {
    return { queued: this.queue.length, retry: this.retry.length };
  }
}
