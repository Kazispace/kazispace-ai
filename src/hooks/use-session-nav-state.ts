'use client';

import { useCallback, useEffect, useState } from 'react';

import { SESSION_NAV_PANEL_MODE_KEY, SESSION_NAV_STORAGE_KEY, type SessionNavPanelMode, type SessionNavViewTab } from '@/lib/session-nav';
import { SESSION_NAV_VIEW_TAB_KEY } from '@/lib/session-nav-events';

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

function readStoredViewTab(): SessionNavViewTab {
  if (typeof window === 'undefined') return 'agent';
  try {
    const raw = localStorage.getItem(SESSION_NAV_VIEW_TAB_KEY);
    if (raw === 'session') return 'session';
  } catch {
    /* ignore */
  }
  return 'agent';
}

function readStoredPanelMode(): SessionNavPanelMode {
  if (typeof window === 'undefined') return 'agents';
  try {
    const raw = localStorage.getItem(SESSION_NAV_PANEL_MODE_KEY);
    if (raw === 'files' || raw === 'search') return raw;
  } catch {
    /* ignore */
  }
  return 'agents';
}

export function useSessionNavState() {
  const [panelOpen, setPanelOpenState] = useState(readStoredPanelOpen);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [viewTab, setViewTabState] = useState<SessionNavViewTab>('agent');
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [panelMode, setPanelModeState] = useState<SessionNavPanelMode>('agents');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPanelOpenState(readStoredPanelOpen());
    setViewTabState(readStoredViewTab());
    setPanelModeState(readStoredPanelMode());
    setHydrated(true);
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
    try {
      localStorage.setItem(SESSION_NAV_STORAGE_KEY, String(open));
    } catch {
      /* ignore */
    }
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SESSION_NAV_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(true);
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
  }, []);

  const setViewTab = useCallback((tab: SessionNavViewTab) => {
    setViewTabState(tab);
    try {
      localStorage.setItem(SESSION_NAV_VIEW_TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, []);

  const setPanelMode = useCallback((mode: SessionNavPanelMode) => {
    setPanelModeState(mode);
    try {
      localStorage.setItem(SESSION_NAV_PANEL_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    panelOpen,
    setPanelOpen,
    togglePanel,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
    viewTab: hydrated ? viewTab : 'agent',
    setViewTab,
    expandedAgentId,
    setExpandedAgentId,
    panelMode,
    setPanelMode,
    hydrated,
  };
}
