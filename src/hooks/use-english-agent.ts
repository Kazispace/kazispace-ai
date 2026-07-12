'use client';

import { useTranslations } from 'next-intl';

import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import {
  useHubAgentChat,
  type HubChatMessage,
} from '@/hooks/use-hub-agent-chat';

/** Stable id for seeded welcome — namespaced per agent surface. */
const WELCOME_ID = 'english_chat_welcome';

export type EnglishChatMessage = HubChatMessage;

export function useEnglishAgent(locale: string, enabled: boolean) {
  const t = useTranslations('english');

  return useHubAgentChat({
    agentId: ENGLISH_TUTOR_AGENT_ID,
    locale,
    enabled,
    welcomeMessageId: WELCOME_ID,
    seedWelcome: () => t('chatWelcome'),
    labels: {
      openFailed: t('chatOpenFailed'),
      sendFailed: t('chatSendFailed'),
      emptyReply: t('chatEmptyReply'),
    },
  });
}
