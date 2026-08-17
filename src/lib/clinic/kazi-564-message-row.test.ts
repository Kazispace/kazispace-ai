import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import {
  mapStrategySelectTurnContexts,
  resolveStrategySelectTurnContext,
} from '@/lib/strategy-select';
import { spaceMessageRowEqual } from '@/components/spaces/space-message-row';
import type { SpaceMessageRowProps } from '@/components/spaces/space-message-row';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { ChatNextAction } from '@/types/chat-envelope';

const strategyActions: ChatNextAction[] = [
  {
    type: 'strategy_select',
    label: { zh: '在现有版本上精修', en: 'Refine current version' },
    payload: '__strategy:continue_current',
  },
];

function msg(
  id: string,
  role: 'user' | 'assistant',
  content: string,
  extra: Partial<SpaceChatMessage> = {}
): SpaceChatMessage {
  return { id, role, content, ...extra };
}

function rowProps(
  message: SpaceChatMessage,
  overrides: Partial<SpaceMessageRowProps> = {}
): SpaceMessageRowProps {
  const noop = () => undefined;
  return {
    message,
    strategy: {},
    locale: 'en',
    actionsDisabled: false,
    onRetryById: noop,
    onNextAction: noop,
    onFocusComposer: noop,
    onExamSelect: noop,
    onJobCardClick: noop,
    ...overrides,
  };
}

describe('KAZI-564 message row isolation', () => {
  it('precomputes the same strategy context as per-row resolve', () => {
    const messages = [
      msg('a1', 'assistant', 'pick', { nextActions: strategyActions }),
      msg('u1', 'user', '在现有版本上精修'),
      msg('a2', 'assistant', 'ok'),
    ];
    const mapped = mapStrategySelectTurnContexts(messages, 'zh');
    expect(mapped).toHaveLength(3);
    mapped.forEach((ctx, index) => {
      expect(ctx).toEqual(
        resolveStrategySelectTurnContext(messages, index, 'zh')
      );
    });
    expect(mapped[0]?.selectedStrategyPayload).toBe(
      '__strategy:continue_current'
    );
    expect(mapped[0]?.activeNextActions).toBeUndefined();
  });

  it('append/patch of row N does not break equality of stable N-1 rows', () => {
    const first = msg('a1', 'assistant', 'hello');
    const second = msg('u1', 'user', 'hi');
    const handlers = {
      onRetryById: () => undefined,
      onNextAction: () => undefined,
      onFocusComposer: () => undefined,
      onExamSelect: () => undefined,
      onJobCardClick: () => undefined,
    };

    const prevFirst = rowProps(first, handlers);
    const nextFirst = rowProps(first, handlers);
    expect(spaceMessageRowEqual(prevFirst, nextFirst)).toBe(true);

    const patchedSecond = { ...second, status: 'failed' as const };
    const prevSecond = rowProps(second, handlers);
    const nextSecond = rowProps(patchedSecond, handlers);
    expect(spaceMessageRowEqual(prevSecond, nextSecond)).toBe(false);

    const appended = msg('a2', 'assistant', 'new');
    expect(spaceMessageRowEqual(prevFirst, rowProps(first, handlers))).toBe(
      true
    );
    expect(appended.id).toBe('a2');
  });

  it('Space and Clinic lists no longer scan history inside map', () => {
    const spacePane = readFileSync(
      path.resolve(__dirname, '../../components/spaces/space-chat-pane.tsx'),
      'utf8'
    );
    const spaceList = readFileSync(
      path.resolve(__dirname, '../../components/spaces/space-message-list.tsx'),
      'utf8'
    );
    const clinic = readFileSync(
      path.resolve(__dirname, '../../components/clinic/clinic-shell.tsx'),
      'utf8'
    );
    expect(spacePane).toMatch(/mapStrategySelectTurnContexts/);
    expect(spacePane).toMatch(/SpaceMessageList/);
    expect(spacePane).not.toMatch(/resolveStrategySelectTurnContext\(/);
    expect(spaceList).toMatch(/SpaceMessageRow/);
    expect(spaceList).not.toMatch(/resolveStrategySelectTurnContext\(/);
    expect(clinic).toMatch(/mapStrategySelectTurnContexts/);
    expect(clinic).toMatch(/ClinicMessageRow/);
    expect(clinic).not.toMatch(/resolveStrategySelectTurnContext\(/);
  });
});
