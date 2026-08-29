/**
 * @vitest-environment jsdom
 */
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';

function TestDialog({
  open,
  onClose,
  lockBodyScroll,
}: {
  open: boolean;
  onClose: () => void;
  lockBodyScroll?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  useDialogFocusTrap({ open, onClose, dialogRef, initialFocusRef, lockBodyScroll });

  if (!open) return null;

  return (
    <div ref={dialogRef} role="dialog">
      <button type="button" ref={initialFocusRef} data-testid="first">
        First
      </button>
      <button type="button" data-testid="last">
        Last
      </button>
    </div>
  );
}

/** Re-renders TestDialog with a *new* onClose identity each time, like an inline arrow prop. */
function UnstableCallbackHost({
  open,
  onCloseSpy,
}: {
  open: boolean;
  onCloseSpy: () => void;
}) {
  const [renderCount, setRenderCount] = useState(0);
  return (
    <div>
      <button type="button" data-testid="rerender" onClick={() => setRenderCount((n) => n + 1)}>
        rerender {renderCount}
      </button>
      <TestDialog open={open} onClose={() => onCloseSpy()} />
    </div>
  );
}

describe('KAZI-652 useDialogFocusTrap', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  let outsideButton: HTMLButtonElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    outsideButton = document.createElement('button');
    document.body.appendChild(outsideButton);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    outsideButton?.remove();
    document.body.style.overflow = '';
    root = null;
    host = null;
    outsideButton = null;
  });

  it('moves focus to initialFocusRef when it opens', async () => {
    await act(async () => {
      root!.render(<TestDialog open={true} onClose={vi.fn()} />);
    });

    expect(document.activeElement).toBe(host!.querySelector('[data-testid="first"]'));
  });

  it('wraps Tab forward from the last element to the first, and Shift+Tab backward', async () => {
    await act(async () => {
      root!.render(<TestDialog open={true} onClose={vi.fn()} />);
    });

    const first = host!.querySelector('[data-testid="first"]') as HTMLButtonElement;
    const last = host!.querySelector('[data-testid="last"]') as HTMLButtonElement;

    last.focus();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      );
    });
    expect(document.activeElement).toBe(first);

    first.focus();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.activeElement).toBe(last);
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root!.render(<TestDialog open={true} onClose={onClose} />);
    });

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on close', async () => {
    document.body.style.overflow = 'auto';

    await act(async () => {
      root!.render(<TestDialog open={true} onClose={vi.fn()} />);
    });
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      root!.render(<TestDialog open={false} onClose={vi.fn()} />);
    });
    expect(document.body.style.overflow).toBe('auto');
  });

  it('does not lock body scroll when lockBodyScroll is false', async () => {
    document.body.style.overflow = 'auto';

    await act(async () => {
      root!.render(<TestDialog open={true} onClose={vi.fn()} lockBodyScroll={false} />);
    });

    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores focus to the previously-focused element after closing', async () => {
    outsideButton!.focus();
    expect(document.activeElement).toBe(outsideButton);

    await act(async () => {
      root!.render(<TestDialog open={true} onClose={vi.fn()} />);
    });
    expect(document.activeElement).not.toBe(outsideButton);

    await act(async () => {
      root!.render(<TestDialog open={false} onClose={vi.fn()} />);
    });
    expect(document.activeElement).toBe(outsideButton);
  });

  // Regression: an inline `onClose={() => ...}` prop is a new function every
  // render. Before this fix, that identity change was in the effect's deps,
  // so a parent re-render while the dialog was open re-ran the whole effect —
  // stealing focus back to initialFocusRef away from wherever the user had
  // tabbed to, and briefly re-toggling the body scroll lock.
  it('does not steal focus back or re-toggle scroll lock when onClose changes identity while open', async () => {
    const onCloseSpy = vi.fn();
    await act(async () => {
      root!.render(<UnstableCallbackHost open={true} onCloseSpy={onCloseSpy} />);
    });

    const last = host!.querySelector('[data-testid="last"]') as HTMLButtonElement;
    last.focus();
    expect(document.activeElement).toBe(last);

    // Force a parent re-render, which creates a brand-new onClose closure.
    const rerenderButton = host!.querySelector('[data-testid="rerender"]') as HTMLButtonElement;
    await act(async () => {
      rerenderButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Focus must stay put — the effect must not have re-run and re-focused `first`.
    expect(document.activeElement).toBe(last);
    // Scroll lock must still be applied (not restored-then-reapplied,
    // which would be a symptom of the effect having re-run).
    expect(document.body.style.overflow).toBe('hidden');

    // The latest onClose is still the one Escape calls.
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
});
