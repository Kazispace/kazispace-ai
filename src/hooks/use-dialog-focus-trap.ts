'use client';

import { useEffect, type RefObject } from 'react';

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
        onClose();
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
  }, [open, onClose, dialogRef, initialFocusRef, lockBodyScroll]);
}
