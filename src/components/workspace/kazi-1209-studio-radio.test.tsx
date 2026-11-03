/**
 * @vitest-environment jsdom
 *
 * KAZI-1209 / KAZIOP-2 — Studio「个人电台」(kazispace-ui D28, studio.md Sections, personal-radio.md Who
 * sees it). Before: the section was hard-coded to `studio.comingSoon` for everyone.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ home: vi.fn() }));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${ns}.${key}:${JSON.stringify(vars)}` : `${ns}.${key}`,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/radio/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/radio/api')>()),
  getRadioHome: api.home,
}));

import { StudioRadio } from '@/components/workspace/studio-radio';

const HOME = {
  continue_listening: [],
  stories: [{ story_id: 's1', slug: 'hotel', title: 'The Hotel Note', recommended: true }],
  programs: [],
  profile: { band: 'B1', en_ratio: 0.4, voice_id: 'en_gb_f1', source: 'none' },
  prefs: {},
  availability: { tts: true, asr: true, new_render: true },
  voices: ['en_us_f1', 'en_us_m1', 'en_gb_f1'],
};

let container: HTMLDivElement;
let root: Root;

async function render(locale: string, authenticated = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <StudioRadio locale={locale} authenticated={authenticated} />
      </QueryClientProvider>
    );
  });
  // let the query settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  api.home.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Studio · Personal radio', () => {
  it('a non-Chinese interface sees Coming soon and the server is not asked', async () => {
    await render('en');
    expect(q('studio-radio')?.textContent).toBe('studio.comingSoon');
    expect(api.home).not.toHaveBeenCalled();
  });

  it('signed out: Coming soon, no request', async () => {
    await render('zh', false);
    expect(q('studio-radio')?.textContent).toBe('studio.comingSoon');
    expect(api.home).not.toHaveBeenCalled();
  });

  it('Chinese, open, no story in progress: the entry to the radio home (KAZIOP-2)', async () => {
    api.home.mockResolvedValue({ success: true, data: HOME });
    await render('zh');
    expect(api.home).toHaveBeenCalledTimes(1);
    expect(q('studio-radio')?.textContent).toContain('radio.studio.title');
    expect(q('studio-radio-open')?.getAttribute('href')).toBe('/zh/radio');
    expect(q('studio-radio')?.textContent).not.toContain('studio.comingSoon');
  });

  it('Chinese, a story in progress: the continue card goes straight to the player, back to Studio', async () => {
    api.home.mockResolvedValue({
      success: true,
      data: {
        ...HOME,
        continue_listening: [
          { save_id: 'sv1', title: 'The Hotel Note', status: 'active', current_node_id: 'n2', save_version: 3, updated_at: '2026-11-03T12:00:00Z' },
        ],
      },
    });
    await render('zh');
    expect(q('studio-radio-current')?.textContent).toBe('The Hotel Note');
    expect(q('studio-radio-continue')?.getAttribute('href')).toBe('/zh/radio/story/sv1?from=studio');
    expect(q('studio-radio-open')?.getAttribute('href')).toBe('/zh/radio');
  });

  it.each([
    ['off', { success: false, status: 404, errorCode: 'REGION_ACCOUNT_NOT_FOUND' }],
    ['not Pro', { success: false, status: 403, errorCode: 'radio_pro_required' }],
    ['not in audience', { success: false, status: 403, errorCode: 'radio_not_in_audience' }],
  ])('radio %s: Coming soon, nothing to tap', async (_name, res) => {
    api.home.mockResolvedValue(res);
    await render('zh');
    expect(q('studio-radio')?.textContent).toBe('studio.comingSoon');
    expect(container.querySelector('a')).toBeNull();
  });

  it('status cannot be read (network / 5xx): the no-story form, never Coming soon', async () => {
    api.home.mockResolvedValue({ success: false, errorCode: 'NETWORK_ERROR' });
    await render('zh');
    expect(q('studio-radio-open')?.getAttribute('href')).toBe('/zh/radio');
  });

  it('loading: a skeleton, no entry drawn first', async () => {
    api.home.mockReturnValue(new Promise(() => {}));
    await render('zh');
    expect(q('studio-radio-loading')).not.toBeNull();
    expect(q('studio-radio-open')).toBeNull();
  });
});
