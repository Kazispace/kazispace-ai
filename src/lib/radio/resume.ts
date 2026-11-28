/**
 * The radio home's resume bar (KAZI-1512; kazispace-ui Personal radio 0.35, Radio home · Resume bar): the story
 * or episode the listener was last in while it is still in progress. It opens the player; it does not play on
 * the home (leaving the player stops it).
 */
import type { RadioHome, RadioSaveSummary, RadioStorylineSummary } from '@/types/radio';

export type RadioResume =
  | { kind: 'story'; key: string; title: string; updatedAt: string; save: RadioSaveSummary }
  | { kind: 'serial'; key: string; title: string; updatedAt: string; line: RadioStorylineSummary };

const time = (iso: string): number => {
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : 0;
};

/** The most recently played item in progress, or `null` when nothing is in progress. Ties keep the story. */
export function pickRadioResume(home: Pick<RadioHome, 'continue_listening' | 'continue_storylines'>): RadioResume | null {
  const items: RadioResume[] = [
    ...home.continue_listening.map((save) => ({ kind: 'story' as const, key: save.save_id, title: save.title, updatedAt: save.updated_at, save })),
    ...(home.continue_storylines ?? [])
      .filter((line) => line.progress)
      .map((line) => ({ kind: 'serial' as const, key: line.storyline_id, title: line.title, updatedAt: line.progress!.updated_at, line })),
  ];
  let best: RadioResume | null = null;
  for (const item of items) if (!best || time(item.updatedAt) > time(best.updatedAt)) best = item;
  return best;
}
