import { Drama, GraduationCap, Inbox, Radio, User, type LucideIcon } from 'lucide-react';

import type { TopLevelDestination } from '@/lib/top-level-nav';

/**
 * The icons of the five top-level destinations, shared by the mobile tab bar and the
 * desktop navigation rail (kazispace-ui D31, D36; KAZI-1485): Exam is exam English, Radio
 * the personal radio, Scenes role-play in real-life scenes, Messages what the user receives
 * (not a conversation: Exam's chat is the conversation), Me the account.
 */
export const TOP_LEVEL_ICONS: Record<TopLevelDestination, LucideIcon> = {
  exam: GraduationCap,
  radio: Radio,
  scenes: Drama,
  messages: Inbox,
  me: User,
};
