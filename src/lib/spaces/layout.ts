import type { SpaceDetail } from '@/types/spaces';

export type SpaceLayout = 'chat_only' | 'chat_with_panels';

const PANEL_TEMPLATE_IDS = new Set(['job_sprint', 'ielts_prep']);

export function resolveSpaceLayout(
  space: Pick<SpaceDetail, 'template_id' | 'config_snapshot'>
): SpaceLayout {
  const fromConfig = (
    space.config_snapshot?.rendering as { layout?: string } | undefined
  )?.layout;

  if (fromConfig === 'chat_only' || fromConfig === 'chat_with_panels') {
    return fromConfig;
  }

  if (space.template_id === 'blank_conversation') {
    return 'chat_only';
  }

  if (PANEL_TEMPLATE_IDS.has(space.template_id)) {
    return 'chat_with_panels';
  }

  return 'chat_only';
}
