/**
 * @vitest-environment jsdom
 *
 * KAZI-1485 (Owen 2026-11-26, kazispace-ui D36, Exam 0.1.1): Exam is the English Space with a
 * Chat / Form switch on top. Chat is the conversation; Form is not built yet and says
 * `studio.comingSoon`. Chat first, then the mode used last. Switching ends nothing: Chat stays
 * mounted while Form shows. Studio's Get started text goes to the `exam` target, which only
 * the English Space's composer takes, and brings Exam back to Chat.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
const mounts = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/components/spaces/space-panels-workspace', async () => {
  const { useEffect } = await import('react');
  return {
    SpacePanelsWorkspace: () => {
      useEffect(() => {
        mounts.count += 1;
      }, []);
      return <div data-testid="space-chat">chat</div>;
    },
  };
});

import { ChatInput } from '@/components/chat/chat-input';
import { IeltsPrepWorkspace } from '@/components/spaces/ielts-prep-workspace';
import { EXAM_MODE_STORAGE_KEY } from '@/lib/exam-mode';
import { useUIStore } from '@/lib/store';
import type { SpaceDetail } from '@/types/spaces';

const SPACE = { id: 'sp_en', template_id: 'ielts_prep' } as SpaceDetail;

let root: Root;
let host: HTMLDivElement;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  localStorage.clear();
  mounts.count = 0;
  useUIStore.setState({ composerInsert: null, composerDrafts: {}, toast: null });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const render = () => act(() => root.render(<IeltsPrepWorkspace space={SPACE} />));

describe('Exam modes', () => {
  it('starts in Chat, a tab list of Chat then Form', () => {
    render();
    const tabs = Array.from(host.querySelectorAll('[role="tab"]'));
    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('exam.modes');
    expect(tabs.map((t) => t.textContent)).toEqual(['exam.mode.chat', 'exam.mode.form']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(q('space-chat')).not.toBeNull();
    expect(q('exam-form-panel')?.hidden).toBe(true);
  });

  it('Form says coming soon; Chat stays mounted while hidden, so nothing ends', () => {
    render();
    act(() => q('exam-mode-form')!.click());
    expect(q('exam-form-coming-soon')?.textContent).toBe('studio.comingSoon');
    expect(q('exam-form-panel')?.hidden).toBe(false);
    expect(q('space-chat')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);
    act(() => q('exam-mode-chat')!.click());
    expect(mounts.count).toBe(1);
  });

  it('remembers the mode used last', () => {
    render();
    act(() => q('exam-mode-form')!.click());
    expect(localStorage.getItem(EXAM_MODE_STORAGE_KEY)).toBe('form');
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(q('exam-mode-form')?.getAttribute('aria-selected')).toBe('true');
  });

  it('arrow keys move between the tabs', () => {
    render();
    act(() => {
      q('exam-mode-chat')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(q('exam-mode-form')?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(q('exam-mode-form'));
  });

  it('a Get started insert brings Exam back to Chat', () => {
    localStorage.setItem(EXAM_MODE_STORAGE_KEY, 'form');
    render();
    expect(q('exam-mode-form')?.getAttribute('aria-selected')).toBe('true');
    act(() => useUIStore.getState().requestComposerInsert('Practise IELTS speaking', 'exam', 'replace'));
    expect(q('exam-mode-chat')?.getAttribute('aria-selected')).toBe('true');
    expect(localStorage.getItem(EXAM_MODE_STORAGE_KEY)).toBe('chat');
  });
});

describe('the exam composer target', () => {
  const textarea = () => host.querySelector('textarea')!;

  it('the English Space composer takes an exam insert', () => {
    act(() =>
      root.render(<ChatInput onSend={() => undefined} composerTarget="space" alsoAcceptsTarget="exam" />)
    );
    act(() => useUIStore.getState().requestComposerInsert('Practise IELTS speaking', 'exam', 'replace'));
    expect(textarea().value).toBe('Practise IELTS speaking');
    expect(useUIStore.getState().composerInsert).toBeNull();
  });

  it('any other Space composer (a kept-alive CV Space) leaves it alone', () => {
    act(() => root.render(<ChatInput onSend={() => undefined} composerTarget="space" />));
    act(() => useUIStore.getState().requestComposerInsert('Practise IELTS speaking', 'exam', 'replace'));
    expect(textarea().value).toBe('');
    expect(useUIStore.getState().composerInsert?.target).toBe('exam');
  });
});
