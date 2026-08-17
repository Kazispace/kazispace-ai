import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('KAZI-573 keep-alive shell contracts', () => {
  it('spaces layout owns SpaceWorkspace keep-alive, page does not remount it', () => {
    const layout = readFileSync(
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
    expect(layout).toMatch(/SpaceWorkspaceKeepAlive/);
    expect(page).not.toMatch(/SpaceWorkspace/);
    expect(page).toMatch(/return null/);
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
    expect(panels).toMatch(/active &&/);
    expect(panels).toMatch(/SpacePanelHost/);
  });
});
