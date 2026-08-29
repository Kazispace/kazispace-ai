/**
 * @vitest-environment jsdom
 *
 * Regression coverage for the review finding on PR #208 (KAZI-652): both
 * dialogs are rendered with `position: fixed`, and their only prior callers
 * mount them deep inside scrollable panels (e.g. a mobile session-nav
 * drawer). An `overflow-hidden` or `transform` ancestor there would turn
 * into this dialog's containing block and clip the overlay instead of
 * covering the viewport. Portaling to `document.body` removes that risk
 * regardless of where the caller mounts the dialog.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ConfirmAbandonSessionDialog } from '@/components/session-nav/confirm-abandon-session-dialog';

/** Simulates a clipping ancestor, e.g. the mobile session-nav drawer. */
function ClippingAncestor({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflow: 'hidden', transform: 'translateZ(0)' }} data-testid="clipping-ancestor">
      {children}
    </div>
  );
}

describe('KAZI-652 dialogs portal to document.body', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    document.body.style.overflow = '';
    root = null;
    host = null;
  });

  it('ConfirmDialog renders as a direct child of document.body, not the clipping ancestor', async () => {
    await act(async () => {
      root!.render(
        <ClippingAncestor>
          <ConfirmDialog
            open={true}
            title="Delete?"
            description="This cannot be undone."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        </ClippingAncestor>
      );
    });

    expect(host!.querySelector('[data-testid="clipping-ancestor"] [role="dialog"]')).toBeNull();
    const dialog = document.body.querySelector(':scope > [role="presentation"] [role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Delete?');
  });

  it('ConfirmAbandonSessionDialog renders as a direct child of document.body', async () => {
    await act(async () => {
      root!.render(
        <ClippingAncestor>
          <ConfirmAbandonSessionDialog
            open={true}
            agentId={null}
            locale="en"
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        </ClippingAncestor>
      );
    });

    expect(host!.querySelector('[data-testid="clipping-ancestor"] [role="dialog"]')).toBeNull();
    const dialog = document.body.querySelector(':scope > [role="presentation"] [role="dialog"]');
    expect(dialog).not.toBeNull();
  });
});
