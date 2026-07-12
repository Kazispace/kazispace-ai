'use client';

import { useCallback, useEffect, useState } from 'react';

import { SESSION_NAV_STORAGE_KEY } from '@/lib/session-nav';

function readStoredPanelOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(SESSION_NAV_STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
  } catch {
    /* ignore */
  }
  return window.innerWidth >= 1024;
}

export function useSessionNavState() {
  const [panelOpen, setPanelOpenState] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPanelOpenState(readStoredPanelOpen());
    setHydrated(true);
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
    try {
      localStorage.setItem(SESSION_NAV_STORAGE_KEY, String(open));
    } catch {
      /* ignore */
    }
    if (!open) setMobileDrawerOpen(false);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SESSION_NAV_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      if (!next) setMobileDrawerOpen(false);
      return next;
    });
  }, []);

  const openMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(true);
    setPanelOpenState(true);
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
    setPanelOpenState(false);
    try {
      localStorage.setItem(SESSION_NAV_STORAGE_KEY, 'false');
    } catch {
      /* ignore */
    }
  }, []);

  return {
    panelOpen: hydrated ? panelOpen : false,
    setPanelOpen,
    togglePanel,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
    hydrated,
  };
}
