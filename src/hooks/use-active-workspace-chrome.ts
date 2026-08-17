'use client';

import { useEffect } from 'react';

import {
  subscribeActiveWorkspaceRailEvents,
  writeActiveWorkspacePortal,
  type ActiveWorkspaceRailHandlers,
} from '@/lib/spaces/active-workspace-chrome';

export function useActiveWorkspaceRailEvents(
  active: boolean,
  handlers: ActiveWorkspaceRailHandlers
): void {
  const { onOpen, onToggle } = handlers;
  useEffect(() => {
    return subscribeActiveWorkspaceRailEvents(
      active,
      { onOpen, onToggle },
      typeof window === 'undefined' ? null : window
    );
  }, [active, onOpen, onToggle]);
}

export function useActiveWorkspacePortalWrite(
  active: boolean,
  setOpen: ((open: boolean) => void) | undefined,
  open: boolean
): void {
  useEffect(() => {
    writeActiveWorkspacePortal(active, setOpen, open);
    if (!active) return;
    return () => setOpen?.(false);
  }, [active, open, setOpen]);
}
