/**
 * KAZI-1242 — the Morse "AI" rhythm file (kazispace-design content compliance §6.3 "可听", D20 = E1).
 * The committed `public/audio/aigc-ai-morse.wav` must be exactly what the numbers in `aigc-morse.ts` build,
 * and those numbers must spell "AI" (short-long, short-short) as the spec gives them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AIGC_MORSE, AIGC_MORSE_URL, aigcMorseLengthMs, aigcMorseTones, buildAigcMorseWav } from '@/lib/radio/aigc-morse';

const FILE = join(process.cwd(), 'public', AIGC_MORSE_URL);

function samples(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rate = v.getUint32(24, true);
  const n = v.getUint32(40, true) / 2;
  const s = new Int16Array(n);
  for (let i = 0; i < n; i += 1) s[i] = v.getInt16(44 + 2 * i, true);
  return { rate, s, channels: v.getUint16(22, true), bits: v.getUint16(34, true) };
}

/** [start, end] ms of each stretch of sound, read from the samples. */
function heardTones(bytes: Uint8Array): [number, number][] {
  const { rate, s } = samples(bytes);
  const quiet = (i: number) => Math.abs(s[i]) <= 200;
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < s.length; i += 1) {
    if (!quiet(i) && start < 0) start = i;
    if (start >= 0 && quiet(i)) {
      let still = true;
      for (let j = i; j < Math.min(s.length, i + rate / 500); j += 1) if (!quiet(j)) still = false;
      if (still) {
        out.push([Math.round((start / rate) * 1000), Math.round((i / rate) * 1000)]);
        start = -1;
      }
    }
  }
  return out;
}

describe('the Morse "AI" rhythm', () => {
  it('the committed file is exactly what the numbers build (run scripts/make-aigc-morse.mjs after changing them)', () => {
    expect(Buffer.from(readFileSync(FILE)).equals(Buffer.from(buildAigcMorseWav()))).toBe(true);
  });

  it('spells "AI": short-long, short-short, with a longer gap between the letters', () => {
    const tones = aigcMorseTones();
    const lengths = tones.map(([a, b]) => b - a);
    expect(lengths).toEqual([AIGC_MORSE.dotMs, AIGC_MORSE.dashMs, AIGC_MORSE.dotMs, AIGC_MORSE.dotMs]);
    const gaps = tones.slice(1).map(([a], i) => a - tones[i][1]);
    expect(gaps).toEqual([AIGC_MORSE.elementGapMs, AIGC_MORSE.letterGapMs, AIGC_MORSE.elementGapMs]);
    expect(AIGC_MORSE.dashMs).toBe(3 * AIGC_MORSE.dotMs);
  });

  it('what the file sounds like matches: four tones where the numbers put them, about 1.5 s in all', () => {
    const bytes = readFileSync(FILE);
    const heard = heardTones(new Uint8Array(bytes));
    const want = aigcMorseTones();
    expect(heard).toHaveLength(4);
    heard.forEach(([a, b], i) => {
      // the 5 ms fades make the audible edges a few ms inside the tone
      expect(Math.abs(a - want[i][0])).toBeLessThanOrEqual(AIGC_MORSE.rampMs);
      expect(Math.abs(b - want[i][1])).toBeLessThanOrEqual(AIGC_MORSE.rampMs);
    });
    expect(aigcMorseLengthMs()).toBe(1520);
  });

  it('mono 16-bit at 24 kHz, peak at -6 dBFS, no click at the edges', () => {
    const { rate, s, channels, bits } = samples(new Uint8Array(readFileSync(FILE)));
    expect([rate, channels, bits]).toEqual([24_000, 1, 16]);
    const peak = Math.max(...Array.from(s, Math.abs));
    expect(20 * Math.log10(peak / 32767)).toBeCloseTo(AIGC_MORSE.peakDbfs, 1);
    for (const [a] of aigcMorseTones()) {
      const first = Math.round((a / 1000) * rate);
      expect(Math.abs(s[first])).toBeLessThan(50);
    }
  });
});
