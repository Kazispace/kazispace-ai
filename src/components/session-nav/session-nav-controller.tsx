'use client';

import { createContext, useContext } from 'react';

/** KAZI-1485 (D36): no `openPanel`: the spaces / specialists list it opened is gone. */
export interface SessionNavControllerValue {
  requestNewSession: (agentId: string, options?: { jobId?: string }) => void;
}

const SessionNavControllerContext = createContext<SessionNavControllerValue | null>(
  null
);

export function SessionNavControllerProvider({
  value,
  children,
}: {
  value: SessionNavControllerValue;
  children: React.ReactNode;
}) {
  return (
    <SessionNavControllerContext.Provider value={value}>
      {children}
    </SessionNavControllerContext.Provider>
  );
}

export function useSessionNavController(): SessionNavControllerValue | null {
  return useContext(SessionNavControllerContext);
}
