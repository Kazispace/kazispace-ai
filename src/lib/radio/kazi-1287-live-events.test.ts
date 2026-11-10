/**
 * KAZI-1287 F3 — Live Room playback events (kazispace-ui live-room.md 0.3, Playback events).
 */
import { describe, expect, it, vi } from 'vitest';

import { livePartOf } from '@/components/radio/live-screen';
import { LIVE_EVENTS_BATCH_MAX, LiveEventQueue } from '@/lib/radio/live-events';

const ok = { success: true, status: 200, data: { accepted: 1, duplicates: 0 } };
const net = { success: false, status: 0, errorCode: 'NETWORK_ERROR' };
const flushed = () => new Promise((r) => setTimeout(r, 0));

describe('Playback events', () => {
  it('each event is {client_event_id, kind, part, seq}; seq left out for live_slow and live_key_word_tap', async () => {
    const post = vi.fn().mockResolvedValue(ok);
    const q = new LiveEventQueue('ls1', post);
    q.add('live_replay', 'reply', 2);
    q.add('live_slow', 'upgrade');
    q.add('live_key_word_tap', 'upgrade');
    q.flush();
    const [sessionId, events] = post.mock.calls[0];
    expect(sessionId).toBe('ls1');
    expect(events.map((e: Record<string, unknown>) => Object.keys(e).sort())).toEqual([
      ['client_event_id', 'kind', 'part', 'seq'],
      ['client_event_id', 'kind', 'part'],
      ['client_event_id', 'kind', 'part'],
    ]);
    expect(events[0]).toMatchObject({ kind: 'live_replay', part: 'reply', seq: 2 });
    for (const e of events) expect(e.client_event_id).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
  });

  it('seq is 1 to 20: a line outside that is not reported', () => {
    const post = vi.fn().mockResolvedValue(ok);
    const q = new LiveEventQueue('ls1', post);
    q.add('live_replay', 'reply', 0);
    q.add('live_replay', 'reply', 21);
    q.add('live_replay', 'reply', 20);
    expect(q.pending.queued).toBe(1);
  });

  it('1 to 50 events per batch', () => {
    const post = vi.fn().mockResolvedValue(ok);
    const q = new LiveEventQueue('ls1', post);
    for (let i = 0; i < LIVE_EVENTS_BATCH_MAX + 3; i += 1) q.add('live_slow', 'upgrade');
    q.flush();
    expect(post.mock.calls.map((c) => c[1].length)).toEqual([50, 3]);
    q.flush();
    expect(post).toHaveBeenCalledTimes(2); // nothing waiting: nothing sent
  });

  it('a batch the network lost is sent again once, at the next moment, with the same ids; then dropped', async () => {
    const post = vi.fn().mockResolvedValue(net);
    const q = new LiveEventQueue('ls1', post);
    q.add('live_slow', 'upgrade');
    q.flush();
    await flushed();
    expect(q.pending.retry).toBe(1);
    q.flush();
    await flushed();
    expect(post.mock.calls[1][1][0].client_event_id).toBe(post.mock.calls[0][1][0].client_event_id);
    expect(q.pending.retry).toBe(0);
    q.flush();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it.each([422, 409, 403, 404])('%s: the batch is dropped, never retried', async (status) => {
    const post = vi.fn().mockResolvedValue({ success: false, status, errorCode: 'x' });
    const q = new LiveEventQueue('ls1', post);
    q.add('live_slow', 'upgrade');
    q.flush();
    await flushed();
    q.flush();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("live_replay's part: reply, upgrade or closing; the opening, the ack and the handover are not reported", () => {
    expect(['reply', 'upgrade', 'closing', 'opening', 'ack', 'handover'].map(livePartOf)).toEqual(['reply', 'upgrade', 'closing', null, null, null]);
  });
});
