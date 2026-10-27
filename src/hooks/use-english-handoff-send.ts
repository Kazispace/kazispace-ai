'use client';

import { useEffect, useRef } from 'react';

import { consumeEnglishHandoff } from '@/lib/spaces/english-handoff';
import { ENGLISH_SPACE_TEMPLATE_ID } from '@/lib/spaces/routes';

/**
 * KAZI-1190 — in the English Space, send the message the clinic handed over, once, as soon as
 * the chat can send: active, master session bound, history loaded, no turn in flight.
 * Other templates never consume it.
 *
 * Checked once per activation: Space chats stay mounted (keep-alive), so a second hand-off to
 * the same English Space arrives as a re-activation, not a re-mount.
 */
export function useEnglishHandoffSend(opts: {
  templateId: string;
  active: boolean;
  ready: boolean;
  isSending: boolean;
  send: (text: string) => unknown;
}): void {
  const { templateId, active, ready, isSending, send } = opts;
  const done = useRef(false);
  useEffect(() => {
    if (!active) {
      done.current = false;
      return;
    }
    if (done.current) return;
    if (templateId !== ENGLISH_SPACE_TEMPLATE_ID) return;
    if (!ready || isSending) return;
    done.current = true;
    const text = consumeEnglishHandoff();
    if (text) void send(text);
  }, [templateId, active, ready, isSending, send]);
}
