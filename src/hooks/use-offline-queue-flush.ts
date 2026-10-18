'use client';

import { useEffect, useRef } from 'react';

/**
 * D16: when the connection returns, send the messages queued while offline,
 * one at a time, in the order they were typed. A queued send that then fails
 * becomes "Not sent" with "Try again" (D13) through the normal retry path.
 *
 * `getQueuedIds` reads the current queued user message ids in order;
 * `send` re-sends one of them (the same path as "Try again").
 */
export function useOfflineQueueFlush(
  getQueuedIds: () => string[],
  send: (messageId: string) => Promise<unknown>
) {
  const getRef = useRef(getQueuedIds);
  const sendRef = useRef(send);
  getRef.current = getQueuedIds;
  sendRef.current = send;
  const flushingRef = useRef(false);

  useEffect(() => {
    const offline = () => navigator.onLine === false;
    const flush = async () => {
      if (flushingRef.current || offline()) return;
      flushingRef.current = true;
      try {
        for (const id of getRef.current()) {
          if (offline()) break;
          await sendRef.current(id);
        }
      } finally {
        flushingRef.current = false;
      }
    };
    window.addEventListener('online', flush);
    // Messages left queued from before this view mounted.
    void flush();
    return () => window.removeEventListener('online', flush);
  }, []);
}
