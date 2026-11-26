'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { SpaceDetail } from '@/types/spaces';

import { ExamModeSwitch } from '@/components/exam/exam-mode-switch';
import { SpacePanelsWorkspace } from '@/components/spaces/space-panels-workspace';
import { readExamMode, writeExamMode, type ExamMode } from '@/lib/exam-mode';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface IeltsPrepWorkspaceProps {
  space: SpaceDetail;
  active?: boolean;
}

const panelId = (mode: ExamMode) => `exam-mode-panel-${mode}`;

/**
 * The English Space, which is the Exam destination (kazispace-ui D36, Exam 0.1.1; KAZI-1485):
 * the Chat / Form switch on top. Chat is the Space's conversation with its EPP panel (ADR-006
 * Phase B). Form is not built yet: `studio.comingSoon`, nothing to tap, while the switch still
 * offers both. Switching is navigation and ends nothing, so Chat stays mounted (hidden) while
 * Form shows: a practice in progress is still there when the user switches back.
 */
export function IeltsPrepWorkspace({ space, active = true }: IeltsPrepWorkspaceProps) {
  const tStudio = useTranslations('studio');
  // Chat on the server and on first paint; the remembered mode after mount, so the HTML
  // the server sends and the first client render agree.
  const [mode, setMode] = useState<ExamMode>('chat');
  useEffect(() => setMode(readExamMode()), []);
  // Studio's Get started sends its text to Exam's Chat mode (Studio 0.5.1): show Chat whatever
  // mode Exam was left in, so the composer that takes the text is the one on screen.
  const examInsertPending = useUIStore((s) => s.composerInsert?.target === 'exam');
  useEffect(() => {
    if (!examInsertPending) return;
    setMode('chat');
    writeExamMode('chat');
  }, [examInsertPending]);
  const choose = (next: ExamMode) => {
    setMode(next);
    writeExamMode(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ExamModeSwitch mode={mode} onChange={choose} panelId={panelId} />
      <div
        id={panelId('chat')}
        role="tabpanel"
        aria-labelledby="exam-mode-tab-chat"
        hidden={mode !== 'chat'}
        className={cn('min-h-0 flex-1 flex-col', mode === 'chat' ? 'flex' : 'hidden')}
      >
        <SpacePanelsWorkspace space={space} welcomeKey="ieltsWelcome" active={active} />
      </div>
      <div
        id={panelId('form')}
        role="tabpanel"
        aria-labelledby="exam-mode-tab-form"
        hidden={mode !== 'form'}
        data-testid="exam-form-panel"
        className={cn('min-h-0 flex-1 overflow-y-auto bg-gray-bg px-4 py-6', mode === 'form' ? 'block' : 'hidden')}
      >
        <p data-testid="exam-form-coming-soon" className="text-sm text-workspace-muted">
          {tStudio('comingSoon')}
        </p>
      </div>
    </div>
  );
}
