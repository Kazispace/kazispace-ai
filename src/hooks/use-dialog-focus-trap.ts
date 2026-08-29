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
  /** Lock document body scroll while open. */
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
