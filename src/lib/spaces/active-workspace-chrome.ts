import {
  SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT,
  SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT,
} from '@/lib/session-nav-events';

export type ActiveWorkspaceRailHandlers = {
  onOpen: () => void;
  onToggle: () => void;
};

type EventSink = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

/**
 * Keep-alive activation contract (KAZI-573): inactive cached workspaces
 * keep chat DOM but must not subscribe to global rail events.
 */
export function subscribeActiveWorkspaceRailEvents(
  active: boolean,
  handlers: ActiveWorkspaceRailHandlers,
  target: EventSink | null
): () => void {
  if (!active || !target) return () => undefined;
  target.addEventListener(SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT, handlers.onOpen);
  target.addEventListener(
    SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT,
    handlers.onToggle
  );
  return () => {
    target.removeEventListener(
      SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT,
      handlers.onOpen
    );
    target.removeEventListener(
      SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT,
      handlers.onToggle
    );
  };
}

export function writeActiveWorkspacePortal(
  active: boolean,
  setOpen: ((open: boolean) => void) | undefined,
  open: boolean
): void {
  if (!active || !setOpen) return;
  setOpen(open);
}
