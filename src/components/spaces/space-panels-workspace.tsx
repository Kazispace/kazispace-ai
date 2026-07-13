'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { ChatInput } from '@/components/chat/chat-input';
import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import { SpacePanelHost } from '@/components/spaces/panels/space-panel-host';
import {
  SpacePanelTabs,
  type SpaceWorkspaceView,
} from '@/components/spaces/space-panel-tabs';
import {
  isValidPanelId,
  resolveDefaultPanelId,
  resolveSpacePanels,
} from '@/lib/spaces/panels';
import { resolveSpaceJobId } from '@/lib/spaces/space-context';
import { getSpacePanelLabel } from '@/lib/spaces/panel-labels';
import { cn } from '@/lib/utils';
import type { SpaceDetail } from '@/types/spaces';

type SpacePanelsWelcomeKey = 'jobSprintWelcome' | 'ieltsWelcome';

interface SpacePanelsWorkspaceProps {
  space: SpaceDetail;
  welcomeKey: SpacePanelsWelcomeKey;
}

/** ADR-006 Phase B — chat_with_panels layout: space chat + template panels. */
export function SpacePanelsWorkspace({ space, welcomeKey }: SpacePanelsWorkspaceProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('spaces');
  const locale = (params.locale as string) ?? 'en';
  const jobId = resolveSpaceJobId(space, searchParams);

  const panels = useMemo(() => resolveSpacePanels(space), [space]);
  const defaultPanelId = resolveDefaultPanelId(panels);
  const panelFromUrl = searchParams.get('panel');
  const fallbackPanelId = defaultPanelId ?? panels[0]?.panel_id ?? 'panel';

  const initialView: SpaceWorkspaceView = useMemo(() => {
    if (panelFromUrl && isValidPanelId(panels, panelFromUrl)) {
      return panelFromUrl;
    }
    return 'chat';
  }, [panelFromUrl, panels]);

  const [mobileView, setMobileView] = useState<SpaceWorkspaceView>(initialView);
  const [desktopPanelId, setDesktopPanelId] = useState(
    isValidPanelId(panels, panelFromUrl) ? panelFromUrl! : fallbackPanelId
  );

  useEffect(() => {
    if (panelFromUrl && isValidPanelId(panels, panelFromUrl)) {
      setMobileView(panelFromUrl);
      setDesktopPanelId(panelFromUrl);
    }
  }, [panelFromUrl, panels]);

  const syncPanelQuery = useCallback(
    (panelId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set('panel', panelId);
      router.replace(`/${locale}/spaces/${space.id}?${next.toString()}`, {
        scroll: false,
      });
    },
    [locale, router, searchParams, space.id]
  );

  const handleMobileViewChange = useCallback(
    (view: SpaceWorkspaceView) => {
      setMobileView(view);
      if (view !== 'chat' && isValidPanelId(panels, view)) {
        syncPanelQuery(view);
      }
    },
    [panels, syncPanelQuery]
  );

  const handleDesktopPanelChange = useCallback(
    (panelId: string) => {
      setDesktopPanelId(panelId);
      syncPanelQuery(panelId);
    },
    [syncPanelQuery]
  );

  const activePanel =
    panels.find((panel) => panel.panel_id === desktopPanelId) ?? panels[0];
  const mobilePanel =
    mobileView === 'chat'
      ? null
      : (panels.find((panel) => panel.panel_id === mobileView) ?? activePanel);

  if (panels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#86909C]">
        {t('templateWorkspaceComingSoon')}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-bg">
      <SpacePanelTabs
        className="lg:hidden"
        panels={panels}
        active={mobileView}
        onChange={handleMobileViewChange}
      />

      <div className="flex min-h-0 flex-1">
        <section
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            mobileView !== 'chat' && 'hidden lg:flex'
          )}
        >
          <SpaceChatPane
            locale={locale}
            space={space}
            shellVariant="column"
            welcomeKey={welcomeKey}
            composer={({ sendMessage, isSending }) => (
              <ChatInput
                onSend={(text) => void sendMessage(text)}
                disabled={isSending}
                placeholder={t('composerPlaceholder')}
              />
            )}
          />
        </section>

        <aside
          className={cn(
            'flex min-h-0 flex-col border-gray-200/80 bg-white lg:w-[min(440px,40vw)] lg:shrink-0 lg:border-l',
            mobileView === 'chat' && 'hidden lg:flex',
            mobileView !== 'chat' && 'flex flex-1 lg:flex-none'
          )}
        >
          {panels.length > 1 ? (
            <div className="hidden shrink-0 border-b border-gray-200/80 lg:flex">
              {panels.map((panel) => {
                const selected = panel.panel_id === desktopPanelId;
                return (
                  <button
                    key={panel.panel_id}
                    type="button"
                    onClick={() => handleDesktopPanelChange(panel.panel_id)}
                    className={cn(
                      'relative flex-1 px-3 py-3 text-sm font-medium transition-colors',
                      selected ? 'text-kazi-navy' : 'text-gray-500'
                    )}
                  >
                    {getSpacePanelLabel(panel, t)}
                    {selected ? (
                      <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-kazi-orange" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : activePanel ? (
            <div className="hidden shrink-0 border-b border-gray-200/80 px-4 py-3 lg:block">
              <h2 className="text-sm font-semibold text-kazi-navy">
                {getSpacePanelLabel(activePanel, t)}
              </h2>
            </div>
          ) : null}

          {mobilePanel || activePanel ? (
            <SpacePanelHost
              panel={(mobilePanel ?? activePanel)!}
              locale={locale}
              jobId={jobId}
              className="min-h-0 flex-1"
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
