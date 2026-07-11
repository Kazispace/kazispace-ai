'use client';

import { WorkflowTrack } from '@/components/chat/workflow-track';
import type { AssistantWorkflow } from '@/types/chat-envelope';

interface HubWorkflowStripProps {
  workflow?: AssistantWorkflow;
  locale: string;
}

/** Pinned workflow progress — stays visible while scrolling the chat (§19 / KAZI-130). */
export function HubWorkflowStrip({ workflow, locale }: HubWorkflowStripProps) {
  if (!workflow) return null;

  return (
    <div className="sticky top-0 z-10 shrink-0 px-4 py-2 bg-white/95 border-b border-gray-100 backdrop-blur-sm">
      <WorkflowTrack workflow={workflow} locale={locale} />
    </div>
  );
}
