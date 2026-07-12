'use client';

import Link from 'next/link';
import {
  Bot,
  FolderOpen,
  MessageCircle,
  PanelLeftClose,
  Search,
  Settings,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { getSurfacePath } from '@/lib/agent-transition/surfaces';

interface SessionIconRailProps {
  locale: string;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onOpenMobileDrawer: () => void;
}

export function SessionIconRail({
  locale,
  panelOpen,
  onTogglePanel,
  onOpenMobileDrawer,
}: SessionIconRailProps) {
  const pathname = usePathname();
  const t = useTranslations('sessionNav');
  const isClinic = pathname.includes(`/${locale}/chat`);

  const handleAgentsClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onOpenMobileDrawer();
      return;
    }
    onTogglePanel();
  };

  const iconBtn = (
    active: boolean,
    onClick: () => void,
    label: string,
    icon: React.ReactNode
  ) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-lg text-[#86909C] transition-colors hover:bg-[#F2F3F5] hover:text-[#1D2129]',
        active && 'bg-[#FFF4EC] text-kazi-orange before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-kazi-orange'
      )}
    >
      {icon}
    </button>
  );

  return (
    <nav
      aria-label={t('iconRail')}
      className="hidden md:flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[#E5E6EB] bg-[#F4F5F7] py-3"
    >
      <Link
        href={`/${locale}`}
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold text-kazi-orange"
        aria-label="KaziSpace"
      >
        K
      </Link>

      <Link
        href={getSurfacePath(locale, 'clinic')}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
          isClinic
            ? 'bg-[#FFF4EC] text-kazi-orange before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-kazi-orange'
            : 'text-[#86909C] hover:bg-[#F2F3F5]'
        )}
        aria-label={t('clinic')}
        title={t('clinic')}
      >
        <MessageCircle className="h-5 w-5" />
      </Link>

      {iconBtn(panelOpen, handleAgentsClick, t('agents'), <Bot className="h-5 w-5" />)}

      <button
        type="button"
        disabled
        title={t('comingSoon')}
        className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg text-[#C9CDD4]"
        aria-label={t('files')}
      >
        <FolderOpen className="h-5 w-5" />
      </button>

      <button
        type="button"
        disabled
        title={t('comingSoon')}
        className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg text-[#C9CDD4]"
        aria-label={t('search')}
      >
        <Search className="h-5 w-5" />
      </button>

      <div className="mt-auto flex flex-col gap-1">
        <Link
          href={`/${locale}/mine`}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[#86909C] hover:bg-[#F2F3F5]"
          aria-label={t('settings')}
          title={t('settings')}
        >
          <Settings className="h-5 w-5" />
        </Link>
        {panelOpen && (
          <button
            type="button"
            onClick={onTogglePanel}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#86909C] hover:bg-[#F2F3F5]"
            aria-label={t('collapsePanel')}
            title={t('collapsePanel')}
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>
    </nav>
  );
}
