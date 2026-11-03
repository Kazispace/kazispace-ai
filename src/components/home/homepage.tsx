import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Globe, MessageCircle, Radio } from 'lucide-react';

import { HomeCtas } from '@/components/home/home-ctas';
import { LocaleSwitcher } from '@/components/locale/locale-switcher';
import { factFor, miniProgramFor, type HomepageSite } from '@/lib/homepage-site';

/**
 * KAZI-1245: the public homepage (kazispace-ui Homepage pattern 0.1, decision D30).
 * Not a chat and no product functions: what KaziSpace is, the way in, and the company,
 * contact and legal facts for the site it is served on.
 */
export async function Homepage({
  locale,
  site,
  production,
}: {
  locale: string;
  site: HomepageSite;
  /** Production leaves a missing fact out; a preview shows its placeholder (Homepage 0.2). */
  production: boolean;
}) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const mini = miniProgramFor(site);
  const fact = (key: Parameters<typeof factFor>[1]) => factFor(site, key, production);
  const company = fact('companyName');
  const address = fact('address');
  const email = fact('email');
  const phone = fact('phone');
  const terms = fact('termsUrl');
  const privacy = fact('privacyUrl');
  const icp = fact('icpNumber');
  const psb = fact('psbNumber');
  const psbIcon = fact('psbIcon');
  const aiFiling = fact('aiFilingNumber');
  const qr = fact('miniProgramQr');

  // Owen, 2026-11-03: "only mention ET, Private audio station for now" (both sites).
  const features = [
    { id: 'english', Icon: Globe },
    { id: 'radio', Icon: Radio },
  ] as const;
  const steps = ['ask', 'specialist', 'keep'] as const;

  return (
    <div className="min-h-screen bg-white text-workspace-text" data-testid="homepage" data-site={site}>
      <header className="sticky top-0 z-30 border-b border-workspace-border bg-white">
        <div className="mx-auto flex max-w-[1120px] items-center gap-6 px-4 py-2 md:py-3">
          {/* The horizontal logo, light-background variant (kazispace-ui D10, Assets — Logo). */}
          <Link href={`/${locale}`} className="shrink-0" data-testid="home-logo">
            <Image
              src="/brand/kazispace-logo-horizontal.png"
              alt="KaziSpace"
              // Display size (40 px tall); the 958×327 file is scaled down, so next/image
              // serves a logo-sized image instead of a full-width one.
              width={117}
              height={40}
              priority
              className="h-9 w-auto md:h-10"
            />
          </Link>
          <nav aria-label="KaziSpace" className="ml-auto hidden items-center gap-6 text-sm font-medium text-workspace-secondary md:flex">
            <a href="#features" className="hover:text-workspace-text">
              {t('nav.features')}
            </a>
            <a href="#how-it-works" className="hover:text-workspace-text">
              {t('nav.howItWorks')}
            </a>
            <LocaleSwitcher locale={locale} variant="compact" />
          </nav>
          <div className="ml-auto md:ml-0">
            <HomeCtas locale={locale} placement="bar" />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1120px] flex-col gap-10 px-4 py-10 md:flex-row md:items-center md:gap-16 md:py-24">
          <div className="flex flex-1 flex-col gap-6">
            <h1 className="text-[30px] font-semibold leading-tight">{t('hero.title')}</h1>
            <p className="max-w-[480px] text-base text-workspace-secondary">{t('hero.body')}</p>
            <HomeCtas locale={locale} placement="hero" />
          </div>
          <div className="flex justify-center rounded-xl bg-workspace-bg p-6 md:w-[480px] md:p-12">
            <Image
              src="/home/chat-phone.png"
              alt={t('hero.imageAlt')}
              width={390}
              height={844}
              priority
              className="h-auto w-[234px] rounded-3xl border border-workspace-border md:w-[260px]"
            />
          </div>
        </section>

        <section id="features" className="scroll-mt-20 bg-workspace-bg">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 py-12 md:gap-8 md:py-24">
            <h2 className="text-2xl font-semibold">{t('features.title')}</h2>
            <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
              {features.map(({ id, Icon }) => (
                <li
                  key={id}
                  className="flex gap-4 rounded-xl border border-workspace-border bg-white p-4 md:flex-col md:gap-3 md:p-6"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-workspace-text">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-base font-semibold">{t(`features.${id}.title`)}</span>
                    <span className="text-sm text-workspace-secondary">{t(`features.${id}.body`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 py-12 md:gap-8 md:py-24">
            <h2 className="text-2xl font-semibold">{t('steps.title')}</h2>
            <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
              {steps.map((id, i) => (
                <li key={id} className="flex gap-4 md:flex-col md:gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-base font-semibold">{t(`steps.${id}.title`)}</span>
                    <span className="text-sm text-workspace-secondary">{t(`steps.${id}.body`)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-workspace-bg">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 py-12 md:gap-8 md:py-24">
            <h2 className="text-2xl font-semibold">{t('platforms.title')}</h2>
            <ul className="grid gap-4 md:grid-cols-2 md:gap-6" data-testid="home-platforms">
              <li className="flex flex-col gap-2 rounded-xl border border-workspace-border bg-white p-4 md:p-6">
                <Globe className="h-6 w-6" aria-hidden />
                <span className="text-base font-semibold">{t('platforms.web')}</span>
                <span className="text-sm text-workspace-secondary">{t('platforms.webBody')}</span>
              </li>
              <li className="flex items-center gap-6 rounded-xl border border-workspace-border bg-white p-4 md:p-6">
                <span className="flex flex-1 flex-col gap-2">
                  <MessageCircle className="h-6 w-6" aria-hidden />
                  <span className="text-base font-semibold">{t(`platforms.${mini}`)}</span>
                  <span className="text-sm text-workspace-secondary">{t('platforms.miniBody')}</span>
                </span>
                {/* A QR code on desktop; on a phone the mini program opens in its own app. */}
                {qr && (
                  <span className="hidden flex-col items-center gap-2 md:flex">
                    {qr.startsWith('/') ? (
                      <Image src={qr} alt="" width={96} height={96} className="rounded-md" />
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded-md bg-gray-100 px-1 text-center text-xs text-workspace-secondary">
                        {qr}
                      </span>
                    )}
                    <span className="text-xs text-workspace-secondary">{t('platforms.scan')}</span>
                  </span>
                )}
              </li>
            </ul>
          </div>
        </section>

        <section>
          <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-6 px-4 py-12 text-center md:py-24">
            <h2 className="text-2xl font-semibold">{t('closing.title')}</h2>
            <HomeCtas locale={locale} placement="closing" />
          </div>
        </section>
      </main>

      <footer className="border-t border-workspace-border bg-workspace-bg" data-testid="home-footer">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 py-10 md:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:gap-12">
            <div className="flex flex-1 flex-col gap-3">
              <Image
                src="/brand/kazispace-logo-horizontal.png"
                alt="KaziSpace"
                width={117}
                height={40}
                className="h-10 w-auto self-start"
              />
              <div className="flex items-center gap-1 text-sm text-workspace-secondary">
                <Globe className="h-4 w-4" aria-hidden />
                <span className="sr-only">{t('footer.language')}</span>
                <LocaleSwitcher locale={locale} variant="compact" />
              </div>
            </div>
            {/* A column, link or line whose fact is still missing is left out (Homepage 0.2). */}
            {(company || address) && (
              <FooterColumn title={t('footer.company')}>
                {company && <span>{company}</span>}
                {address && <span>{address}</span>}
              </FooterColumn>
            )}
            {(email || phone) && (
              <FooterColumn title={t('footer.contact')}>
                {email && <a href={`mailto:${email}`}>{email}</a>}
                {phone && <span>{phone}</span>}
              </FooterColumn>
            )}
            {(terms || privacy) && (
              <FooterColumn title={t('footer.legal')}>
                {terms && <a href={terms}>{t('footer.terms')}</a>}
                {privacy && <a href={privacy}>{t('footer.privacy')}</a>}
              </FooterColumn>
            )}
          </div>
          <div className="flex flex-col gap-1 text-xs text-workspace-secondary">
            <span>
              {t('footer.copyright', { year: new Date().getFullYear(), company: company ?? 'KaziSpace' })}
            </span>
            {site === 'cn' && icp && (
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" data-testid="home-icp">
                {icp}
              </a>
            )}
            {site === 'cn' && psb && (
              <a
                href={fact('psbUrl') ?? 'https://beian.mps.gov.cn/'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1"
                data-testid="home-psb"
              >
                {psbIcon && <Image src={psbIcon} alt="" width={16} height={16} />}
                {psb}
              </a>
            )}
            {site === 'cn' && aiFiling && <span data-testid="home-ai-filing">{aiFiling}</span>}
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-workspace-secondary">
      <span className="text-xs font-medium text-workspace-text">{title}</span>
      {children}
    </div>
  );
}
