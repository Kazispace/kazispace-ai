'use client';

import { cn } from '@/lib/utils';

interface NbaActionCardSkeletonProps {
  className?: string;
}

export function NbaActionCardSkeleton({ className }: NbaActionCardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 animate-pulse',
        className
      )}
      aria-hidden
    >
      <div className="h-3 w-28 bg-gray-200 rounded mb-3" />
      <div className="flex gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-gray-200 rounded" />
          <div className="h-3 w-full bg-gray-100 rounded" />
          <div className="h-8 w-24 bg-gray-200 rounded mt-2" />
        </div>
      </div>
    </div>
  );
}
