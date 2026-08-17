/**
 * @vitest-environment jsdom
 */
import { act, useCallback, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  useActiveWorkspacePortalWrite,
  useActiveWorkspaceRailEvents,
} from '@/hooks/use-active-workspace-chrome';
import {
  publishSessionNavToggleWorkspaceRail,
  SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT,
  SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT,
} from '@/lib/session-nav-events';
import {
  subscribeActiveWorkspaceRailEvents,
  writeActiveWorkspacePortal,
} from '@/lib/spaces/active-workspace-chrome';

function CachedChromeProbe({
  id,
  active,
  panelOpen,
  portalLog,
}: {
  id: string;
  active: boolean;
  panelOpen: Record<string, boolean>;
  portalLog: { id: string; open: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  useActiveWorkspaceRailEvents(active, {
    onOpen: () => {
      setOpen(true);
      panelOpen[id] = true;
    },
    onToggle: () => {
      setOpen((prev) => {
        const next = !prev;
        panelOpen[id] = next;
        return next;
      });
    },
  });
  const setPortal = useCallback(
    (next: boolean) => {
      portalLog.push({ id, open: next });
    },
    [id, portalLog]
  );
  useActiveWorkspacePortalWrite(active, setPortal, open);
  return <div data-space={id} data-open={open ? '1' : '0'} />;
}

function Trio({
  activeId,
  panelOpen,
  portalLog,
}: {
  activeId: 'A' | 'B' | 'C';
  panelOpen: Record<string, boolean>;
  portalLog: { id: string; open: boolean }[];
}) {
  return (
    <>
      <CachedChromeProbe
        id="A"
        active={activeId === 'A'}
        panelOpen={panelOpen}
        portalLog={portalLog}
      />
      <CachedChromeProbe
        id="B"
        active={activeId === 'B'}
        panelOpen={panelOpen}
        portalLog={portalLog}
      />
      <CachedChromeProbe
        id="C"
        active={activeId === 'C'}
        panelOpen={panelOpen}
        portalLog={portalLog}
      />
    </>
  );
}

describe('KAZI-573 keep-alive activation isolation', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
  });

  it('A→B→C: toggle event only changes active B and writes B portal', () => {
    const panelOpen: Record<string, boolean> = {};
    const portalLog: { id: string; open: boolean }[] = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => {
      root!.render(
        <Trio activeId="B" panelOpen={panelOpen} portalLog={portalLog} />
      );
    });

    act(() => {
      publishSessionNavToggleWorkspaceRail();
    });

    expect(panelOpen.A).toBeUndefined();
    expect(panelOpen.B).toBe(true);
    expect(panelOpen.C).toBeUndefined();
    expect(portalLog.some((row) => row.id === 'A')).toBe(false);
    expect(portalLog.some((row) => row.id === 'C')).toBe(false);
    expect(portalLog.some((row) => row.id === 'B' && row.open === true)).toBe(
      true
    );
  });

  it('inactive subscribers do not hear rail events on a shared target', () => {
    const target = new EventTarget();
    const hits = { A: 0, B: 0, C: 0 };
    const unsubA = subscribeActiveWorkspaceRailEvents(
      false,
      { onOpen: () => hits.A++, onToggle: () => hits.A++ },
      target
    );
    const unsubB = subscribeActiveWorkspaceRailEvents(
      true,
      { onOpen: () => hits.B++, onToggle: () => hits.B++ },
      target
    );
    const unsubC = subscribeActiveWorkspaceRailEvents(
      false,
      { onOpen: () => hits.C++, onToggle: () => hits.C++ },
      target
    );

    target.dispatchEvent(new Event(SESSION_NAV_TOGGLE_WORKSPACE_RAIL_EVENT));
    target.dispatchEvent(new Event(SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT));
    expect(hits).toEqual({ A: 0, B: 2, C: 0 });
    unsubA();
    unsubB();
    unsubC();
  });

  it('portal writes are skipped when inactive', () => {
    const seen: boolean[] = [];
    writeActiveWorkspacePortal(false, (open) => seen.push(open), true);
    expect(seen).toEqual([]);
    writeActiveWorkspacePortal(true, (open) => seen.push(open), true);
    expect(seen).toEqual([true]);
  });
});
