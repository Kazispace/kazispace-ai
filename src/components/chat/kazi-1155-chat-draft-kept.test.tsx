/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { ChatInput } from '@/components/chat/chat-input';
import { useAuthStore, useUIStore } from '@/lib/store';

/**
 * KAZI-1155 staging write-back (Jira 14118), step 3.3: the "draft replaced"
 * notice never showed, because the main chat's draft lived only in the
 * input's own state and was gone as soon as the user left the chat for
 * Studio. Owen chose to keep the main chat's draft (option picked in a
 * question). These cases pin that: the draft survives the input unmounting,
 * a Get started tap then replaces it with the notice, and a specialist's
 * input (no `keepDraft`) neither restores nor writes it.
 */
describe('KAZI-1155 main chat keeps its unsent draft', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    useUIStore.setState({ composerDrafts: {}, composerInsert: null, toast: null });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function mount(keepDraft: boolean) {
    act(() => {
      root.render(
        <ChatInput onSend={() => undefined} composerTarget="clinic" keepDraft={keepDraft} />
      );
    });
  }

  function unmount() {
    act(() => root.unmount());
    root = createRoot(host);
  }

  function textarea(): HTMLTextAreaElement {
    const el = host.querySelector('textarea');
    if (!el) throw new Error('no textarea');
    return el;
  }

  function type(text: string) {
    const el = textarea();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('restores the draft after the input unmounts and mounts again', () => {
    mount(true);
    type('my unsent question');
    unmount();
    expect(useUIStore.getState().composerDrafts.clinic).toBe('my unsent question');
    mount(true);
    expect(textarea().value).toBe('my unsent question');
  });

  it('a Get started tap replaces the kept draft and shows the notice', () => {
    useUIStore.getState().setComposerDraft('clinic', 'DRAFT-KAZI1155-KEEP');
    act(() => {
      useUIStore
        .getState()
        .requestComposerInsert('I want to practise for IELTS', 'clinic', 'replace', 'Your draft was replaced');
    });
    // The chat opens after the tap: the input mounts with the draft, then consumes the insert.
    mount(true);
    expect(textarea().value).toBe('I want to practise for IELTS');
    expect(useUIStore.getState().toast).toEqual({ message: 'Your draft was replaced', type: 'info' });
    expect(useUIStore.getState().composerDrafts.clinic).toBe('I want to practise for IELTS');
  });

  it('no notice when there was no draft, or it was the same text', () => {
    mount(true);
    act(() => {
      useUIStore.getState().requestComposerInsert('Quick search', 'clinic', 'replace', 'replaced');
    });
    expect(textarea().value).toBe('Quick search');
    expect(useUIStore.getState().toast).toBeNull();
    act(() => {
      useUIStore.getState().requestComposerInsert('Quick search', 'clinic', 'replace', 'replaced');
    });
    expect(useUIStore.getState().toast).toBeNull();
  });

  it('a specialist input (no keepDraft) neither restores nor writes the draft', () => {
    useUIStore.getState().setComposerDraft('clinic', 'main chat draft');
    mount(false);
    expect(textarea().value).toBe('');
    type('to the specialist');
    unmount();
    expect(useUIStore.getState().composerDrafts.clinic).toBe('main chat draft');
  });

  it('sending clears the kept draft', () => {
    mount(true);
    type('send me');
    act(() => {
      host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(useUIStore.getState().composerDrafts.clinic).toBe('');
  });

  it('signing out clears kept drafts', () => {
    useUIStore.getState().setComposerDraft('clinic', 'private text');
    act(() => useAuthStore.getState().logout());
    expect(useUIStore.getState().composerDrafts).toEqual({});
  });
});
