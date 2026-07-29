'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { registerSessionNavChatSideRailOpenSync } from '@/lib/session-nav-events';

type WorkspaceRailPortalContextValue = {
  portalHost: HTMLElement | null;
  setPortalHost: (element: HTMLElement | null) => void;
  chatSideRailOpen: boolean;
  setChatSideRailOpen: (open: boolean) => void;
};

const WorkspaceRailPortalContext =
  createContext<WorkspaceRailPortalContextValue | null>(null);

/** Portal target + chat side-rail open state (workspace shell right column). */
export function WorkspaceRailPortalProvider({ children }: { children: ReactNode }) {
  const [portalHost, setPortalHostState] = useState<HTMLElement | null>(null);
  const [chatSideRailOpen, setChatSideRailOpen] = useState(false);

  const setPortalHost = useCallback((element: HTMLElement | null) => {
    setPortalHostState(element);
  }, []);

  useEffect(
    () => registerSessionNavChatSideRailOpenSync(setChatSideRailOpen),
    []
  );

  const value = useMemo(
    () => ({
      portalHost,
      setPortalHost,
      chatSideRailOpen,
      setChatSideRailOpen,
    }),
    [portalHost, setPortalHost, chatSideRailOpen]
  );

  return (
    <WorkspaceRailPortalContext.Provider value={value}>
      {children}
    </WorkspaceRailPortalContext.Provider>
  );
}

export function useWorkspaceRailPortal(): WorkspaceRailPortalContextValue | null {
  return useContext(WorkspaceRailPortalContext);
}
