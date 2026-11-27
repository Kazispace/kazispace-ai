'use client';

import { createContext, useContext } from 'react';

import type { SessionNavViewTab } from '@/lib/session-nav';

export type SessionNavOpenOptions = {
  viewTab?: SessionNavViewTab;
  expandAgentId?: string | null;
};

export interface SessionNavControllerValue {
  openPanel: (options?: SessionNavOpenOptions) => void;
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
