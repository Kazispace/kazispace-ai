'use client';

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bot,
  FileText,
  Languages,
  MessageCircle,
  MessageSquare,
  Mic,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';

import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import { cn } from '@/lib/utils';

const AGENT_ICONS: Record<string, LucideIcon> = {
  job_search: Target,
  cv_builder: FileText,
  mock_interview: Mic,
  english_tutor: Languages,
  career_sprint: Timer,
};

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  clinic_default: MessageCircle,
  blank_conversation: MessageSquare,
  job_sprint: Target,
  ielts_prep: BookOpen,
};

export interface AgentNavIconProps {
  agentId: string | null | undefined;
  className?: string;
  /** Tailwind size class for the icon (default h-4 w-4). */
  sizeClassName?: string;
}

export function AgentNavIcon({
  agentId,
  className,
  sizeClassName = 'h-4 w-4',
}: AgentNavIconProps) {
  const Icon =
    agentId === 'clinic' || agentId == null
      ? MessageCircle
      : (AGENT_ICONS[agentId] ?? Bot);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-kazi-orange',
        className
      )}
      aria-hidden
    >
      <Icon className={sizeClassName} strokeWidth={2} />
    </span>
  );
}

export interface SpaceTemplateNavIconProps {
  templateId?: string | null;
  spaceId?: string | null;
  className?: string;
  sizeClassName?: string;
}

export function SpaceTemplateNavIcon({
  templateId,
  spaceId,
  className,
  sizeClassName = 'h-4 w-4',
}: SpaceTemplateNavIconProps) {
  const isClinic = spaceId === CLINIC_SPACE_ID;
  const Icon = isClinic
    ? MessageCircle
    : (templateId && TEMPLATE_ICONS[templateId]) || Sparkles;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-kazi-orange',
        className
      )}
      aria-hidden
    >
      <Icon className={sizeClassName} strokeWidth={2} />
    </span>
  );
}
