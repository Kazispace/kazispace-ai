'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';

import { CvWorkspaceRail } from '@/components/cv/cv-workspace-rail';
import { JobDetailRail } from '@/components/jobs/job-detail-rail';
import type { AgentSurfaceId } from '@/lib/agent-transition/types';
import type { JobPracticeContext } from '@/types/jobs';
import { cn } from '@/lib/utils';

const DEFAULT_RAIL_WIDTH = 480;
const MIN_RAIL_WIDTH = 320;
const MAX_RAIL_WIDTH = 720;
const KEYBOARD_STEP_PX = 16;
const WIDTH_STORAGE_KEY = 'ks.chatSideRail.width.v1';

export interface CvRailState {
  open: boolean;
  jobId?: string | null;
}

/** Passed into CV rail when host is Space (blank template); Clinic omits → defaults. */
export interface CvRailTransitionContext {
  fromSurface: AgentSurfaceId;
  returnHref?: string;
}

interface ChatSideRailsHostProps {
  locale: string;
  children: ReactNode;
  className?: string;
  jobId: string | null;
  onCloseJob: () => void;
  cvRail: CvRailState;
  onCloseCv: () => void;
  cvRailTransition?: CvRailTransitionContext;
  onPracticeForJob?: (ctx: JobPracticeContext) => void;
  practiceDisabled?: boolean;
}

function clampRailWidth(width: number, containerWidth: number): number {
  const maxForChat = Math.max(
    MIN_RAIL_WIDTH,
    Math.floor(containerWidth * 0.55)
  );
  const max = Math.min(MAX_RAIL_WIDTH, maxForChat);
  return Math.min(max, Math.max(MIN_RAIL_WIDTH, Math.round(width)));
}

function readStoredWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WIDTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredWidth(width: number): void {
  try {
    sessionStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  } catch {
    // ignore
  }
}

/**
 * Clinic / Space chat column + optional right rail (job detail or CV workspace).
 * CV rail takes precedence over job rail when both are requested.
 */
export function ChatSideRailsHost({
  locale,
  children,
  className,
  jobId,
  onCloseJob,
  cvRail,
  onCloseCv,
  cvRailTransition,
  onPracticeForJob,
  practiceDisabled = false,
}: ChatSideRailsHostProps) {
  const tJobs = useTranslations('jobs');
  const hostRef = useRef<HTMLDivElement>(null);
  const railWidthRef = useRef(DEFAULT_RAIL_WIDTH);
  const [railWidth, setRailWidthState] = useState(DEFAULT_RAIL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const railKind = cvRail.open ? 'cv' : jobId ? 'job' : null;
  const onCloseRail = cvRail.open ? onCloseCv : onCloseJob;

  const setRailWidth = useCallback((next: number, persist = false) => {
    const hostWidth = hostRef.current?.clientWidth ?? window.innerWidth;
    const clamped = clampRailWidth(next, hostWidth);
    railWidthRef.current = clamped;
    setRailWidthState(clamped);
    if (persist) writeStoredWidth(clamped);
  }, []);

  useEffect(() => {
    const stored = readStoredWidth();
    if (stored == null) return;
    setRailWidth(stored);
  }, [setRailWidth]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setRailWidth(railWidthRef.current);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [setRailWidth]);

  useEffect(() => {
    if (!railKind) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRail();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [railKind, onCloseRail]);

  useEffect(() => {
    if (!isResizing) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isResizing]);

  const applyWidthFromClientX = useCallback(
    (clientX: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startX - clientX;
      setRailWidth(drag.startWidth + delta);
    },
    [setRailWidth]
  );

  const stopResize = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsResizing(false);
    writeStoredWidth(railWidthRef.current);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (event: PointerEvent) => {
      applyWidthFromClientX(event.clientX);
    };
    const onUp = () => stopResize();
    const onBlur = () => stopResize();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [applyWidthFromClientX, isResizing, stopResize]);

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startWidth: railWidthRef.current,
    };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onResizeKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const hostWidth = hostRef.current?.clientWidth ?? window.innerWidth;
    const max = Math.min(
      MAX_RAIL_WIDTH,
      Math.max(MIN_RAIL_WIDTH, Math.floor(hostWidth * 0.55))
    );
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = railWidthRef.current + KEYBOARD_STEP_PX;
        break;
      case 'ArrowRight':
        next = railWidthRef.current - KEYBOARD_STEP_PX;
        break;
      case 'Home':
        next = MIN_RAIL_WIDTH;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setRailWidth(next, true);
  };

  const railInner =
    railKind === 'cv' ? (
      <CvWorkspaceRail
        locale={locale}
        jobId={cvRail.jobId}
        onClose={onCloseCv}
        transitionFromSurface={cvRailTransition?.fromSurface}
        transitionReturnHref={cvRailTransition?.returnHref}
      />
    ) : railKind === 'job' && jobId ? (
      <JobDetailRail
        jobId={jobId}
        locale={locale}
        onClose={onCloseJob}
        onPracticeForJob={onPracticeForJob}
        practiceDisabled={practiceDisabled}
      />
    ) : null;

  return (
    <div
      ref={hostRef}
      className={cn('relative flex min-h-0 flex-1', className)}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>

      {railInner ? (
        <>
          <aside
            style={{ width: railWidth }}
            className={cn(
              'relative hidden min-h-0 shrink-0 flex-col',
              'border-l border-gray-200/80 bg-white lg:flex',
              !isResizing &&
                'animate-in fade-in slide-in-from-right-4 duration-200'
            )}
          >
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-valuenow={railWidth}
              aria-valuemin={MIN_RAIL_WIDTH}
              aria-valuemax={MAX_RAIL_WIDTH}
              aria-label={tJobs('resizeDetail')}
              onPointerDown={onResizePointerDown}
              onKeyDown={onResizeKeyDown}
              className={cn(
                'absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none',
                'bg-gray-200/70 hover:bg-kazi-orange/35',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
                isResizing && 'bg-kazi-orange/40'
              )}
            />
            {railInner}
          </aside>
          <div
            className={cn(
              'absolute inset-0 z-30 flex flex-col bg-white lg:hidden',
              'animate-in fade-in slide-in-from-right duration-200'
            )}
          >
            {railInner}
          </div>
        </>
      ) : null}
    </div>
  );
}
