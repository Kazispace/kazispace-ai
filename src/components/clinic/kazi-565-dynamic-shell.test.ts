import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-565 — public Clinic first paint must not statically pull rails / shell.
 */
describe('KAZI-565 dynamic ClinicShell and rails', () => {
  it('chat page uses next/dynamic for ClinicShell', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/(workspace)/chat/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/next\/dynamic/);
    expect(src).toMatch(/clinic-shell/);
    expect(src).not.toMatch(
      /import\s+\{\s*ClinicShell\s*\}\s+from\s+["']@\/components\/clinic\/clinic-shell["']/
    );
  });

  it('ChatSideRailsHost dynamically imports CV and Job rails', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../chat/chat-side-rails-host.tsx'),
      'utf8'
    );
    expect(src).toMatch(/next\/dynamic/);
    expect(src).not.toMatch(
      /import\s+\{\s*CvWorkspaceRail\s*\}\s+from/
    );
    expect(src).not.toMatch(
      /import\s+\{\s*JobDetailRail\s*\}\s+from/
    );
  });
});
