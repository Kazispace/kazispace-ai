'use client';

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';

import { JobDetailRail } from '@/components/jobs/job-detail-rail';
import { cn } from '@/lib/utils';

const DEFAULT_RAIL_WIDTH = 480;
const MIN_RAIL_WIDTH = 320;
const MAX_RAIL_WIDTH = 720;
const WIDTH_STORAGE_KEY = 'ks.jobDetailRail.width.v1';

interface JobDetailRailHostProps {
  jobId: string | null;
  locale: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
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
    // private mode / quota
  }
}

/**
 * Chat column + optional job detail rail.
 * Desktop: resizable right aside. Mobile: full-screen overlay.
 */
export function JobDetailRailHost({
  jobId,
  locale,
  onClose,
  children,
  className,
}: JobDetailRailHostProps) {
  const t = useTranslations('jobs');
  const hostRef = useRef<HTMLDivElement>(null);
  const [railWidth, setRailWidth] = useState(DEFAULT_RAIL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const stored = readStoredWidth();
    if (stored == null) return;
    const containerWidth = hostRef.current?.clientWidth ?? window.innerWidth;
    setRailWidth(clampRailWidth(stored, containerWidth));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jobId, onClose]);

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

  const applyWidthFromClientX = useCallback((clientX: number) => {
    const drag = dragRef.current;
    const host = hostRef.current;
    if (!drag || !host) return;
    const delta = drag.startX - clientX;
    const next = clampRailWidth(
      drag.startWidth + delta,
      host.clientWidth
    );
    setRailWidth(next);
  }, []);

  const stopResize = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsResizing(false);
    setRailWidth((current) => {
      writeStoredWidth(current);
      return current;
    });
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (event: PointerEvent) => {
      applyWidthFromClientX(event.clientX);
    };
    const onUp = () => stopResize();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [applyWidthFromClientX, isResizing, stopResize]);

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: railWidth };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <div
      ref={hostRef}
      className={cn('relative flex min-h-0 flex-1', className)}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>

      {jobId ? (
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
              aria-orientation="vertical"
              aria-valuenow={railWidth}
              aria-valuemin={MIN_RAIL_WIDTH}
              aria-valuemax={MAX_RAIL_WIDTH}
              aria-label={t('resizeDetail')}
              onPointerDown={onResizePointerDown}
              className={cn(
                'absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none',
                'bg-transparent hover:bg-kazi-orange/20',
                isResizing && 'bg-kazi-orange/30'
              )}
            />
            <JobDetailRail
              jobId={jobId}
              locale={locale}
              onClose={onClose}
            />
          </aside>
          <div
            className={cn(
              'absolute inset-0 z-30 flex flex-col bg-white lg:hidden',
              'animate-in fade-in slide-in-from-right duration-200'
            )}
          >
            <JobDetailRail
              jobId={jobId}
              locale={locale}
              onClose={onClose}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
