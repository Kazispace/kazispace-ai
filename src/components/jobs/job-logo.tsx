'use client';

import { Briefcase } from 'lucide-react';

import { cn } from '@/lib/utils';

interface JobLogoProps {
  logoUrl?: string | null;
  company: string;
  className?: string;
  iconClassName?: string;
}

export function JobLogo({
  logoUrl,
  company,
  className,
  iconClassName,
}: JobLogoProps) {
  if (logoUrl) {
    return (
      <div
        className={cn(
          'shrink-0 overflow-hidden rounded-lg bg-white border border-gray-100 flex items-center justify-center',
          className ?? 'w-10 h-10'
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={company}
          className="w-full h-full object-contain p-1"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg bg-kazi-navy/10 flex items-center justify-center shrink-0',
        className ?? 'w-10 h-10'
      )}
    >
      <Briefcase className={cn('text-kazi-navy', iconClassName ?? 'w-5 h-5')} />
    </div>
  );
}
