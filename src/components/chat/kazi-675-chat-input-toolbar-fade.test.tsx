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

function stubScrollMetrics(
  el: HTMLElement,
  metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number }
) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: metrics.scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: metrics.clientWidth });
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    value: metrics.scrollLeft,
    writable: true,
  });
}

/**
 * Found via manual mobile review: the composer's capability-chip row
 * (toolbar prop, card variant) scrolls horizontally when it doesn't fit --
 * on a narrow phone viewport the last chip sits right at the screen edge
 * with nothing hinting there's more to swipe to. Owen: fix it if it slides
 * off. Added a right-edge fade shown only while there's genuinely
 * unscrolled content, gone once scrolled to the end or when the row
 * already fits without scrolling.
 */
describe('KAZI-675 ChatInput toolbar scroll-affordance fade', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('shows the fade when the toolbar row overflows', async () => {
    await act(async () => {
      root.render(
        <ChatInput
          onSend={() => undefined}
          variant="card"
          toolbar={<div>Ask anything Improve CV Find jobs Interview prep</div>}
        />
      );
    });

    const scroller = host.querySelector<HTMLDivElement>('[data-testid="chat-input-toolbar-scroll"]')!;
    stubScrollMetrics(scroller, { scrollWidth: 340, clientWidth: 272, scrollLeft: 0 });

    await act(async () => {
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="chat-input-toolbar-fade"]')).not.toBeNull();
  });

  it('hides the fade once scrolled to the end', async () => {
    await act(async () => {
      root.render(
        <ChatInput
          onSend={() => undefined}
          variant="card"
          toolbar={<div>Ask anything Improve CV Find jobs Interview prep</div>}
        />
      );
    });

    const scroller = host.querySelector<HTMLDivElement>('[data-testid="chat-input-toolbar-scroll"]')!;
    stubScrollMetrics(scroller, { scrollWidth: 340, clientWidth: 272, scrollLeft: 68 });

    await act(async () => {
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="chat-input-toolbar-fade"]')).toBeNull();
  });

  it('never shows the fade when the row already fits', async () => {
    await act(async () => {
      root.render(
        <ChatInput onSend={() => undefined} variant="card" toolbar={<div>Ask anything</div>} />
      );
    });

    const scroller = host.querySelector<HTMLDivElement>('[data-testid="chat-input-toolbar-scroll"]')!;
    stubScrollMetrics(scroller, { scrollWidth: 100, clientWidth: 272, scrollLeft: 0 });

    await act(async () => {
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="chat-input-toolbar-fade"]')).toBeNull();
  });
});
