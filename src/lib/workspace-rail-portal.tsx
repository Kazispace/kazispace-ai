'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  registerSessionNavChatSideRailOpenSync,
  SESSION_NAV_CHAT_SIDE_RAIL_OPEN_EVENT,
} from '@/lib/session-nav-events';

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
  const setChatSideRailOpenRef = useRef(setChatSideRailOpen);
  setChatSideRailOpenRef.current = setChatSideRailOpen;

  const setPortalHost = useCallback((element: HTMLElement | null) => {
    setPortalHostState(element);
  }, []);

  const setChatSideRailOpenStable = useCallback((open: boolean) => {
    setChatSideRailOpenRef.current(open);
  }, []);

  useEffect(() => {
    registerSessionNavChatSideRailOpenSync((open: boolean) => {
      setChatSideRailOpenRef.current(open);
    });
    return () => registerSessionNavChatSideRailOpenSync(undefined);
  }, []);

  useEffect(() => {
    const onSideRail = (event: Event) => {
      const open = Boolean(
        (event as CustomEvent<{ open: boolean }>).detail?.open
      );
      setChatSideRailOpenRef.current(open);
    };
    window.addEventListener(SESSION_NAV_CHAT_SIDE_RAIL_OPEN_EVENT, onSideRail);
    return () =>
      window.removeEventListener(
        SESSION_NAV_CHAT_SIDE_RAIL_OPEN_EVENT,
        onSideRail
      );
  }, []);

  const value = useMemo(
    () => ({
      portalHost,
      setPortalHost,
      chatSideRailOpen,
      setChatSideRailOpen: setChatSideRailOpenStable,
    }),
    [portalHost, setPortalHost, chatSideRailOpen, setChatSideRailOpenStable]
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
