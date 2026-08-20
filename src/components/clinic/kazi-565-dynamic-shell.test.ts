import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-565 — public Clinic first paint must not statically pull rails / shell / YAML.
 */
describe('KAZI-565 dynamic ClinicShell and rails', () => {
  it('keep-alive dynamically loads ClinicShell; chat page does not pull it', () => {
    const page = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/(workspace)/chat/page.tsx'),
      'utf8'
    );
    const host = readFileSync(
      path.resolve(
        __dirname,
        '../spaces/space-workspace-keep-alive.tsx'
      ),
      'utf8'
    );
    const layout = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/(workspace)/layout.tsx'),
      'utf8'
    );
    expect(page).toMatch(/return null/);
    expect(page).not.toMatch(/clinic-shell/);
    expect(page).not.toMatch(/ClinicShell/);
    expect(host).toMatch(/next\/dynamic/);
    expect(host).toMatch(/clinic-shell/);
    expect(host).not.toMatch(
      /import\s+\{\s*ClinicShell\s*\}\s+from\s+["']@\/components\/clinic\/clinic-shell["']/
    );
    expect(layout).not.toMatch(/clinic-shell/);
  });

  it('ChatSideRailsHost dynamically imports CV and Job rails', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../chat/chat-side-rails-host.tsx'),
      'utf8'
    );
    expect(src).toMatch(/next\/dynamic/);
    expect(src).not.toMatch(/import\s+\{\s*CvWorkspaceRail\s*\}\s+from/);
    expect(src).not.toMatch(/import\s+\{\s*JobDetailRail\s*\}\s+from/);
  });

  it('Providers does not statically import ensureDirectoryLoaded', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../providers.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(
      /import\s*\{[^}]*ensureDirectoryLoaded[^}]*\}\s*from\s*["']@\/lib\/region["']/
    );
    expect(src).toMatch(/import\(["']@\/lib\/region["']\)/);
    expect(src).toMatch(/DIRECTORY_IDLE_TIMEOUT_MS/);
  });
});
