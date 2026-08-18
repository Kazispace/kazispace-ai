import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

function readRel(rel: string): string {
  return readFileSync(path.resolve(__dirname, rel), 'utf8');
}

/**
 * KAZI-578 — workspace first paint keeps icon rail + center; side list is a
 * separate chunk. Do not hide the cost with setTimeout / opacity / shell memo.
 */
describe('KAZI-578 SessionNav first-paint split', () => {
  it('workspace layout still mounts SessionNavShell', () => {
    const src = readRel('../../app/[locale]/(workspace)/layout.tsx');
    expect(src).toMatch(/SessionNavShell/);
  });

  it('shell defers side list / file / search / template picker', () => {
    const src = readRel('./session-nav-shell.tsx');
    expect(src).toMatch(/next\/dynamic/);
    expect(src).toMatch(/loadSessionNavPanel/);
    expect(src).toMatch(/loadSessionFileLibraryPanel/);
    expect(src).toMatch(/loadSessionGlobalSearchPanel/);
    expect(src).toMatch(/loadSpaceTemplatePicker/);
    expect(src).toMatch(/SessionNavPanelSlot/);
    expect(src).toMatch(/w-\[260px\]/);
    expect(src).toMatch(/mountDesktopPanel/);
    expect(src).toMatch(/mountMobilePanel/);
    expect(src).toMatch(/hydrated/);
    expect(src).not.toMatch(/opacity-0|setTimeout|debounce/);
    expect(src).not.toMatch(
      /import\s+\{\s*SessionNavPanel\s*\}\s+from\s+['"]@\/components\/session-nav\/session-nav-panel['"]/
    );
    expect(src).not.toMatch(
      /import\s+\{\s*SessionFileLibraryPanel\s*\}\s+from\s+['"]@\/components\/session-nav\/session-file-library-panel['"]/
    );
    expect(src).not.toMatch(
      /import\s+\{\s*SessionGlobalSearchPanel\s*\}\s+from\s+['"]@\/components\/session-nav\/session-global-search-panel['"]/
    );
    expect(src).not.toMatch(
      /import\s+\{\s*SpaceTemplatePicker\s*\}\s+from\s+['"]@\/components\/spaces\/space-template-picker['"]/
    );
  });

  it('loaders point at the heavy panel modules', () => {
    const src = readRel('../../lib/session-nav/load-session-nav-panels.ts');
    expect(src).toMatch(/session-nav-panel/);
    expect(src).toMatch(/session-file-library-panel/);
    expect(src).toMatch(/session-global-search-panel/);
    expect(src).toMatch(/space-template-picker/);
  });

  it('keeps icon rail and context header on the first-paint chrome path', () => {
    const src = readRel('./session-nav-shell.tsx');
    expect(src).toMatch(
      /import\s+\{\s*SessionIconRail\s*\}\s+from\s+['"]@\/components\/session-nav\/session-icon-rail['"]/
    );
    expect(src).toMatch(
      /import\s+\{\s*SessionContextHeader\s*\}\s+from\s+['"]@\/components\/session-nav\/session-context-header['"]/
    );
  });
});
