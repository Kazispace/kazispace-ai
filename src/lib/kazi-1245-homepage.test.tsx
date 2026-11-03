/**
 * @vitest-environment jsdom
 */
/**
 * KAZI-1245 (kazispace-ui Homepage 0.2, D30): a public homepage at the locale root for
 * everyone, on every host, and no guest chat. It is live before the company facts are in
 * (Owen, 2026-11-03); on production hosts a missing fact is left out, and only preview
 * hosts show placeholders.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `home.${key}`,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `home.${key}(${Object.values(values).join('|')})` : `home.${key}`,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en',
}));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element -- test stand-in for next/image
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}));

import middleware from '@/middleware';
import { Homepage } from '@/components/home/homepage';
import { HomeCtas } from '@/components/home/home-ctas';
import {
  SITE_FACTS,
  factFor,
  siteForRequest,
  type HomepageSite,
  type SiteFacts,
} from '@/lib/homepage-site';
import { useAuthStore } from '@/lib/store';

const PREVIEW = 'owen--kazispace.netlify.app';

function request(url: string, host: string, cookie?: string) {
  const headers: Record<string, string> = { host };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(url, { headers });
}

function location(res: Response): string | null {
  const loc = res.headers.get('location');
  return loc ? new URL(loc).pathname + new URL(loc).search : null;
}

const FULL: Record<HomepageSite, SiteFacts> = {
  intl: { ...SITE_FACTS.intl, companyName: 'Co', address: 'A', email: 'e@x', termsUrl: '/t', privacyUrl: '/p', miniProgramQr: '/qr.png' },
  cn: {
    ...SITE_FACTS.cn,
    companyName: '公司',
    address: '地址',
    email: 'e@x',
    termsUrl: '/t',
    privacyUrl: '/p',
    icpNumber: 'ICP1',
    psbNumber: 'PSB1',
    psbUrl: 'https://psb',
    psbIcon: null,
    aiFilingNumber: 'AI1',
    miniProgramQr: '/qr.png',
  },
};

describe('KAZI-1245 which site, and is the homepage live', () => {
  it('production hosts map to their site; anything else is a preview', () => {
    expect(siteForRequest('kazispace.ai')).toEqual({ site: 'intl', production: true });
    expect(siteForRequest('www.kazispace.cn:443')).toEqual({ site: 'cn', production: true });
    expect(siteForRequest(PREVIEW)).toEqual({ site: 'intl', production: false });
    expect(siteForRequest(PREVIEW, 'cn')).toEqual({ site: 'cn', production: false });
    // ?site= is ignored on production hosts.
    expect(siteForRequest('kazispace.ai', 'cn').site).toBe('intl');
    expect(siteForRequest('deploy-preview-268--kazispace.netlify.app')).toEqual({ site: 'intl', production: false });
    expect(siteForRequest('localhost:3000', 'cn')).toEqual({ site: 'cn', production: false });
  });

  // Review of #268: placeholders fail closed. A host not positively a preview is production.
  it.each([
    ['origin-sae.internal.example', 'intl'],
    ['kazispace.netlify.app', 'intl'],
    ['cdn.kazispace.cn', 'cn'],
    ['slb.example.cn', 'cn'],
    ['', 'intl'],
  ])('unknown host %s is production (%s)', (host, site) => {
    expect(siteForRequest(host, 'cn')).toEqual({ site, production: true });
  });

  it('a missing fact: placeholder on a preview, nothing in production; a filled fact everywhere', () => {
    expect(factFor('cn', 'icpNumber', false)).toBe('[ICP备案号]');
    expect(factFor('cn', 'icpNumber', true)).toBeNull();
    expect(factFor('intl', 'companyName', true)).toBeNull();
    expect(factFor('cn', 'icpNumber', true, FULL)).toBe('ICP1');
    expect(factFor('intl', 'companyName', false, FULL)).toBe('Co');
  });
});

describe('KAZI-1245 middleware', () => {
  it.each([PREVIEW, 'kazispace.ai', 'www.kazispace.cn', 'origin-sae.internal.example'])(
    'no guest chat on %s: /chat signed out → sign-in, back to /chat after',
    (host) => {
      expect(location(middleware(request(`https://${host}/en/chat`, host)))).toBe('/en/login?redirect=%2Fen%2Fchat');
    }
  );

  it('the homepage itself is public', () => {
    for (const host of [PREVIEW, 'kazispace.ai', 'www.kazispace.cn']) {
      expect(location(middleware(request(`https://${host}/en`, host)))).toBeNull();
    }
  });

  it('the kazispace.cn homepage opens in Chinese unless the visitor chose a language', () => {
    expect(location(middleware(request('https://www.kazispace.cn/', 'www.kazispace.cn')))).toBe('/zh');
    expect(location(middleware(request(`https://${PREVIEW}/?site=cn`, PREVIEW)))).toBe('/zh?site=cn');
    const chosen = middleware(
      request('https://www.kazispace.cn/', 'www.kazispace.cn', 'kazi_locale_manual=1; kazi_preferred_locale=ru')
    );
    expect(location(chosen)).not.toBe('/zh');
  });
});

describe('KAZI-1245 the page', () => {
  beforeEach(() => {
    useAuthStore.setState({ authReady: true, isLoggedIn: false, user: null, token: null });
  });

  async function html(site: HomepageSite, production = false) {
    return renderToStaticMarkup(await Homepage({ locale: 'en', site, production }));
  }

  it('signed out: Sign up and Log in to the sign-in screen, no Open KaziSpace', async () => {
    const out = await html('intl');
    expect(out).toContain('home.signUp');
    expect(out).toContain('home.logIn');
    // Sign-in from the homepage lands in Space.
    expect(out).toMatch(/href="\/en\/login\?redirect=%2Fen%2F(spaces|chat)"/);
    expect(out).not.toContain('home.openApp');
  });

  it('signed in: Open KaziSpace to Space, and no Sign up / Log in (once the session is known)', () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useAuthStore.setState({ authReady: true, isLoggedIn: true });
    const host = document.createElement('div');
    const root = createRoot(host);
    for (const placement of ['bar', 'hero', 'closing'] as const) {
      act(() => root.render(<HomeCtas locale="en" placement={placement} />));
      // The signed-out pair stays laid out, hidden and out of the tab order, so the slot keeps its width.
      const visible = Array.from(host.querySelectorAll('a')).filter((a) => !a.closest('[aria-hidden="true"]'));
      expect(visible.map((a) => a.textContent)).toEqual(['home.openApp']);
      expect(visible[0].getAttribute('href')).toMatch(/^\/en\/(spaces|chat)$/);
      const hidden = Array.from(host.querySelectorAll('[aria-hidden="true"] a'));
      expect(hidden.length).toBeGreaterThan(0);
      expect(hidden.every((a) => a.getAttribute('tabindex') === '-1')).toBe(true);
    }
    act(() => root.unmount());
  });

  it('server render (session not known yet) draws the signed-out pair', async () => {
    useAuthStore.setState({ authReady: true, isLoggedIn: true });
    expect(await html('intl')).toContain('home.signUp');
  });

  it('until the session is known, the signed-out pair is drawn', async () => {
    useAuthStore.setState({ authReady: false, isLoggedIn: true });
    expect(await html('intl')).toContain('home.signUp');
  });

  it('one h1, the two features (English practice, Personal radio) and three steps, no chat on the page', async () => {
    const out = await html('intl');
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out.match(/home\.features\.[a-z]+\.title/g)).toEqual(['home.features.english.title', 'home.features.radio.title']);
    for (const id of ['ask', 'specialist', 'keep']) expect(out).toContain(`home.steps.${id}.title`);
    expect(out).not.toMatch(/<textarea|composer/i);
  });

  it('kazispace.ai: Telegram, no filing lines', async () => {
    const out = await html('intl');
    expect(out).toContain('home.platforms.telegram');
    expect(out).not.toContain('home.platforms.wechat');
    expect(out).not.toContain('data-testid="home-icp"');
  });

  it('kazispace.cn: WeChat, and the ICP line links to the filing site', async () => {
    const out = await html('cn');
    expect(out).toContain('home.platforms.wechat');
    expect(out).not.toContain('home.platforms.telegram');
    expect(out).toMatch(/href="https:\/\/beian\.miit\.gov\.cn\/"[^>]*data-testid="home-icp"/);
    expect(out).toContain('[ICP备案号]');
    expect(out).toContain('[生成式AI服务备案号]');
  });

  it('the top bar and the footer use the horizontal logo (D10), not the mark with typed text', async () => {
    const out = await html('intl');
    expect(out.match(/src="\/brand\/kazispace-logo-horizontal\.png"/g)).toHaveLength(2);
    expect(out).not.toContain('kazispace-mark.png');
    expect(out).toMatch(/<img alt="KaziSpace" src="\/brand\/kazispace-logo-horizontal\.png"/);
  });

  it('kazispace.cn shows its public security filing number, linked to its record', async () => {
    const out = await html('cn', true);
    expect(out).toMatch(
      /href="https:\/\/beian\.mps\.gov\.cn\/#\/query\/webSearch\?code=51019002010756"[^>]*data-testid="home-psb"[^>]*>川公网安备51019002010756号</
    );
    expect(await html('intl', true)).not.toContain('川公网安备');
  });

  it('production with facts still missing: no placeholder, no empty column, link or filing line', async () => {
    for (const site of ['intl', 'cn'] as const) {
      const out = await html(site, true);
      expect(out).not.toMatch(/\[[^\]]*(·|备案|公司|联系|QR)[^\]]*\]/);
      expect(out).not.toContain('home.footer.company');
      expect(out).not.toContain('home.footer.contact');
      expect(out).not.toContain('home.footer.legal');
      expect(out).not.toContain('data-testid="home-icp"');
      expect(out).not.toContain('data-testid="home-ai-filing"');
      expect(out).not.toContain('home.platforms.scan');
      expect(out).toContain('home.footer.copyright(2026|KaziSpace)'.replace('2026', String(new Date().getFullYear())));
      // The page itself is all there.
      expect(out).toContain('home.features.radio.title');
      expect(out).toContain('home.signUp');
    }
  });
});
