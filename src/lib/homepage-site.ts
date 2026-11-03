/**
 * KAZI-1245: which site the public homepage is serving, and its company facts
 * (kazispace-ui Homepage pattern, "Per site" and "Facts needed before launch"; D30).
 *
 * The facts below are still to come from Owen. Until every required fact of a
 * production site is filled in, that site keeps today's behaviour: no homepage,
 * and the main chat stays open to signed-out visitors. A placeholder is never shown
 * on kazispace.ai or www.kazispace.cn. Preview hosts (Netlify previews, localhost)
 * show the homepage with its placeholders so it can be reviewed; `?site=cn` there
 * previews the kazispace.cn version.
 *
 * When a fact arrives, fill it in here. When every required fact of a site is in,
 * that site's homepage goes live and its guest chat goes, in the same deploy.
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

const REQUIRED: Record<HomepageSite, (keyof SiteFacts)[]> = {
  intl: ['companyName', 'address', 'email', 'termsUrl', 'privacyUrl', 'miniProgramQr'],
  cn: [
    'companyName',
    'address',
    'email',
    'termsUrl',
    'privacyUrl',
    'icpNumber',
    'psbNumber',
    'psbUrl',
    'aiFilingNumber',
    'miniProgramQr',
  ],
};

const PRODUCTION_HOSTS: Record<string, HomepageSite> = {
  'kazispace.ai': 'intl',
  'www.kazispace.ai': 'intl',
  'kazispace.cn': 'cn', // pragma: allowlist secret
  'www.kazispace.cn': 'cn', // pragma: allowlist secret
};

export interface HomepageRequestSite {
  site: HomepageSite;
  /** True on kazispace.ai / www.kazispace.cn, where placeholders must never show. */
  production: boolean;
}

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(':')[0].trim().toLowerCase();
}

export function siteForRequest(
  host: string | null | undefined,
  siteParam?: string | string[] | null
): HomepageRequestSite {
  const known = PRODUCTION_HOSTS[normalizeHost(host)];
  if (known) return { site: known, production: true };
  const param = Array.isArray(siteParam) ? siteParam[0] : siteParam;
  return { site: param === 'cn' ? 'cn' : 'intl', production: false };
}

export function missingFacts(site: HomepageSite, facts: Record<HomepageSite, SiteFacts> = SITE_FACTS): (keyof SiteFacts)[] {
  return REQUIRED[site].filter((key) => !facts[site][key]);
}

/**
 * Whether this request gets the homepage (and, with it, no guest chat).
 * Preview hosts always do; a production site only once its facts are complete.
 */
export function homepageLive(
  host: string | null | undefined,
  siteParam?: string | string[] | null,
  facts: Record<HomepageSite, SiteFacts> = SITE_FACTS
): boolean {
  const { site, production } = siteForRequest(host, siteParam);
  return !production || missingFacts(site, facts).length === 0;
}

/** A fact, or its placeholder on a preview host. */
export function factFor(
  site: HomepageSite,
  key: keyof SiteFacts,
  facts: Record<HomepageSite, SiteFacts> = SITE_FACTS
): string | null {
  return facts[site][key] ?? (FACT_PLACEHOLDERS[site][key] || null);
}

/** The mini program each site offers next to the web (Homepage pattern, "Per site"). */
export function miniProgramFor(site: HomepageSite): 'telegram' | 'wechat' {
  return site === 'cn' ? 'wechat' : 'telegram';
}
