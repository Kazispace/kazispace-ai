/**
 * @vitest-environment jsdom
 *
 * One bar above the conversation (kazispace-ui D24): specialist pages put their
 * line and action into the context header through this slot.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useChatHeaderSlot, useChatHeaderSlotStore, type ChatHeaderSlot } from './chat-header-slot';

function Page({ owner, slot }: { owner: string; slot: ChatHeaderSlot }) {
  useChatHeaderSlot(owner, slot);
  return null;
}

describe('chat header slot', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    useChatHeaderSlotStore.setState({ owner: null, subtitle: null, action: null });
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('holds the page subtitle and action while the page is mounted', () => {
    const onClick = () => {};
    act(() => root.render(<Page owner="interview" slot={{ subtitle: 'Analyst', action: { label: 'New', onClick } }} />));
    const state = useChatHeaderSlotStore.getState();
    expect(state.subtitle).toBe('Analyst');
    expect(state.action?.label).toBe('New');
    expect(state.action?.onClick).toBe(onClick);
  });

  it('follows changes and clears on unmount', () => {
    act(() => root.render(<Page owner="interview" slot={{ subtitle: 'Q 1', action: null }} />));
    act(() => root.render(<Page owner="interview" slot={{ subtitle: 'Q 2', action: null }} />));
    expect(useChatHeaderSlotStore.getState().subtitle).toBe('Q 2');
    act(() => root.render(<></>));
    expect(useChatHeaderSlotStore.getState()).toMatchObject({ owner: null, subtitle: null, action: null });
  });

  it('a page leaving late does not wipe the next page', () => {
    useChatHeaderSlotStore.getState().set('english', { subtitle: 'Tutor', action: null });
    useChatHeaderSlotStore.getState().clear('interview');
    expect(useChatHeaderSlotStore.getState().subtitle).toBe('Tutor');
  });
});
