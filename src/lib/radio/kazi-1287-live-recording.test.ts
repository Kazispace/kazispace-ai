/**
 * KAZI-1287 F2 — Live Room recording rules and sending a recording in pieces (kazispace-ui live-room.md
 * 0.3, Recording · Sending a recording · The English part: Your sentence).
 */
import { describe, expect, it, vi } from 'vitest';

import { LIVE_MIN_PIECE_MS, earliestCutMs, newLiveTurnId, pieceMaxMs, reportedPieceMs, secondsLeft, shouldCutPiece, splitKeyWord } from '@/lib/radio/live-recording';
import { LIVE_MISSING_ROUNDS, LIVE_PIECE_RETRY_MS, LiveTurnUpload } from '@/lib/radio/live-uploader';

const LIMITS = { record_max_ms: 72_000, chunk_max_ms: 20_000, chunks_max: 4 };

describe('Where to cut', () => {
  it('pieces aim at 19.8 s, so a late timer never reports more than 20 s (#290 review R1)', () => {
    expect(pieceMaxMs(LIMITS)).toBe(19_800);
  });

  it("with 72 s, 20 s and 4 pieces: 12.6 s, 32.4 s, 52.2 s at the earliest (no earlier than the spec's 12 / 32 / 52 s)", () => {
    expect([1, 2, 3].map((k) => earliestCutMs(k, LIMITS))).toEqual([12_600, 32_400, 52_200]);
  });

  it('every k: the pieces left can still hold the rest of the longest recording', () => {
    for (let k = 1; k < LIMITS.chunks_max; k += 1) {
      const e = earliestCutMs(k, LIMITS);
      expect((LIMITS.chunks_max - k) * LIMITS.chunk_max_ms).toBeGreaterThanOrEqual(LIMITS.record_max_ms - e);
    }
  });

  it('a quiet moment before the earliest cut is not used', () => {
    expect(shouldCutPiece({ k: 1, elapsedMs: 12_500, pieceStartMs: 0, quiet: true, limits: LIMITS })).toBe(false);
    expect(shouldCutPiece({ k: 1, elapsedMs: 12_600, pieceStartMs: 0, quiet: true, limits: LIMITS })).toBe(true);
  });

  it('KAZI-1335: with 5 s × 20 pieces, a pause never ends a piece shorter than 3 s', () => {
    const L = { record_max_ms: 72_000, chunk_max_ms: 5_000, chunks_max: 20 };
    expect(LIVE_MIN_PIECE_MS).toBe(3_000);
    expect(shouldCutPiece({ k: 1, elapsedMs: 800, pieceStartMs: 0, quiet: true, limits: L })).toBe(false);
    expect(shouldCutPiece({ k: 1, elapsedMs: 2_900, pieceStartMs: 0, quiet: true, limits: L })).toBe(false);
    expect(shouldCutPiece({ k: 1, elapsedMs: 3_000, pieceStartMs: 0, quiet: true, limits: L })).toBe(true);
    expect(shouldCutPiece({ k: 3, elapsedMs: 9_500, pieceStartMs: 7_000, quiet: true, limits: L })).toBe(false);
    // without a pause it is still cut at the latest, 4.8 s after it began
    expect(shouldCutPiece({ k: 1, elapsedMs: 4_800, pieceStartMs: 0, quiet: false, limits: L })).toBe(true);
  });

  it('KAZI-1335: pausing all the time, a 72 s recording still fits in 20 pieces, none under 3 s but the last', () => {
    const L = { record_max_ms: 72_000, chunk_max_ms: 5_000, chunks_max: 20 };
    const lengths: number[] = [];
    let start = 0;
    let k = 1;
    for (let t = 100; t <= L.record_max_ms; t += 100) {
      if (shouldCutPiece({ k, elapsedMs: t, pieceStartMs: start, quiet: true, limits: L })) {
        lengths.push(t - start);
        start = t;
        k += 1;
      }
    }
    expect(k).toBeLessThanOrEqual(L.chunks_max);
    expect(lengths.every((n) => n >= LIVE_MIN_PIECE_MS)).toBe(true);
  });

  it('no quiet moment: cut at the latest, 19.8 s after the piece began', () => {
    expect(shouldCutPiece({ k: 1, elapsedMs: 19_700, pieceStartMs: 0, quiet: false, limits: LIMITS })).toBe(false);
    expect(shouldCutPiece({ k: 1, elapsedMs: 19_800, pieceStartMs: 0, quiet: false, limits: LIMITS })).toBe(true);
    expect(shouldCutPiece({ k: 2, elapsedMs: 32_300, pieceStartMs: 12_600, quiet: false, limits: LIMITS })).toBe(false);
    expect(shouldCutPiece({ k: 2, elapsedMs: 32_400, pieceStartMs: 12_600, quiet: false, limits: LIMITS })).toBe(true);
  });

  it('a reported length is never above chunk_max_ms nor below 1 ms', () => {
    expect(reportedPieceMs(20_030, LIMITS)).toBe(20_000);
    expect(reportedPieceMs(0, LIMITS)).toBe(1);
    expect(reportedPieceMs(12_345.6, LIMITS)).toBe(12_346);
  });

  it('the last allowed piece is never cut: it ends at Done or at 72 s', () => {
    expect(shouldCutPiece({ k: 4, elapsedMs: 71_000, pieceStartMs: 52_200, quiet: true, limits: LIMITS })).toBe(false);
  });

  it('cut as late or as early as allowed, a whole 72 s recording fits in 4 pieces of at most 19.8 s', () => {
    for (const quietAlways of [true, false]) {
      let k = 1;
      let start = 0;
      const lengths: number[] = [];
      for (let t = 100; t <= LIMITS.record_max_ms; t += 100) {
        if (shouldCutPiece({ k, elapsedMs: t, pieceStartMs: start, quiet: quietAlways, limits: LIMITS })) {
          lengths.push(t - start);
          start = t;
          k += 1;
        }
      }
      lengths.push(LIMITS.record_max_ms - start);
      expect(lengths.length).toBeLessThanOrEqual(LIMITS.chunks_max);
      expect(Math.max(...lengths)).toBeLessThanOrEqual(pieceMaxMs(LIMITS));
    }
  });
});

describe('Time left', () => {
  it('shown only in the last 10 seconds, counting down', () => {
    expect(secondsLeft(61_000, LIMITS)).toBeNull();
    expect(secondsLeft(62_000, LIMITS)).toBe(10);
    expect(secondsLeft(70_500, LIMITS)).toBe(2);
    expect(secondsLeft(80_000, LIMITS)).toBe(0);
  });
});

describe('ids and the key word', () => {
  it('a turn_id matches ^[A-Za-z0-9_-]{8,40}$ and is new for each recording', () => {
    const a = newLiveTurnId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(newLiveTurnId()).not.toBe(a);
  });

  it('the key word is found wherever it appears, case-insensitive, as a whole word only', () => {
    expect(splitKeyWord('Tired, so tired. Not retired.', 'tired')).toEqual([
      { text: 'Tired', key: true },
      { text: ', so ', key: false },
      { text: 'tired', key: true },
      { text: '. Not retired.', key: false },
    ]);
    expect(splitKeyWord('No key word here', null)).toEqual([{ text: 'No key word here', key: false }]);
    expect(splitKeyWord('a (b) c', '(b)')).toEqual([
      { text: 'a ', key: false },
      { text: '(b)', key: true },
      { text: ' c', key: false },
    ]);
  });
});

type Res = { success: boolean; status: number; errorCode?: string; data?: unknown };
const ok202: Res = { success: true, status: 202, data: { received: 1 } };
const answer: Res = { success: true, status: 200, data: { turn_id: 't', kind: 'reply', segments: [] } };
const net: Res = { success: false, status: 0, errorCode: 'NETWORK_ERROR' };
const missing: Res = { success: false, status: 422, errorCode: 'live_chunks_missing' };
const blob = (s: string) => new Blob([s]);

function uploader(post: ReturnType<typeof vi.fn>) {
  return new LiveTurnUpload({ sessionId: 's1', turnId: 'turn_abcdefgh', mime: 'audio/webm', post: post as never, sleep: () => Promise.resolve() });
}

describe('Sending a recording', () => {
  it('a piece is sent as soon as it is cut; the last one waits for it and carries meta final', async () => {
    let release: (r: Res) => void = () => undefined;
    const post = vi.fn((a: { seq: number; final: boolean }) =>
      a.final ? Promise.resolve(answer) : new Promise<Res>((r) => (release = r))
    );
    const up = uploader(post);
    up.addPiece(1, blob('a'), 12_000);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatchObject({ sessionId: 's1', turnId: 'turn_abcdefgh', seq: 1, final: false, durationMs: 12_000 });
    const done = up.finish(2, blob('b'), 5_000);
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(1); // the last piece waits
    release(ok202);
    expect(await done).toBe(answer);
    expect(post.mock.calls[1][0]).toMatchObject({ seq: 2, final: true });
  });

  it('a piece that failed on the network is sent again with the same turn_id and seq', async () => {
    const post = vi.fn().mockResolvedValueOnce(net).mockResolvedValueOnce(ok202).mockResolvedValueOnce(answer);
    const up = uploader(post);
    up.addPiece(1, blob('a'), 12_000);
    await up.finish(2, blob('b'), 1_000);
    expect(post.mock.calls.map((c) => [c[0].seq, c[0].turnId, c[0].final])).toEqual([
      [1, 'turn_abcdefgh', false],
      [1, 'turn_abcdefgh', false],
      [2, 'turn_abcdefgh', true],
    ]);
  });

  it('the last piece lost on the network is sent again (the same answer comes back)', async () => {
    const post = vi.fn().mockResolvedValueOnce(net).mockResolvedValueOnce(answer);
    expect(await uploader(post).finish(1, blob('a'), 3_000)).toBe(answer);
    expect(post.mock.calls.map((c) => c[0].seq)).toEqual([1, 1]);
  });

  it(`network failures stop after ${LIVE_PIECE_RETRY_MS.length} resends and are reported`, async () => {
    const post = vi.fn().mockResolvedValue(net);
    expect(await uploader(post).finish(1, blob('a'), 3_000)).toBe(net);
    expect(post).toHaveBeenCalledTimes(LIVE_PIECE_RETRY_MS.length + 1);
  });

  it('422 live_chunks_missing: the missing piece is sent again, then the last piece again', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({ success: false, status: 503, errorCode: 'live_unavailable' }) // piece 1 did not arrive
      .mockResolvedValueOnce(missing) // last piece
      .mockResolvedValueOnce(ok202) // piece 1 again
      .mockResolvedValueOnce(answer); // last piece again
    const up = uploader(post);
    up.addPiece(1, blob('a'), 12_000);
    expect(await up.finish(2, blob('b'), 2_000)).toBe(answer);
    expect(post.mock.calls.map((c) => [c[0].seq, c[0].final])).toEqual([
      [1, false],
      [2, true],
      [1, false],
      [2, true],
    ]);
  });

  it(`live_chunks_missing is tried ${LIVE_MISSING_ROUNDS} more rounds at most`, async () => {
    const post = vi.fn((a: { final: boolean }) => Promise.resolve(a.final ? missing : ok202));
    const res = await uploader(post).finish(1, blob('a'), 2_000);
    expect(res).toBe(missing);
    expect(post.mock.calls.filter((c) => c[0].final)).toHaveLength(LIVE_MISSING_ROUNDS + 1);
  });

  it('a piece the network lost even after its resends is sent once more, and the last piece waits for it', async () => {
    let release: (r: Res) => void = () => undefined;
    const post = vi.fn((a: { seq: number; final: boolean }) => {
      if (a.final) return Promise.resolve(answer);
      // piece 1: lost on the network on every try, then (sent once more before the last piece) held
      return post.mock.calls.length <= LIVE_PIECE_RETRY_MS.length + 1 ? Promise.resolve(net) : new Promise<Res>((r) => (release = r));
    });
    const up = uploader(post);
    up.addPiece(1, blob('a'), 12_000);
    const done = up.finish(2, blob('b'), 1_000);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(post.mock.calls.filter((c) => c[0].final)).toHaveLength(0);
    release(ok202);
    expect(await done).toBe(answer);
    expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ seq: 2, final: true });
  });

  it('a piece is never sent twice while its first send is in flight', () => {
    const post = vi.fn(() => new Promise<Res>(() => undefined));
    const up = uploader(post);
    up.addPiece(1, blob('a'), 12_000);
    up.addPiece(1, blob('a'), 12_000);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('after stop() nothing more is sent', async () => {
    const post = vi.fn().mockResolvedValue(net);
    const up = uploader(post);
    up.stop();
    up.addPiece(1, blob('a'), 12_000);
    expect(post).not.toHaveBeenCalled();
  });
});
