'use client';

import { useEffect } from 'react';

import { flushRadioEvents, resumeRadioEventsAfterSignIn } from '@/lib/radio/events';

/** How often a radio screen sends the playback events it has queued ("every few minutes"). */
export const EVENTS_FLUSH_EVERY_MS = 2 * 60_000;

/**
 * Sends queued playback events while a radio screen is open (Data · Playback events): once on arrival
 * (a queue held for a sign-in may go now), every two minutes, and when the screen is left.
 */
export function useRadioEvents(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    resumeRadioEventsAfterSignIn();
    const id = setInterval(() => void flushRadioEvents(), EVENTS_FLUSH_EVERY_MS);
    return () => {
      clearInterval(id);
      void flushRadioEvents();
    };
  }, [enabled]);
}
