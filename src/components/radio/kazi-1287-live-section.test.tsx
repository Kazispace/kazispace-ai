/**
 * @vitest-environment jsdom
 *
 * KAZI-1287 F1 — the radio home's Live section (kazispace-ui live-room.md 0.3, Who sees it · Radio
 * home: the Live section · The disclaimer · Starting a session).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  home: vi.fn(),
  ack: vi.fn(),
  start: vi.fn(),
  end: vi.fn(),
  unlock: vi.fn(),
  setStarted: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn(),
  closed: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${ns}.${key}:${JSON.stringify(vars)}` : `${ns}.${key}`,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: m.replace, push: m.push }) }));
vi.mock('@/lib/store', () => ({
  useUIStore: (select: (s: { showToast: typeof m.toast }) => unknown) => select({ showToast: m.toast }),
}));
vi.mock('@/lib/radio/live-api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/live-api')>()),
  getLiveHome: m.home,
  ackLiveDisclaimer: m.ack,
  startLiveSession: m.start,
  sendLiveEnd: m.end,
}));
vi.mock('@/lib/radio/live-session', () => ({ unlockLiveAudio: m.unlock, setStartedLiveSession: m.setStarted }));

import { LiveSection, topicsForHost } from '@/components/radio/live-section';

const HOSTS = [
  { key: 'warm', name: 'Warm host', voice_id: 'zh_f1' },
  { key: 'clear', name: 'Clear host', voice_id: 'zh_m1' },
];
const TOPICS = [
  { id: 't1', title_zh: '今天的饭', question_en: 'What did you eat today?', hosts: ['warm'] },
  { id: 't2', title_zh: '今天的路', question_en: 'How did you get home?', hosts: ['warm', 'clear'] },
  { id: 't3', title_zh: '今天的人', question_en: 'Who did you talk to?', hosts: ['clear'] },
];
const LIMITS = { record_max_ms: 72000, chunk_max_ms: 20000, chunks_max: 4 };
const HOME = {
  hosts: HOSTS,
  topics: TOPICS,
  sessions_left_today: 2,
  availability: { asr: true, tts: true, llm: true },
  disclaimer_acked: true,
  open_session_id: null as string | null,
  limits: LIMITS,
};
const SESSION = { session_id: 'ls1', host: 'warm', topic_id: 't1', status: 'open', opening: [], acks: [], limits: LIMITS };
const ok = <T,>(data: T) => ({ success: true, status: 200, data });
const fail = (status: number, errorCode?: string) => ({ success: false, status, errorCode, error: errorCode ?? 'x' });

let container: HTMLDivElement;
let root: Root;
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (id: string) => Array.from(container.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const click = async (el: Element | null) => {
  expect(el).not.toBeNull();
  await act(async () => (el as HTMLElement).click());
  await settle();
};

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <LiveSection locale="zh" onRadioClosed={m.closed} />
      </QueryClientProvider>
    );
  });
  await settle();
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.values(m).forEach((f) => f.mockReset());
  m.home.mockResolvedValue(ok(HOME));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Who sees it', () => {
  it.each([
    ['switched off (404)', fail(404)],
    ['not in the radio audience (403)', fail(403, 'radio_not_in_audience')],
    ['not Pro (403)', fail(403, 'radio_pro_required')],
    ['no speech recognition here', ok({ ...HOME, availability: { asr: false, tts: true, llm: true } })],
    ['no voice here', ok({ ...HOME, availability: { asr: true, tts: false, llm: true } })],
    ["no host's model here", ok({ ...HOME, availability: { asr: true, tts: true, llm: false } })],
  ])('%s: no Live section, nothing says it exists', async (_, res) => {
    m.home.mockResolvedValue(res);
    await mount();
    expect(q('radio-home-live')).toBeNull();
  });

  it('cannot be read: an inline error with retry; the retry reads it again', async () => {
    m.home.mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok(HOME));
    await mount();
    expect(q('radio-live-error')?.textContent).toContain('states.retry');
    expect(q('radio-live-start')).toBeNull();
    await click(q('radio-live-error')!.querySelector('button'));
    expect(m.home).toHaveBeenCalledTimes(2);
    expect(q('radio-live-start')).not.toBeNull();
  });

  it('loading: a skeleton, never a Start button drawn first', async () => {
    m.home.mockReturnValue(new Promise(() => undefined));
    await mount();
    expect(q('radio-live-loading')).not.toBeNull();
    expect(q('radio-live-start')).toBeNull();
  });
});

describe('the Live section', () => {
  it('title, line and sessions left', async () => {
    await mount();
    const s = q('radio-home-live')!.textContent!;
    expect(s).toContain('radio.live.section');
    expect(s).toContain('radio.live.subtitle');
    expect(q('radio-live-left')?.textContent).toBe('radio.live.left:{"n":2}');
  });

  it("one host is always selected (the first); the topics are that host's, in the server's order", async () => {
    await mount();
    const hosts = qa('radio-live-host');
    expect(hosts.map((h) => h.textContent)).toEqual(['Warm host', 'Clear host']);
    expect(hosts.map((h) => h.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(qa('radio-live-topic').map((t) => t.textContent)).toEqual([
      '今天的饭radio.live.question: What did you eat today?',
      '今天的路radio.live.question: How did you get home?',
    ]);
    expect(qa('radio-live-topic').map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('changing host shows its topics and selects the first of them', async () => {
    await mount();
    await click(qa('radio-live-topic')[1]);
    await click(qa('radio-live-host')[1]);
    const topics = qa('radio-live-topic');
    expect(topics.map((t) => t.textContent?.slice(0, 4))).toEqual(['今天的路', '今天的人']);
    expect(topics.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('topicsForHost keeps the server order and only the topics the host can open', () => {
    expect(topicsForHost(TOPICS, 'clear').map((t) => t.id)).toEqual(['t2', 't3']);
    expect(topicsForHost(TOPICS, null)).toEqual([]);
  });

  it('no topic for any host: radio.live.empty, no host chips and no Start', async () => {
    m.home.mockResolvedValue(ok({ ...HOME, topics: [] }));
    await mount();
    expect(q('radio-live-empty')?.textContent).toBe('radio.live.empty');
    expect(qa('radio-live-host')).toHaveLength(0);
    expect(q('radio-live-start')).toBeNull();
  });

  it('0 sessions left: radio.live.noneLeft and Start disabled', async () => {
    m.home.mockResolvedValue(ok({ ...HOME, sessions_left_today: 0 }));
    await mount();
    expect(q('radio-live-left')?.textContent).toBe('radio.live.noneLeft');
    expect((q('radio-live-start') as HTMLButtonElement).disabled).toBe(true);
  });

  it('an unfinished session is ended once, not resumed, and nothing is shown for it', async () => {
    m.home.mockResolvedValue(ok({ ...HOME, open_session_id: 'old1' }));
    await mount();
    expect(m.end).toHaveBeenCalledTimes(1);
    expect(m.end).toHaveBeenCalledWith('old1');
    expect(q('radio-home-live')!.textContent).not.toContain('old1');
  });
});

describe('Starting a session', () => {
  it('Start unlocks audio in the tap, then 200 opens the Live screen with the session and host', async () => {
    m.start.mockResolvedValue(ok(SESSION));
    await mount();
    await click(q('radio-live-start'));
    expect(m.unlock).toHaveBeenCalledTimes(1);
    const body = m.start.mock.calls[0][0];
    expect(body).toMatchObject({ host: 'warm', topic_id: 't1' });
    expect(body.request_id).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(m.setStarted).toHaveBeenCalledWith({ session: SESSION, host: HOSTS[0] });
    expect(m.push).toHaveBeenCalledWith('/zh/radio/live');
  });

  it('a network error keeps the request: the next Start resends the same request_id', async () => {
    m.start.mockResolvedValueOnce(fail(0, 'NETWORK_ERROR')).mockResolvedValueOnce(ok(SESSION));
    await mount();
    await click(q('radio-live-start'));
    expect(m.toast).toHaveBeenCalledWith('states.retry', 'error');
    await click(q('radio-live-start'));
    expect(m.start.mock.calls[1][0].request_id).toBe(m.start.mock.calls[0][0].request_id);
    expect(m.push).toHaveBeenCalledTimes(1);
  });

  it('a new choice is a new request', async () => {
    m.start.mockResolvedValueOnce(fail(0, 'NETWORK_ERROR')).mockResolvedValueOnce(ok(SESSION));
    await mount();
    await click(q('radio-live-start'));
    await click(qa('radio-live-topic')[1]);
    await click(q('radio-live-start'));
    expect(m.start.mock.calls[1][0].request_id).not.toBe(m.start.mock.calls[0][0].request_id);
  });

  it('409 live_daily_limit: a toast with noneLeft, and the section reloads', async () => {
    m.start.mockResolvedValue(fail(409, 'live_daily_limit'));
    await mount();
    await click(q('radio-live-start'));
    expect(m.toast).toHaveBeenCalledWith('radio.live.noneLeft');
    expect(m.home).toHaveBeenCalledTimes(2);
  });

  it('409 request_reused: the section reloads and nothing else is shown', async () => {
    m.start.mockResolvedValue(fail(409, 'request_reused'));
    await mount();
    await click(q('radio-live-start'));
    expect(m.toast).not.toHaveBeenCalled();
    expect(m.home).toHaveBeenCalledTimes(2);
  });

  it('503 live_unavailable: a toast, and the section reloads (it may now be hidden)', async () => {
    m.start.mockResolvedValue(fail(503, 'live_unavailable'));
    m.home.mockResolvedValueOnce(ok(HOME)).mockResolvedValueOnce(fail(404));
    await mount();
    await click(q('radio-live-start'));
    expect(m.toast).toHaveBeenCalledWith('radio.live.unavailable');
    expect(q('radio-home-live')).toBeNull();
  });

  it('403 live_refused: a toast, the Live section hidden for the visit, the user stays on the radio home', async () => {
    m.start.mockResolvedValue(fail(403, 'live_refused'));
    await mount();
    await click(q('radio-live-start'));
    expect(m.toast).toHaveBeenCalledWith('radio.live.unavailable');
    expect(q('radio-home-live')).toBeNull();
    expect(m.closed).not.toHaveBeenCalled();
    expect(m.replace).not.toHaveBeenCalled();
  });

  it.each(['radio_not_in_audience', 'radio_pro_required'])('403 %s: the radio rules (go to Studio)', async (code) => {
    m.start.mockResolvedValue(fail(403, code));
    await mount();
    await click(q('radio-live-start'));
    expect(m.closed).toHaveBeenCalledTimes(1);
  });

  it('404: Live Room was switched off; the section reloads and disappears', async () => {
    m.start.mockResolvedValue(fail(404));
    m.home.mockResolvedValueOnce(ok(HOME)).mockResolvedValueOnce(fail(404));
    await mount();
    await click(q('radio-live-start'));
    expect(q('radio-home-live')).toBeNull();
    expect(m.closed).not.toHaveBeenCalled();
  });

  it('422 invalid_request (a bug): a toast, nothing else changes', async () => {
    m.start.mockResolvedValue(fail(422, 'invalid_request'));
    await mount();
    await click(q('radio-live-start'));
    expect(m.toast).toHaveBeenCalledWith('radio.live.unavailable');
    expect(m.home).toHaveBeenCalledTimes(1);
    expect(q('radio-live-start')).not.toBeNull();
  });
});

describe('The disclaimer', () => {
  beforeEach(() => m.home.mockResolvedValue(ok({ ...HOME, disclaimer_acked: false })));

  it('the first Start opens the sheet instead of starting; the whole text, help above the buttons', async () => {
    await mount();
    await click(q('radio-live-start'));
    expect(m.start).not.toHaveBeenCalled();
    const sheet = q('radio-live-disclaimer')!;
    for (const k of ['title', 'what', 'not', 'help', 'agree', 'later']) expect(sheet.textContent).toContain(`radio.live.disclaimer.${k}`);
    const help = q('radio-live-disclaimer-help')!;
    expect(help.compareDocumentPosition(q('radio-live-disclaimer-agree')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.activeElement).toBe(sheet);
  });

  it('Not now: nothing is sent; the sheet opens again at the next Start', async () => {
    await mount();
    await click(q('radio-live-start'));
    await click(q('radio-live-disclaimer-later'));
    expect(q('radio-live-disclaimer')).toBeNull();
    expect(m.ack).not.toHaveBeenCalled();
    await click(q('radio-live-start'));
    expect(q('radio-live-disclaimer')).not.toBeNull();
    expect(m.start).not.toHaveBeenCalled();
  });

  it('Agree: POST disclaimer, then the session starts with the host and topic selected', async () => {
    m.ack.mockResolvedValue({ success: true, status: 204 });
    m.start.mockResolvedValue(ok(SESSION));
    await mount();
    await click(qa('radio-live-topic')[1]);
    await click(q('radio-live-start'));
    await click(q('radio-live-disclaimer-agree'));
    expect(m.ack).toHaveBeenCalledTimes(1);
    expect(m.start.mock.calls[0][0]).toMatchObject({ host: 'warm', topic_id: 't2' });
    expect(m.push).toHaveBeenCalledWith('/zh/radio/live');
    expect(q('radio-live-disclaimer')).toBeNull();
  });

  it('the acknowledgement fails: the sheet stays with an inline error and retry; nothing starts', async () => {
    m.ack.mockResolvedValueOnce(fail(503)).mockResolvedValueOnce({ success: true, status: 204 });
    m.start.mockResolvedValue(ok(SESSION));
    await mount();
    await click(q('radio-live-start'));
    await click(q('radio-live-disclaimer-agree'));
    expect(q('radio-live-disclaimer-error')?.textContent).toContain('states.retry');
    expect(m.start).not.toHaveBeenCalled();
    await click(q('radio-live-disclaimer-error')!.querySelector('button'));
    expect(m.start).toHaveBeenCalledTimes(1);
  });

  it('409 disclaimer_required: the sheet; after Agree the same request is sent again', async () => {
    m.home.mockResolvedValue(ok(HOME));
    m.start.mockResolvedValueOnce(fail(409, 'disclaimer_required')).mockResolvedValueOnce(ok(SESSION));
    m.ack.mockResolvedValue({ success: true, status: 204 });
    await mount();
    await click(q('radio-live-start'));
    expect(q('radio-live-disclaimer')).not.toBeNull();
    await click(q('radio-live-disclaimer-agree'));
    expect(m.start).toHaveBeenCalledTimes(2);
    expect(m.start.mock.calls[1][0].request_id).toBe(m.start.mock.calls[0][0].request_id);
  });
});
