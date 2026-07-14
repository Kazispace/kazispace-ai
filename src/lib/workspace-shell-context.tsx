'use client';

import { createContext, useContext } from 'react';

/** True when rendered inside `(workspace)` + SessionNavShell (not TMA standalone). */
const WorkspaceShellContext = createContext(false);

export function WorkspaceShellProvider({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShellContext.Provider value={true}>{children}</WorkspaceShellContext.Provider>
  );
}

export function useEmbeddedInWorkspaceShell(): boolean {
  return useContext(WorkspaceShellContext);
}
