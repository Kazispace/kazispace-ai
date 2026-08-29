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
 *
 * KAZI-664 extends the same coverage to the 3 dialogs KAZI-652 left
 * un-portaled (AgentSwitchDialog/PaywallModal/CvNewSessionDialog) — not
 * because they were observed clipping anywhere today, but because "not
 * clipped yet" isn't a structural guarantee, and all 5 dialogs should now
 * behave consistently.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ConfirmAbandonSessionDialog } from '@/components/session-nav/confirm-abandon-session-dialog';
import { AgentSwitchDialog } from '@/components/clinic/agent-switch-dialog';
import { PaywallModal } from '@/components/billing/paywall-modal';
import { CvNewSessionDialog } from '@/components/cv/cv-new-session-dialog';
import { useUIStore } from '@/lib/store';

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

  it('AgentSwitchDialog renders as a direct child of document.body (KAZI-664)', async () => {
    await act(async () => {
      root!.render(
        <ClippingAncestor>
          <AgentSwitchDialog
            locale="en"
            fromAgentId="agent_a"
            toAgentId="agent_b"
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
          />
        </ClippingAncestor>
      );
    });

    expect(host!.querySelector('[data-testid="clipping-ancestor"] [role="dialog"]')).toBeNull();
    const dialog = document.body.querySelector(':scope > [role="dialog"]');
    expect(dialog).not.toBeNull();
  });

  it('PaywallModal renders as a direct child of document.body (KAZI-664)', async () => {
    await act(async () => {
      useUIStore.setState({ paywallModalOpen: true, paywallTrigger: 'PRO_FEATURE_LOCKED' });
      root!.render(
        <ClippingAncestor>
          <PaywallModal locale="en" />
        </ClippingAncestor>
      );
    });

    expect(host!.querySelector('[data-testid="clipping-ancestor"] [role="dialog"]')).toBeNull();
    const dialog = document.body.querySelector(':scope > [role="dialog"]');
    expect(dialog).not.toBeNull();
    act(() => {
      useUIStore.setState({ paywallModalOpen: false, paywallTrigger: null });
    });
  });

  it('CvNewSessionDialog renders as a direct child of document.body (KAZI-664)', async () => {
    await act(async () => {
      root!.render(
        <ClippingAncestor>
          <CvNewSessionDialog open={true} onConfirm={vi.fn()} onCancel={vi.fn()} />
        </ClippingAncestor>
      );
    });

    expect(host!.querySelector('[data-testid="clipping-ancestor"] [role="dialog"]')).toBeNull();
    const dialog = document.body.querySelector(':scope > [role="dialog"]');
    expect(dialog).not.toBeNull();
  });
});
