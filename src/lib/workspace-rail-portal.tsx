'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type WorkspaceRailPortalContextValue = {
  portalHost: HTMLElement | null;
  setPortalHost: (element: HTMLElement | null) => void;
};

const WorkspaceRailPortalContext =
  createContext<WorkspaceRailPortalContextValue | null>(null);

/** Portal target for workspace chat right rail (full-height column beside context header). */
export function WorkspaceRailPortalProvider({ children }: { children: ReactNode }) {
  const [portalHost, setPortalHostState] = useState<HTMLElement | null>(null);
  const setPortalHost = useCallback((element: HTMLElement | null) => {
    setPortalHostState(element);
  }, []);

  const value = useMemo(
    () => ({ portalHost, setPortalHost }),
    [portalHost, setPortalHost]
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
