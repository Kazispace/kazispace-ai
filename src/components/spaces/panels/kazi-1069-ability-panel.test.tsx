/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/lib/i18n/en.json';
import zh from '@/lib/i18n/zh.json';
import { mergeMessages } from '@/lib/i18n/merge-messages';
import { useAuthStore, useSpaceStore } from '@/lib/store';
import type { EnglishAbilityState } from '@/hooks/use-english-ability';
import type { EnglishAbility } from '@/types/english-ability';

// Backend `compute_ability` output — the same generator as the KAZI-1067 contract.
import fixture from '@/lib/english-tutor/__fixtures__/kazi1067_ability_response.json';

const hookCalls: { enabled: boolean; refreshKey: string | null }[] = [];
let nextState: EnglishAbilityState = { kind: 'loading' };

vi.mock('@/hooks/use-english-ability', () => ({
  useEnglishAbility: (args: { enabled: boolean; refreshKey: string | null }) => {
    hookCalls.push(args);
    return { state: nextState, refetch: vi.fn() };
  },
}));

import { IeltsPrepAbilityPanel } from '@/components/spaces/panels/ielts-prep-ability-panel';

const SPACE = 'space-1069';
const messages = mergeMessages(en, zh) as AbstractIntlMessages;

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  hookCalls.length = 0;
  useAuthStore.setState({ isLoggedIn: true });
  useSpaceStore.getState().setSpaceMessages(SPACE, []);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(state: EnglishAbilityState) {
  nextState = state;
  act(() => {
    root.render(
      <NextIntlClientProvider locale="zh" messages={messages} timeZone="UTC">
        <IeltsPrepAbilityPanel spaceId={SPACE} />
      </NextIntlClientProvider>
    );
  });
  return container.textContent ?? '';
}

const ready = (key: 'populated' | 'declining' | 'empty'): EnglishAbilityState => ({
  kind: 'ready',
  ability: fixture[key] as unknown as EnglishAbility,
});

describe('KAZI-1069 ability panel (real zh messages, real BE shape)', () => {
  it('shows overall, current scores, dimensions, trend and the averaged window', () => {
    const text = render(ready('populated'));
    expect(text).toContain('3.94'); // overall
    expect(text).toContain('3.89'); // writing current
    expect(text).toContain('4.00'); // speaking current, two decimals
    expect(text).toContain('上升');
    expect(text).toContain('前期均值 3.33 → 近期均值 3.89（+0.56）');
    expect(text).toContain('最近一次4.33'); // from points, not window.to
    expect(text).toContain('任务回应');
    expect(text).not.toMatch(/english\.(envelope|ability)\./); // no raw key paths
    expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(1); // writing only: speaking has 1 point
  });

  it('signs a falling window from the value', () => {
    const text = render(ready('declining'));
    expect(text).toContain('下降');
    expect(text).toContain('（−0.83）');
    expect(text).not.toContain('+-');
  });

  it('cold start shows the empty copy and no placement-test entry (AC-P3)', () => {
    const text = render(ready('empty'));
    expect(text).toContain('还没有分数');
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('gate off renders no ability block', () => {
    const text = render({ kind: 'unavailable' });
    expect(text).toContain('能力分暂未开放');
    expect(text).not.toContain('总分');
  });

  it('a new graded turn in this Space changes the refresh key', () => {
    render(ready('populated'));
    expect(hookCalls.at(-1)?.refreshKey).toBeNull();
    act(() => {
      useSpaceStore.getState().setSpaceMessages(SPACE, [
        { id: 'u1', role: 'user', content: 'essay' },
        { id: 'a1', role: 'assistant', content: 'review', assistantMeta: { event: 'writing_review' } },
      ]);
    });
    expect(hookCalls.at(-1)?.refreshKey).toBe('a1');
    act(() => {
      useSpaceStore.getState().setSpaceMessages(SPACE, [
        { id: 'a1', role: 'assistant', content: 'review', assistantMeta: { event: 'writing_review' } },
        { id: 'a2', role: 'assistant', content: 'prompt', assistantMeta: { event: 'writing_prompt' } },
      ]);
    });
    expect(hookCalls.at(-1)?.refreshKey).toBe('a1'); // a prompt is not a graded turn
  });

  it('does not fetch when logged out', () => {
    useAuthStore.setState({ isLoggedIn: false });
    render({ kind: 'loading' });
    expect(hookCalls.at(-1)?.enabled).toBe(false);
  });
});
