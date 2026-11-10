#!/usr/bin/env node
/**
 * KAZI-1242: writes public/audio/aigc-ai-morse.wav from src/lib/radio/aigc-morse.ts (the Morse "AI" rhythm,
 * kazispace-design content compliance §6.3). Run after changing the numbers there:
 *
 *   npx vite-node scripts/make-aigc-morse.mjs
 *
 * `kazi-1242-aigc-morse.test.ts` fails while the committed file differs from what the numbers build.
 */
import { writeFileSync } from 'node:fs';
import { buildAigcMorseWav } from '../src/lib/radio/aigc-morse.ts';

const out = new URL('../public/audio/aigc-ai-morse.wav', import.meta.url);
writeFileSync(out, buildAigcMorseWav());
console.log(`wrote ${out.pathname}`);
