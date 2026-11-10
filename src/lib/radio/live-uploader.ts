/**
 * Sending one recording in pieces (KAZI-1287; kazispace-ui live-room.md, Sending a recording).
 *
 * - A piece that is not the last is sent as soon as it is cut, while the user is still talking.
 * - A piece that failed on the network is sent again with the same `turn_id` and `seq`.
 * - The last piece waits for the earlier ones, so the server has them all. `422 live_chunks_missing`
 *   (an earlier piece has not arrived) sends the missing pieces again, then the last piece again.
 *   Sending the last piece again never makes the host answer twice.
 */
import { postLiveChunk } from '@/lib/radio/live-api';
import type { ApiResponse } from '@/types';
import type { LiveTurn } from '@/types/radio-live';

/** Network failures are sent again after 1 s, 2 s, then 4 s; a 4th failure is reported. */
export const LIVE_PIECE_RETRY_MS = [1_000, 2_000, 4_000] as const;
/** Rounds of "send the missing pieces, then the last one again" after `422 live_chunks_missing`. */
export const LIVE_MISSING_ROUNDS = 2;

type ChunkResponse = ApiResponse<LiveTurn | { received: number }>;
type Post = typeof postLiveChunk;

interface Piece {
  seq: number;
  audio: Blob;
  durationMs: number;
  sending: Promise<ChunkResponse>;
  ok: boolean;
}

const isNetwork = (r: ChunkResponse) => !r.success && r.errorCode === 'NETWORK_ERROR';
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class LiveTurnUpload {
  readonly sessionId: string;
  readonly turnId: string;
  private readonly mime: string;
  private readonly post: Post;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pieces = new Map<number, Piece>();
  private stopped = false;

  constructor({
    sessionId,
    turnId,
    mime,
    post = postLiveChunk,
    sleep = defaultSleep,
  }: {
    sessionId: string;
    turnId: string;
    mime: string;
    post?: Post;
    sleep?: (ms: number) => Promise<void>;
  }) {
    this.sessionId = sessionId;
    this.turnId = turnId;
    this.mime = mime;
    this.post = post;
    this.sleep = sleep;
  }

  /** The session ended (the user left, or an answer ended it): nothing more is sent. */
  stop(): void {
    this.stopped = true;
  }

  private async send(seq: number, audio: Blob, durationMs: number, final: boolean): Promise<ChunkResponse> {
    let res = await this.post({ sessionId: this.sessionId, turnId: this.turnId, seq, audio, durationMs, final, mime: this.mime });
    for (const wait of LIVE_PIECE_RETRY_MS) {
      if (!isNetwork(res) || this.stopped) break;
      await this.sleep(wait);
      if (this.stopped) break;
      res = await this.post({ sessionId: this.sessionId, turnId: this.turnId, seq, audio, durationMs, final, mime: this.mime });
    }
    return res;
  }

  private start(seq: number, audio: Blob, durationMs: number): Piece {
    const piece: Piece = { seq, audio, durationMs, ok: false, sending: Promise.resolve({ success: false, status: 0 } as ChunkResponse) };
    piece.sending = this.send(seq, audio, durationMs, false).then((r) => {
      piece.ok = r.success;
      return r;
    });
    this.pieces.set(seq, piece);
    return piece;
  }

  /** A piece that is not the last, cut while the user talks: sent now. */
  addPiece(seq: number, audio: Blob, durationMs: number): void {
    if (this.stopped || this.pieces.has(seq)) return;
    this.start(seq, audio, durationMs);
  }

  /** The last piece (`meta.final`): sent once the earlier pieces have been; answers with the host's turn. */
  async finish(seq: number, audio: Blob, durationMs: number): Promise<ChunkResponse> {
    for (let round = 0; ; round += 1) {
      for (const p of Array.from(this.pieces.values())) {
        const r = await p.sending;
        // A piece the network lost even after its retries is sent once more before the last piece.
        if (!r.success && isNetwork(r) && !this.stopped) this.start(p.seq, p.audio, p.durationMs);
      }
      await Promise.all(Array.from(this.pieces.values()).map((p) => p.sending));
      const res = await this.send(seq, audio, durationMs, true);
      if (res.success || res.status !== 422 || res.errorCode !== 'live_chunks_missing' || round >= LIVE_MISSING_ROUNDS || this.stopped) {
        return res;
      }
      // An earlier piece has not arrived yet: send every earlier piece not known to have arrived again.
      for (const p of Array.from(this.pieces.values())) if (!p.ok) this.start(p.seq, p.audio, p.durationMs);
    }
  }

  /** For tests: the seqs sent so far. */
  get pieceSeqs(): number[] {
    return Array.from(this.pieces.keys());
  }
}
