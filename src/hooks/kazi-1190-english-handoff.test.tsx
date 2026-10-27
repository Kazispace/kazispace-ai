/**
 * @vitest-environment jsdom
 *
 * KAZI-1190 (Owen 2026-10-27: 自动发出) — the clinic message that hands off to the English tutor
 * is sent once as the first turn in the English Space; never twice, never into another Space.
 */
import { act } from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEnglishHandoffSend } from '@/hooks/use-english-handoff-send';
import {
  ENGLISH_HANDOFF_TTL_MS,
  consumeEnglishHandoff,
  primeEnglishHandoff,
} from '@/lib/spaces/english-handoff';

const T0 = 1_800_000_000_000;

beforeEach(() => sessionStorage.clear());

describe('english handoff store', () => {
  it('gives the message back once, then forgets it', () => {
    primeEnglishHandoff('  我想练习雅思口语 ', T0);
    expect(consumeEnglishHandoff(T0 + 1000)).toBe('我想练习雅思口语');
    expect(consumeEnglishHandoff(T0 + 2000)).toBeNull();
  });

  it('drops an expired one', () => {
    primeEnglishHandoff('我想练习雅思口语', T0);
    expect(consumeEnglishHandoff(T0 + ENGLISH_HANDOFF_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('stores nothing for blank text and survives junk', () => {
    primeEnglishHandoff('   ', T0);
    expect(sessionStorage.length).toBe(0);
    sessionStorage.setItem('kazi.englishSpace.handoff', '{not json');
    expect(consumeEnglishHandoff(T0)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

type Props = Parameters<typeof useEnglishHandoffSend>[0];
function Probe(props: Props) {
  useEnglishHandoffSend(props);
  return null;
}

describe('useEnglishHandoffSend', () => {
  let container: HTMLDivElement;
  let root: Root;
  const send = vi.fn();
  const base: Props = {
    templateId: 'ielts_prep',
    active: true,
    ready: true,
    isSending: false,
    send,
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    send.mockReset();
  });
  afterEach(() => act(() => root.unmount()));

  const render = (p: Partial<Props> = {}) => act(() => root.render(<Probe {...base} {...p} />));

  it('sends the handed-over message once when the English Space chat is ready', () => {
    primeEnglishHandoff('我想练习雅思口语');
    render();
    render(); // a re-render must not send again
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('我想练习雅思口语');
  });

  it('waits until ready and not sending', () => {
    primeEnglishHandoff('我想练习雅思口语');
    render({ ready: false });
    render({ ready: true, isSending: true });
    expect(send).not.toHaveBeenCalled();
    render({ ready: true, isSending: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('a reload (fresh mount) does not send it again', () => {
    primeEnglishHandoff('我想练习雅思口语');
    render();
    act(() => root.unmount());
    root = createRoot(container);
    render();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('another template neither sends nor eats it', () => {
    primeEnglishHandoff('我想练习雅思口语');
    render({ templateId: 'blank_conversation' });
    expect(send).not.toHaveBeenCalled();
    expect(consumeEnglishHandoff()).toBe('我想练习雅思口语');
  });

  it('a kept-alive English Space picks up a second hand-off on re-activation', () => {
    primeEnglishHandoff('第一次');
    render();
    render({ active: false }); // user goes back to the clinic; the Space stays mounted
    primeEnglishHandoff('第二次');
    render({ active: true });
    expect(send.mock.calls.map((c) => c[0])).toEqual(['第一次', '第二次']);
  });

  it('nothing handed over ⇒ nothing sent', () => {
    render();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('wiring', () => {
  const src = (p: string) => readFileSync(path.resolve(__dirname, '..', p), 'utf8');

  it('the clinic primes the hand-off with the sent text right before routing to English', () => {
    const shell = src('components/clinic/clinic-shell.tsx');
    expect(shell).toMatch(/primeEnglishHandoff\(text\);\s*routeEnglishPage\(\);/);
  });

  it('the Space chat pane runs the hand-off hook', () => {
    expect(src('components/spaces/space-chat-pane.tsx')).toMatch(/useEnglishHandoffSend\(/);
  });
});
