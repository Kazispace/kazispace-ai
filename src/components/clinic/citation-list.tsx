'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink } from 'lucide-react';

import type { CitationItem } from '@/lib/clinic/citation-list';
import { cn } from '@/lib/utils';

type CitationListProps = {
  items: CitationItem[];
  className?: string;
};

/** KAZI-223: Research citation_list custom_component — compact clickable sources. */
export function CitationList({ items, className }: CitationListProps) {
  const t = useTranslations('chat');
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 py-1.5',
        className,
      )}
    >
      <p className="mb-1 text-xs font-medium text-gray-500">
        {t('sources')}
        <span className="ml-1 font-normal text-gray-400">· {items.length}</span>
      </p>
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <li key={item.url} className="min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={item.url}
              className="inline-flex max-w-full items-start gap-1 text-sm text-kazi-orange underline-offset-2 hover:underline"
            >
              <ExternalLink
                className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70"
                aria-hidden
              />
              <span className="min-w-0 truncate">{item.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
