'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * What a specialist page adds to the one bar above the conversation
 * (kazispace-ui decisions D24, Chat header spec): a one-line description and
 * at most one action. The page fills it; `SessionContextHeader` draws it. A
 * page never draws a second header of its own.
 */
export interface ChatHeaderSlot {
  subtitle: string | null;
  action: { label: string; onClick: () => void; disabled?: boolean } | null;
}

interface ChatHeaderSlotState extends ChatHeaderSlot {
  owner: string | null;
  set: (owner: string, slot: ChatHeaderSlot) => void;
  clear: (owner: string) => void;
}

export const useChatHeaderSlotStore = create<ChatHeaderSlotState>((set) => ({
  owner: null,
  subtitle: null,
  action: null,
  set: (owner, slot) => set({ owner, ...slot }),
  // Only the page that filled the slot may clear it, so a page that unmounts
  // after the next one mounted does not wipe the new page's header.
  clear: (owner) =>
    set((state) => (state.owner === owner ? { owner: null, subtitle: null, action: null } : state)),
}));

/** Fill the header slot while the calling page is mounted. */
export function useChatHeaderSlot(owner: string, slot: ChatHeaderSlot): void {
  const setSlot = useChatHeaderSlotStore((s) => s.set);
  const clearSlot = useChatHeaderSlotStore((s) => s.clear);
  const { subtitle, action } = slot;
  const actionLabel = action?.label ?? null;
  const actionDisabled = action?.disabled ?? false;
  const onClick = action?.onClick;

  useEffect(() => {
    setSlot(owner, {
      subtitle,
      action: actionLabel && onClick ? { label: actionLabel, onClick, disabled: actionDisabled } : null,
    });
  }, [owner, subtitle, actionLabel, actionDisabled, onClick, setSlot]);

  useEffect(() => () => clearSlot(owner), [owner, clearSlot]);
}
