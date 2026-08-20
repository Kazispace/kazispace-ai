import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('KAZI-573 keep-alive shell contracts', () => {
  it('workspace layout owns SpaceWorkspace keep-alive, spaces page does not remount it', () => {
    const workspace = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/(workspace)/layout.tsx'),
      'utf8'
    );
    const spacesLayout = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/(workspace)/spaces/layout.tsx'),
      'utf8'
    );
    const page = readFileSync(
      path.resolve(
        __dirname,
        '../../app/[locale]/(workspace)/spaces/[spaceId]/page.tsx'
      ),
      'utf8'
    );
    expect(workspace).toMatch(/SpaceWorkspaceKeepAlive/);
    expect(spacesLayout).not.toMatch(/SpaceWorkspaceKeepAlive/);
    expect(page).not.toMatch(/SpaceWorkspace/);
    expect(page).toMatch(/return null/);
  });

  it('keeps cached workspaces mounted when the route is Clinic', () => {
    const host = readFileSync(
      path.resolve(__dirname, './space-workspace-keep-alive.tsx'),
      'utf8'
    );
    expect(host).not.toMatch(/if \(!spaceId\) return children/);
    expect(host).toMatch(/hideRouteChildren/);
    expect(host).toMatch(/clinicCached/);
    expect(host).toMatch(/ClinicShell locale=\{locale\} active=\{isClinic\}/);
  });

  it('hides inactive workspaces and does not mount panels when inactive', () => {
    const host = readFileSync(
      path.resolve(__dirname, './space-workspace-keep-alive.tsx'),
      'utf8'
    );
    const panels = readFileSync(
      path.resolve(__dirname, './space-panels-workspace.tsx'),
      'utf8'
    );
    expect(host).toMatch(/active=\{active\}/);
    expect(host).toMatch(/!active && 'hidden'/);
    expect(panels).toMatch(/useActiveWorkspaceRailEvents/);
    expect(panels).toMatch(/useActiveWorkspacePortalWrite/);
    expect(panels).toMatch(/SpacePanelHost/);
  });

  it('ClinicShell gates rail events on active and does not remount-bootstrap', () => {
    const shell = readFileSync(
      path.resolve(__dirname, '../clinic/clinic-shell.tsx'),
      'utf8'
    );
    expect(shell).toMatch(/useActiveWorkspaceRailEvents\(active/);
    expect(shell).toMatch(/didClinicBootstrapRef/);
    expect(shell).toMatch(/alignToLatest:\s*true/);
    expect(shell).not.toMatch(/window\.addEventListener\(\s*SESSION_NAV_OPEN_WORKSPACE_RAIL_EVENT/);
  });

  it('SpaceChatPane gates rail events on active', () => {
    const pane = readFileSync(
      path.resolve(__dirname, './space-chat-pane.tsx'),
      'utf8'
    );
    expect(pane).toMatch(/useActiveWorkspaceRailEvents\(active && !hasCvPanel/);
    expect(pane).not.toMatch(/window\.addEventListener/);
  });
});
