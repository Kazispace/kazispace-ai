import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Homepage } from '@/components/home/homepage';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import { HOME_COVERS, normalizeHost, siteForRequest } from '@/lib/homepage-site';

/**
 * Rendered per request: which site this is (and whether its homepage is live) comes from
 * the request's host. Pre-rendered at build time there is no host, which reads as a preview
 * and would put the placeholder homepage on the production sites.
 */
export const dynamic = 'force-dynamic';

interface LocaleHomeProps {
  params: { locale: string };
  searchParams?: { site?: string | string[] };
}

export async function generateMetadata({ params }: LocaleHomeProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'home' });
  const host = normalizeHost(headers().get('host'));
  const base = host ? `https://${host}` : undefined;
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: base
      ? {
          canonical: `${base}/${params.locale}`,
          languages: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `${base}/${l}`])),
        }
      : undefined,
    openGraph: { title: t('meta.title'), description: t('meta.description'), images: [HOME_COVERS[0]] },
  };
}

/**
 * KAZI-1245 (kazispace-ui D30, Homepage 0.2): the locale root is the public homepage, for
 * everyone, on every host.
 */
export default function LocaleHome({ params, searchParams }: LocaleHomeProps) {
  setRequestLocale(params.locale);
  const { site, production } = siteForRequest(headers().get('host'), searchParams?.site);
  return <Homepage locale={params.locale} site={site} production={production} />;
}
