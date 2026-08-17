import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-566 — first paint and Space switch must not wait on Google Fonts,
 * CSS-hidden panel chunks, or smooth follow-scroll.
 */
describe('KAZI-566 load / switch shell contracts', () => {
  it('locale layout self-hosts Inter and does not load fonts.googleapis.com', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/layout.tsx'),
      'utf8'
    );
    expect(src).toMatch(/next\/font\/google/);
    expect(src).toMatch(/--font-inter/);
    expect(src).not.toMatch(/fonts\.googleapis\.com/);
    expect(src).not.toMatch(/fonts\.gstatic\.com/);
  });

  it('does not mount SpacePanelHost while the panel is CSS-hidden', () => {
    const src = readFileSync(
      path.resolve(__dirname, './space-panels-workspace.tsx'),
      'utf8'
    );
    expect(src).toMatch(/desktopPanelOpen \|\| mobileView !== 'chat'/);
    expect(src).toMatch(/SpacePanelHost/);
  });

  it('follows new messages with instant scroll, not smooth', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../hooks/use-chat-scroll.ts'),
      'utf8'
    );
    expect(src).toMatch(/scrollElementToBottom\(el, 'auto'\)/);
    expect(src).toMatch(/scrollElementToBottom\(el, 'smooth'\)/);
  });

  it('remounts SpaceChatPane per space.id so A→B does not reuse historyReady', () => {
    const panels = readFileSync(
      path.resolve(__dirname, './space-panels-workspace.tsx'),
      'utf8'
    );
    const blank = readFileSync(
      path.resolve(__dirname, './blank-conversation-workspace.tsx'),
      'utf8'
    );
    const workspace = readFileSync(
      path.resolve(__dirname, './space-workspace.tsx'),
      'utf8'
    );
    const pane = readFileSync(
      path.resolve(__dirname, './space-chat-pane.tsx'),
      'utf8'
    );
    expect(panels).toMatch(/<SpaceChatPane\s+key=\{space\.id\}/);
    expect(blank).toMatch(/<SpaceChatPane\s+key=\{space\.id\}/);
    expect(workspace).toMatch(/<SpaceWorkspaceFrame key=\{space\.id\}>/);
    expect(pane).toMatch(/spaceChatFirstPaintKind/);
  });

  it('session nav prefetches space detail and history before push', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../session-nav/session-nav-panel.tsx'),
      'utf8'
    );
    expect(src).toMatch(/prefetchSpaceSwitch/);
    expect(src).toMatch(/onMouseEnter/);
    expect(src).toMatch(/onPointerDown/);
  });
});
