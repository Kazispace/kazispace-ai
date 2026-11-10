/**
 * The Morse "AI" rhythm (KAZI-1242; kazispace-design content compliance §6.3 "可听", D20 = E1): short-long,
 * short-short (GB 45438-2025 §5.3 c). A fixed platform sound, not speech: it never goes through TTS and never
 * has a caption. One file for both regions, built from these numbers by `scripts/make-aigc-morse.mjs` and
 * checked against them by `kazi-1242-aigc-morse.test.ts`.
 */
export const AIGC_MORSE_URL = '/audio/aigc-ai-morse.wav';

export const AIGC_MORSE = {
  sampleRate: 24_000,
  toneHz: 800,
  dotMs: 120,
  dashMs: 360,
  /** Between the dots and dashes of one letter. */
  elementGapMs: 120,
  /** Between "A" and "I". */
  letterGapMs: 360,
  /** Silence before and after the rhythm. */
  padMs: 100,
  /** Each tone fades in and out over this, so it does not click. */
  rampMs: 5,
  /** Peak level, dBFS. */
  peakDbfs: -6,
} as const;

/** "A" = dot dash, "I" = dot dot. */
export const AIGC_MORSE_PATTERN: readonly (readonly ('dot' | 'dash')[])[] = [
  ['dot', 'dash'],
  ['dot', 'dot'],
];

/** [start, end] of each tone in ms from the start of the file. */
export function aigcMorseTones(p = AIGC_MORSE): [number, number][] {
  const out: [number, number][] = [];
  let t = p.padMs;
  AIGC_MORSE_PATTERN.forEach((letter, li) => {
    if (li > 0) t += p.letterGapMs;
    letter.forEach((el, ei) => {
      if (ei > 0) t += p.elementGapMs;
      const len = el === 'dot' ? p.dotMs : p.dashMs;
      out.push([t, t + len]);
      t += len;
    });
  });
  return out;
}

/** The whole file's length in ms. */
export function aigcMorseLengthMs(p = AIGC_MORSE): number {
  const tones = aigcMorseTones(p);
  return tones[tones.length - 1][1] + p.padMs;
}

/** 16-bit mono PCM WAV bytes of the rhythm. */
export function buildAigcMorseWav(p = AIGC_MORSE): Uint8Array {
  const n = Math.round((aigcMorseLengthMs(p) / 1000) * p.sampleRate);
  const pcm = new Int16Array(n);
  const peak = Math.pow(10, p.peakDbfs / 20) * 32767;
  const ramp = (p.rampMs / 1000) * p.sampleRate;
  for (const [a, b] of aigcMorseTones(p)) {
    const s0 = Math.round((a / 1000) * p.sampleRate);
    const s1 = Math.round((b / 1000) * p.sampleRate);
    for (let i = s0; i < s1; i += 1) {
      const k = i - s0;
      const fromEnd = s1 - 1 - i;
      const edge = Math.min(k, fromEnd);
      const env = edge < ramp ? 0.5 - 0.5 * Math.cos((Math.PI * edge) / ramp) : 1;
      pcm[i] = Math.round(peak * env * Math.sin((2 * Math.PI * p.toneHz * k) / p.sampleRate));
    }
  }
  const data = pcm.length * 2;
  const buf = new ArrayBuffer(44 + data);
  const v = new DataView(buf);
  const str = (o: number, s: string) => s.split('').forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, p.sampleRate, true);
  v.setUint32(28, p.sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, data, true);
  new Int16Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}
