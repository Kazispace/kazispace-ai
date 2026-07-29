import type { ActivateAgentResponse } from '@/types';

export const SESSION_NAV_VIEW_TAB_KEY = 'kazi.sessionNav.viewTab';

export const SESSION_NAV_SELECT_HISTORY_EVENT = 'kazi-session-nav-select-history';

export const SESSION_NAV_SESSION_OPENED_EVENT = 'kazi-session-nav-session-opened';

export const SESSION_NAV_SESSION_EXITED_EVENT = 'kazi-session-nav-session-exited';

export const SESSION_NAV_OPEN_FILE_EVENT = 'kazi-session-nav-open-file';

/** Open Clinic / Space right-rail workspace hub (icon tiles). */
export const SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT =
  'kazi-session-nav-open-workspace-rail';

export function publishSessionNavOpenWorkspaceRail(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT)
  );
}

/** Toggle Clinic / Space workspace asset rail (open ↔ close). */
export const SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT =
  'kazi-session-nav-toggle-workspace-rail';

export function publishSessionNavToggleWorkspaceRail(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT)
  );
}

export const SESSION_NAV_CHAT_SIDE_RAIL_OPEN_EVENT =
  'kazi-session-nav-chat-side-rail-open';

let chatSideRailOpenSync: ((open: boolean) => void) | undefined;

/** Shell layout reads open state synchronously (portal column width). */
export function registerSessionNavChatSideRailOpenSync(
  fn: ((open: boolean) => void) | undefined
): void {
  chatSideRailOpenSync = fn;
}

export function publishSessionNavChatSideRailOpen(open: boolean): void {
  chatSideRailOpenSync?.(open);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SESSION_NAV_CHAT_SIDE_RAIL_OPEN_EVENT, {
      detail: { open },
    })
  );
}

export type SessionNavOpenFileDetail = {
  agentId: string;
  sessionId: string;
  fileName: string;
};

export type SessionNavSelectHistoryDetail = {
  agentId: string;
  sessionId: string;
};

export type SessionNavSessionOpenedDetail = {
  agentId: string;
  data: ActivateAgentResponse;
};

export function publishSessionNavSelectHistory(
  agentId: string,
  sessionId: string
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SessionNavSelectHistoryDetail>(SESSION_NAV_SELECT_HISTORY_EVENT, {
      detail: { agentId, sessionId },
    })
  );
}

export function publishSessionNavSessionOpened(
  agentId: string,
  data: ActivateAgentResponse
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SessionNavSessionOpenedDetail>(SESSION_NAV_SESSION_OPENED_EVENT, {
      detail: { agentId, data },
    })
  );
}

export function publishSessionNavSessionExited(agentId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ agentId: string }>(SESSION_NAV_SESSION_EXITED_EVENT, {
      detail: { agentId },
    })
  );
}

export function publishSessionNavOpenFile(detail: SessionNavOpenFileDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SessionNavOpenFileDetail>(SESSION_NAV_OPEN_FILE_EVENT, {
      detail,
    })
  );
}
