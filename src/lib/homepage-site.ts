/**
 * KAZI-1245: which site the public homepage is serving, and its company facts
 * (kazispace-ui Homepage pattern 0.2, "Per site" and "Facts still to come"; D30).
 *
 * The homepage is live on every host (Owen, 2026-11-03: "Make the homepage live now.
 * Details will be filled later."). The facts below arrive later; fill each one in here.
 * Until it does, a production host leaves out what depends on it, and a preview host
 * (Netlify deploy previews and branch deploys, localhost) shows its placeholder so
 * reviewers can see what is missing; `?site=cn` there previews the kazispace.cn version.
 *
 * Placeholders fail closed: only a host that is positively a preview shows them. Any other
 * host (a CDN or load balancer forwarding its own name, the Netlify site's own address, a
 * future domain) is production for the site its domain names.
 */
export type HomepageSite = 'intl' | 'cn';

export interface SiteFacts {
  companyName: string | null;
  address: string | null;
  email: string | null;
  /** Optional: the footer leaves it out when it is null. */
  phone: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  /** kazispace.cn only: ICP filing number, linked to https://beian.miit.gov.cn/. */
  icpNumber: string | null;
  /** kazispace.cn only: public security filing number, and its record link. */
  psbNumber: string | null;
  psbUrl: string | null;
  /**
   * kazispace.cn only: generative AI service filing number. Required until legal says it
   * is not (Owen, 2026-11-03, an option he picked in review of kazispace-ui #54).
   */
  aiFilingNumber: string | null;
  /** The site's mini program QR code, under /public. */
  miniProgramQr: string | null;
}

export const SITE_FACTS: Record<HomepageSite, SiteFacts> = {
  intl: {
    companyName: null,
    address: null,
    email: null,
    phone: null,
    termsUrl: null,
    privacyUrl: null,
    icpNumber: null,
    psbNumber: null,
    psbUrl: null,
    aiFilingNumber: null,
    miniProgramQr: null,
  },
  cn: {
    companyName: null,
    address: null,
    email: null,
    phone: null,
    termsUrl: null,
    privacyUrl: null,
    icpNumber: null,
    psbNumber: null,
    psbUrl: null,
    aiFilingNumber: null,
    miniProgramQr: null,
  },
};

/** What the drawings show while a fact is missing (preview hosts only). */
export const FACT_PLACEHOLDERS: Record<HomepageSite, Record<keyof SiteFacts, string>> = {
  intl: {
    companyName: '[company name · intl]',
    address: '[address · intl]',
    email: '[email · intl]',
    phone: '[phone · intl]',
    termsUrl: '#',
    privacyUrl: '#',
    icpNumber: '',
    psbNumber: '',
    psbUrl: '#',
    aiFilingNumber: '',
    miniProgramQr: '[QR · telegram]',
  },
  cn: {
    companyName: '[公司名称]',
    address: '[公司地址]',
    email: '[联系邮箱]',
    phone: '[联系电话]',
    termsUrl: '#',
    privacyUrl: '#',
    icpNumber: '[ICP备案号]',
    psbNumber: '[公安备案号]',
    psbUrl: '#',
    aiFilingNumber: '[生成式AI服务备案号]',
    miniProgramQr: '[QR · wechat]',
  },
};

/** Hosts that show the homepage with placeholders. Everything else is production. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
/** Netlify deploy previews and branch deploys: `deploy-preview-268--kazispace.netlify.app`, `owen--kazispace.netlify.app`. */
const NETLIFY_PREVIEW = /^[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/;

export function isPreviewHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  return LOCAL_HOSTS.has(h) || NETLIFY_PREVIEW.test(h);
}

export interface HomepageRequestSite {
  site: HomepageSite;
  /** True on every host that is not a preview: placeholders never show there. */
  production: boolean;
}

export function normalizeHost(host: string | null | undefined): string {
  const h = (host ?? '').trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

export function siteForRequest(
  host: string | null | undefined,
  siteParam?: string | string[] | null
): HomepageRequestSite {
  const h = normalizeHost(host);
  if (isPreviewHost(h)) {
    const param = Array.isArray(siteParam) ? siteParam[0] : siteParam;
    return { site: param === 'cn' ? 'cn' : 'intl', production: false };
  }
  // Production, including any host not recognised as a preview: the site its domain names.
  return { site: h === 'kazispace.cn' || h.endsWith('.kazispace.cn') || h.endsWith('.cn') ? 'cn' : 'intl', production: true };
}

/**
 * A fact; while it is missing, its placeholder on a preview host and nothing (null) in
 * production, so the page leaves out what depends on it.
 */
export function factFor(
  site: HomepageSite,
  key: keyof SiteFacts,
  production: boolean,
  facts: Record<HomepageSite, SiteFacts> = SITE_FACTS
): string | null {
  const value = facts[site][key];
  if (value) return value;
  return production ? null : FACT_PLACEHOLDERS[site][key] || null;
}

/** The mini program each site offers next to the web (Homepage pattern, "Per site"). */
export function miniProgramFor(site: HomepageSite): 'telegram' | 'wechat' {
  return site === 'cn' ? 'wechat' : 'telegram';
}
