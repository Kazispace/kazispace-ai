'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type UseDialogFocusTrapOptions = {
  open: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLElement | null>;
  /** Element to focus when the dialog opens (e.g. close button). */
  initialFocusRef: RefObject<HTMLElement | null>;
  /**
   * Lock document body scroll while open.
   *
   * KAZI-664 verified (real Chromium via Playwright, not jsdom — hit-testing
   * needs actual layout) what this does and doesn't protect against, for a
   * dialog using the `fixed inset-0 ... bg-black/40` pattern all 6 of this
   * hook's callers use (ConfirmDialog, ConfirmAbandonSessionDialog,
   * AgentSwitchDialog, PaywallModal, CvNewSessionDialog, SpaceTemplatePicker
   * — an earlier pass of this comment said 5 and missed the last one; all 6
   * are now portaled to document.body):
   *
   * - This flag has ZERO effect on a nested `overflow-y:auto` container
   *   behind the dialog (e.g. the Clinic/Space virtuoso message list) —
   *   `document.body.style.overflow` only scopes to body's own scrollbox,
   *   unrelated to any other element's.
   * - It's also not what stops the user from scrolling that background list
   *   via mouse wheel. The full-viewport backdrop physically covers it, so
   *   browser hit-testing routes the wheel event to the backdrop, not the
   *   list, whether or not body scroll is locked — confirmed empirically:
   *   opening the overlay WITHOUT this flag already leaves the background
   *   list's scrollTop unchanged after a wheel gesture over it.
   * - Keyboard-driven scroll of the background is separately blocked by
   *   this hook's own focus trap: `initialFocusRef.current?.focus()` moves
   *   focus into the dialog on open regardless of what had it before, and
   *   Tab is trapped inside — so nothing in the background can hold focus
   *   for Space/PageDown to act on either.
   *
   * So for this dialog shape, `lockBodyScroll` is redundant with those two
   * mechanisms for preventing background scroll — its actual job is a
   * narrower one: some mobile browsers (historically iOS Safari) can let a
   * touch/rubber-band gesture scroll the document behind a `fixed` overlay
   * via elastic overscroll, a quirk unrelated to normal hit-testing and not
   * reproducible in a desktop headless check. Keeping this on is cheap
   * insurance for that specific case, not a guard for nested containers —
   * do not extend this hook with per-container locking to "fix" the nested
   * case above, there is nothing there to fix.
   *
   * Known pre-existing gap (not introduced or fixed by KAZI-664): if two of
   * these dialogs are ever open at once, each captures body's overflow
   * value at its own open time and restores that value on its own close.
   * Closing them out of LIFO order (the one opened first closes first)
   * restores the pre-first-dialog value while the second is still open,
   * unlocking body scroll early. Whether any two of the 6 callers can
   * actually stack today (e.g. a paywall trigger firing while
   * AgentSwitchDialog is open) hasn't been audited — flagged so the
   * verification above isn't misread as covering the stacked case too.
   */
  lockBodyScroll?: boolean;
};

/**
 * Escape to close, Tab focus trap inside dialog, restore prior focus on cleanup.
 * Shared by modal dialogs that are not on Radix Dialog yet.
 */
export function useDialogFocusTrap({
  open,
  onClose,
  dialogRef,
  initialFocusRef,
  lockBodyScroll = true,
}: UseDialogFocusTrapOptions) {
  // Always call the latest onClose without needing it in the effect's deps —
  // an inline arrow prop (`onClose={() => ...}`) is a fresh function every
  // render, and putting it in the deps array would re-run the whole effect
  // (re-focus, re-lock scroll, re-register the listener) on every parent
  // render while the dialog is open, not just on open/close transitions.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    initialFocusRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) {
      document.body.style.overflow = 'hidden';
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (lockBodyScroll) {
        document.body.style.overflow = previousOverflow;
      }
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose is read via onCloseRef, see above.
  }, [open, dialogRef, initialFocusRef, lockBodyScroll]);
}
