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
import { resolveActionSelectSubmit } from '@/lib/next-action-submit';
import { useSpaceStore } from '@/lib/store';
import { usePendingSpaceAction } from '@/hooks/use-pending-space-action';
import type { EnglishAbilityState } from '@/hooks/use-english-ability';
import type { EnglishAbility } from '@/types/english-ability';
import type { ChatNextAction } from '@/types/chat-envelope';

// Backend `compute_ability` + `weak_tags_of` output (KAZI-1083 branch) — regenerate, do not hand-edit.
import fixture from '@/lib/english-tutor/__fixtures__/kazi1083_ability_response.json';

let nextState: EnglishAbilityState = { kind: 'loading' };

vi.mock('@/hooks/use-english-ability', () => ({
  useEnglishAbility: () => ({ state: nextState, refetch: vi.fn() }),
}));

import { EnglishAbilitySection } from '@/components/spaces/panels/english-ability-section';

const SPACE = 'space-1083';
const zhMessages = mergeMessages(en, zh) as AbstractIntlMessages;
const enMessages = en as unknown as AbstractIntlMessages;

type Key = 'weak' | 'weakEmpty' | 'weakNull' | 'coldStartWeak';
const ability = (key: Key) => fixture[key] as unknown as EnglishAbility;
const WEAK = ability('weak').weak_tags!;

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  useSpaceStore.getState().reset();
  useSpaceStore.getState().setSpaceMessages(SPACE, []);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(key: Key, locale: 'zh' | 'en' = 'zh') {
  nextState = { kind: 'ready', ability: ability(key) };
  act(() => {
    root.render(
      <NextIntlClientProvider
        locale={locale}
        messages={locale === 'zh' ? zhMessages : enMessages}
        timeZone="UTC"
      >
        <EnglishAbilitySection spaceId={SPACE} />
      </NextIntlClientProvider>
    );
  });
  return container.textContent ?? '';
}

function practiceButtons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter((b) =>
    (b.getAttribute('aria-label') ?? '').startsWith(zh.english.ability.weak.practice)
  );
}

describe('KAZI-1083 weakest three (real BE shape, real zh.json / en.json)', () => {
  it('fixture is the BE ranking: three tags, lowest mastery first', () => {
    expect(WEAK.map((w) => w.tag)).toEqual([
      'grammar.article',
      'writing.coherence',
      'vocabulary.collocation',
    ]);
  });

  it('renders the three in the BE order — the first row is the chat suggestion', () => {
    const text = render('weak');
    expect(text).toContain(zh.english.ability.weak.title);
    const names = Array.from(container.querySelectorAll('li p.font-medium')).map((p) => p.textContent);
    // No FE re-sort: weak_tags[0] is what the graded turn suggests (BE ranks both with one function).
    expect(names).toEqual(WEAK.map((w) => w.label.zh));
    expect(text).toContain('掌握度 22%');
    expect(text).toContain('语法 · 8 次练习');
    expect(text).toContain('写作 · 4 次练习');
    expect(practiceButtons()).toHaveLength(3);
    const meters = Array.from(container.querySelectorAll('[role="meter"]'));
    expect(meters.map((m) => m.getAttribute('aria-valuenow'))).toEqual(['22', '38', '41']);
  });

  it('English copy, BE English tag names, plural evidence', () => {
    const text = render('weak', 'en');
    expect(text).toContain(en.english.ability.weak.title);
    expect(text).toContain('articles');
    expect(text).toContain('Grammar · 8 attempts');
    expect(text).toContain('Mastery 22%');
    expect(text).toContain(en.english.ability.weak.practice);
  });

  it('[] ⇒ one hint line; null ⇒ no block at all', () => {
    expect(render('weakEmpty')).toContain(zh.english.ability.weak.empty);
    const text = render('weakNull');
    expect(text).not.toContain(zh.english.ability.weak.title);
    expect(text).not.toContain(zh.english.ability.weak.empty);
  });

  it('a learner with no score yet still sees the weak tags (mastery is not a score)', () => {
    const text = render('coldStartWeak');
    expect(text).toContain(zh.english.ability.empty);
    expect(text).toContain(zh.english.ability.weak.title);
    expect(practiceButtons()).toHaveLength(3);
  });

  it('「练这个」 hands the BE action, unchanged, to this space’s chat', () => {
    render('weak');
    act(() => practiceButtons()[0].click());
    const pending = useSpaceStore.getState().pendingSpaceAction;
    expect(pending?.spaceId).toBe(SPACE);
    expect(pending?.action).toEqual(WEAK[0].action);
  });

  it('is disabled while a turn is in flight', () => {
    useSpaceStore.getState().setSpaceSending(SPACE, true);
    render('weak');
    expect(practiceButtons().every((b) => b.disabled)).toBe(true);
  });
});

describe('KAZI-1083 the click is the graded-turn button (ET SSOT v1.98 ①)', () => {
  it('sends label as the bubble, the entry phrase as payload, and the focus tag', () => {
    const submit = resolveActionSelectSubmit(WEAK[0].action as ChatNextAction, 'zh');
    expect(submit).toEqual({
      display: '练语法 · 冠词误用 / 缺失',
      meta: {
        action_type: 'et_next_practice',
        action_payload: '练语法',
        focus_tag: 'grammar.article',
      },
    });
  });

  function Consumer({ spaceId, isSending, handle }: {
    spaceId: string;
    isSending: boolean;
    handle: (a: ChatNextAction) => void;
  }) {
    usePendingSpaceAction(spaceId, isSending, handle);
    return null;
  }

  it('the chat consumes it once, for its own space only', () => {
    const handle = vi.fn();
    const other = vi.fn();
    act(() => {
      root.render(
        <>
          <Consumer spaceId={SPACE} isSending={false} handle={handle} />
          <Consumer spaceId="another-space" isSending={false} handle={other} />
        </>
      );
    });
    act(() => useSpaceStore.getState().requestSpaceAction(SPACE, WEAK[1].action as ChatNextAction));
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(WEAK[1].action);
    expect(other).not.toHaveBeenCalled();
    expect(useSpaceStore.getState().pendingSpaceAction).toBeNull();
  });

  it('a click while sending is dropped, not queued', () => {
    const handle = vi.fn();
    act(() => {
      root.render(<Consumer spaceId={SPACE} isSending={true} handle={handle} />);
    });
    act(() => useSpaceStore.getState().requestSpaceAction(SPACE, WEAK[0].action as ChatNextAction));
    expect(handle).not.toHaveBeenCalled();
    expect(useSpaceStore.getState().pendingSpaceAction).toBeNull();
  });
});
