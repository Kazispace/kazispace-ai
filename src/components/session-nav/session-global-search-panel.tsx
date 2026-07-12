'use client';

import { useState } from 'react';
import { PanelLeftClose, Search, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useGlobalLibrarySearch } from '@/hooks/use-session-library';
import { openAgentSessionTarget } from '@/lib/session-nav';
import type { SessionLibrarySearchHit } from '@/types/session-library';
import { cn } from '@/lib/utils';

interface SessionGlobalSearchPanelProps {
  locale: string;
  open: boolean;
  mobileDrawer: boolean;
  onClose: () => void;
}

export function SessionGlobalSearchPanel({
  locale,
  open,
  mobileDrawer,
  onClose,
}: SessionGlobalSearchPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const [query, setQuery] = useState('');
  const enabled = open || mobileDrawer;
  const { hits, isLoading, error } = useGlobalLibrarySearch(query, enabled);

  const openHit = (hit: SessionLibrarySearchHit) => {
    if (hit.agent_id && hit.session_id) {
      openAgentSessionTarget(router, pathname, locale, hit.agent_id, hit.session_id);
      if (mobileDrawer) onClose();
      return;
    }
    const href = hit.hub_segment ? `/${locale}/${hit.hub_segment}` : `/${locale}/chat`;
    router.push(href);
    if (mobileDrawer) onClose();
  };

  const panelBody = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[#E5E6EB] px-3 py-2">
        <h2 className="text-sm font-semibold text-[#1D2129]">{t('globalSearch')}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#86909C] hover:bg-[#F2F3F5]"
          aria-label={t('collapsePanel')}
        >
          {mobileDrawer ? <X className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      <div className="border-b border-[#E5E6EB] px-3 py-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border border-[#E5E6EB] bg-[#FAFBFC] py-2 pl-8 pr-3 text-sm text-[#1D2129] placeholder:text-[#86909C] focus:border-kazi-orange focus:outline-none"
          />
        </label>
      </div>

      {error ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      ) : null}

      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {!query.trim() ? (
          <li className="px-3 py-6 text-center text-sm text-[#86909C]">
            {t('searchPlaceholder')}
          </li>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <li key={`search-skeleton-${index}`} className="rounded-lg px-3 py-2.5">
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#F2F3F5]" />
              <div className="mt-1.5 h-3 w-full animate-pulse rounded bg-[#F2F3F5]" />
            </li>
          ))
        ) : hits.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-[#86909C]">
            {t('noSearchResults')}
          </li>
        ) : (
          hits.map((hit) => (
            <li key={hit.hit_id}>
              <button
                type="button"
                onClick={() => openHit(hit)}
                className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-[#F2F3F5]"
              >
                <span className="block truncate text-sm font-medium text-[#1D2129]">
                  {hit.title}
                </span>
                {hit.snippet ? (
                  <span className="mt-0.5 block truncate text-xs text-[#86909C]">
                    {hit.snippet}
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  if (mobileDrawer) {
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          aria-label={t('collapsePanel')}
          onClick={onClose}
        />
        <aside className="fixed inset-y-0 left-0 z-50 w-[min(280px,85vw)] shadow-xl md:hidden">
          {panelBody}
        </aside>
      </>
    );
  }

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        'hidden shrink-0 overflow-hidden border-r border-[#E5E6EB] transition-[width] duration-200 ease-out md:block',
        open ? 'w-[260px]' : 'w-0'
      )}
    >
      <div className="h-full w-[260px]">{panelBody}</div>
    </aside>
  );
}
