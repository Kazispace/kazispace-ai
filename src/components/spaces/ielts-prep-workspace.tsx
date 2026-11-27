'use client';

import { useLocale } from 'next-intl';

import type { SpaceDetail } from '@/types/spaces';

import { SpaceChatPane } from '@/components/spaces/space-chat-pane';
import { SpaceComposerWithStarter } from '@/components/spaces/space-composer-with-starter';
import { isSpaceComposerMuted } from '@/lib/spaces/lifecycle';

interface IeltsPrepWorkspaceProps {
  space: SpaceDetail;
  active?: boolean;
}

/**
 * The English Space (ADR-006 Phase B — 雅思备考): its conversation only, with no panel row
 * (kazispace-ui D38, Exam 0.2). Exam's Chat / Form switch is the only row of tabs; the panel
 * row added a second "Chat" under it, and its one panel, the English passport, is in Studio.
 * ❌ Former: space chat + EPP panel behind a "Chat | English passport" row; then (D36) the
 * Chat / Form switch on top of that row.
 */
export function IeltsPrepWorkspace({ space, active = true }: IeltsPrepWorkspaceProps) {
  const locale = useLocale();
  const muted = isSpaceComposerMuted(space.status);

  return (
    <SpaceChatPane
      key={space.id}
      locale={locale}
      space={space}
      welcomeKey="ieltsWelcome"
      active={active}
      composer={(ctx) => (
        <SpaceComposerWithStarter space={space} muted={muted} active={active} {...ctx} />
      )}
    />
  );
}
