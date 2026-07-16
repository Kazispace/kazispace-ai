'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { VoiceEnabledChatInput } from '@/components/chat/voice-enabled-chat-input';
import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import { SpacePanelHost } from '@/components/spaces/panels/space-panel-host';
import {
  SpacePanelTabs,
  type SpaceWorkspaceView,
} from '@/components/spaces/space-panel-tabs';
import { isSpaceComposerMuted } from '@/lib/spaces/lifecycle';
import {
  isValidPanelId,
  resolveDefaultPanelId,
  resolveSpacePanels,
} from '@/lib/spaces/panels';
import { resolveSpaceJobId } from '@/lib/spaces/space-context';
import { useSpaceStore } from '@/lib/store';
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
  const muted = isSpaceComposerMuted(space.status);

  const panels = useMemo(() => resolveSpacePanels(space), [space]);
  const defaultPanelId = resolveDefaultPanelId(panels);
  const panelFromUrl = searchParams.get('panel');
  const fallbackPanelId = defaultPanelId ?? panels[0]?.panel_id ?? 'panel';
  const activePanelHint = useSpaceStore(
    (s) => s.getSpaceSlice(space.id).activePanelHint
  );
  const setSpaceActivePanelHint = useSpaceStore((s) => s.setSpaceActivePanelHint);

  const initialView: SpaceWorkspaceView = useMemo(() => {
    if (panelFromUrl && isValidPanelId(panels, panelFromUrl)) {
      return panelFromUrl;
    }
    return 'chat';
  }, [panelFromUrl, panels]);

  const [mobileView, setMobileView] = useState<SpaceWorkspaceView>(initialView);
  const urlRequestsPanel = panelFromUrl != null && isValidPanelId(panels, panelFromUrl);
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(urlRequestsPanel);
  const [desktopPanelId, setDesktopPanelId] = useState(
    urlRequestsPanel ? panelFromUrl! : fallbackPanelId
  );

  useEffect(() => {
    if (panelFromUrl && isValidPanelId(panels, panelFromUrl)) {
      setMobileView(panelFromUrl);
      setDesktopPanelId(panelFromUrl);
      setDesktopPanelOpen(true);
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

  const handleTabChange = useCallback(
    (view: SpaceWorkspaceView) => {
      handleMobileViewChange(view);
      if (view === 'chat') {
        setDesktopPanelOpen(false);
      } else if (isValidPanelId(panels, view)) {
        if (desktopPanelOpen && desktopPanelId === view) {
          setDesktopPanelOpen(false);
          setMobileView('chat');
        } else {
          setDesktopPanelId(view);
          setDesktopPanelOpen(true);
          syncPanelQuery(view);
        }
      }
    },
    [desktopPanelId, desktopPanelOpen, handleMobileViewChange, panels, syncPanelQuery]
  );

  /** Envelope `meta.active_panel` / `ui_hints.panel_id` → switch + clear hint. */
  useEffect(() => {
    if (!activePanelHint) return;
    if (!isValidPanelId(panels, activePanelHint)) {
      setSpaceActivePanelHint(space.id, null);
      return;
    }
    setDesktopPanelId(activePanelHint);
    setDesktopPanelOpen(true);
    setMobileView(activePanelHint);
    syncPanelQuery(activePanelHint);
    setSpaceActivePanelHint(space.id, null);
  }, [
    activePanelHint,
    panels,
    setSpaceActivePanelHint,
    space.id,
    syncPanelQuery,
  ]);

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

  const desktopActive: SpaceWorkspaceView = desktopPanelOpen ? desktopPanelId : 'chat';

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-bg">
      <SpacePanelTabs
        panels={panels}
        active={mobileView}
        desktopActive={desktopActive}
        onChange={handleTabChange}
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
            welcomeKey={welcomeKey}
            composer={({ sendMessage, isSending, spaceSessionReady }) => (
              <VoiceEnabledChatInput
                onSend={(text) => void sendMessage(text)}
                disabled={muted || isSending || !spaceSessionReady}
                placeholder={muted ? t('composerMuted') : t('composerPlaceholder')}
                showAttachButton
              />
            )}
          />
        </section>

        <aside
          className={cn(
            'flex min-h-0 flex-col border-gray-200/80 bg-white lg:w-[min(440px,40vw)] lg:shrink-0 lg:border-l',
            mobileView === 'chat' && !desktopPanelOpen && 'hidden',
            mobileView === 'chat' && desktopPanelOpen && 'hidden lg:flex',
            mobileView !== 'chat' && 'flex flex-1 lg:flex-none'
          )}
        >
          {mobilePanel || activePanel ? (
            <SpacePanelHost
              panel={(mobilePanel ?? activePanel)!}
              locale={locale}
              spaceId={space.id}
              jobId={jobId}
              className="min-h-0 flex-1"
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
