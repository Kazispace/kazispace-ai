'use client';

import { useLocale } from 'next-intl';

import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import { SpaceComposerWithStarter } from '@/components/spaces/space-composer-with-starter';
import { isSpaceComposerMuted } from '@/lib/spaces/lifecycle';
import type { SpaceDetail } from '@/types/spaces';

interface BlankConversationWorkspaceProps {
  space: SpaceDetail;
}

/** ADR-006 Phase B — 空白对话: chat composer only (no side panels). */
export function BlankConversationWorkspace({ space }: BlankConversationWorkspaceProps) {
  const locale = useLocale();
  const muted = isSpaceComposerMuted(space.status);

  return (
    <SpaceChatPane
      key={space.id}
      locale={locale}
      space={space}
      welcomeKey="blankWelcome"
      composer={(ctx) => (
        <SpaceComposerWithStarter space={space} muted={muted} {...ctx} />
      )}
    />
  );
}
