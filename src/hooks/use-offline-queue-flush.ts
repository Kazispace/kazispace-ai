'use client';

import { useEffect, useRef } from 'react';

/**
 * D16: when the connection returns, send the messages queued while offline,
 * one at a time, in the order they were typed. A queued send that then fails
 * becomes "Not sent" with "Try again" (D13) through the normal retry path.
 *
 * `getQueuedIds` reads the current queued user message ids in order;
 * `send` re-sends one of them (the same path as "Try again").
 *
 * The flush runs on mount, on the `online` event, and whenever `deps` change
 * (for example the open specialist), so a message queued in a conversation
 * that was not open when the connection returned is sent when it is opened.
 */
export function useOfflineQueueFlush(
  getQueuedIds: () => string[],
  send: (messageId: string) => Promise<unknown>,
  deps: readonly unknown[] = []
) {
  const getRef = useRef(getQueuedIds);
  const sendRef = useRef(send);
  getRef.current = getQueuedIds;
  sendRef.current = send;
  const flushingRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const offline = () => navigator.onLine === false;
    flushRef.current = async () => {
      if (flushingRef.current || offline()) return;
      flushingRef.current = true;
      const attempted = new Set<string>();
      try {
        // Re-read the queue before each send: the user may have sent one
        // already with "Try again", and it must not go out twice.
        for (;;) {
          if (offline()) break;
          const next = getRef.current().find((id) => !attempted.has(id));
          if (!next) break;
          attempted.add(next);
          await sendRef.current(next);
        }
      } finally {
        flushingRef.current = false;
      }
    };
    const onOnline = () => void flushRef.current();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  useEffect(() => {
    void flushRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
