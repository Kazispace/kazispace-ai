'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useSessionNavState } from '@/hooks/use-session-nav-state';
import { resolveSurfaceFromPathname } from '@/lib/agent-transition/surfaces';
import { useUIStore } from '@/lib/store';
import { SessionContextHeader } from '@/components/session-nav/session-context-header';
import { SessionIconRail } from '@/components/session-nav/session-icon-rail';
import { SessionNavPanel } from '@/components/session-nav/session-nav-panel';

interface SessionNavShellProps {
  locale: string;
  children: React.ReactNode;
}

export function SessionNavShell({ locale, children }: SessionNavShellProps) {
  const pathname = usePathname();
  const isTelegramMiniApp = useUIStore((s) => s.isTelegramMiniApp);
  const t = useTranslations('sessionNav');
  const isClinic = resolveSurfaceFromPathname(pathname) === 'clinic';
  const {
    panelOpen,
    setPanelOpen,
    togglePanel,
    mobileDrawerOpen,
    openMobileDrawer,
    closeMobileDrawer,
  } = useSessionNavState();

  if (isTelegramMiniApp) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F4F5F7]">
      <SessionIconRail
        locale={locale}
        panelOpen={panelOpen}
        onTogglePanel={togglePanel}
        onOpenMobileDrawer={openMobileDrawer}
      />

      <SessionNavPanel
        locale={locale}
        open={panelOpen}
        mobileDrawer={mobileDrawerOpen}
        onClose={() => {
          if (mobileDrawerOpen) closeMobileDrawer();
          else setPanelOpen(false);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center border-b border-[#E5E6EB] bg-white md:hidden">
          <button
            type="button"
            onClick={openMobileDrawer}
            className="m-2 rounded-lg p-2 text-[#1D2129] hover:bg-[#F2F3F5]"
            aria-label={t('openPanel')}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        {!isClinic && <SessionContextHeader locale={locale} />}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
