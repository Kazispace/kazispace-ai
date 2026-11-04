import { LayoutDashboard, MessagesSquare, User, type LucideIcon } from 'lucide-react';

import type { TopLevelDestination } from '@/lib/top-level-nav';

/**
 * The icons of the three top-level destinations, shared by the mobile tab bar and the
 * desktop navigation rail (kazispace-ui D31, KAZIOP-3). Space is conversations, Studio is a
 * workbench of sections (not a folder: Studio is "a workbench, not a storage cabinet", D21),
 * Me is the account.
 */
export const TOP_LEVEL_ICONS: Record<TopLevelDestination, LucideIcon> = {
  space: MessagesSquare,
  studio: LayoutDashboard,
  me: User,
};
