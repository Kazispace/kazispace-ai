import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SUPPORTED_LOCALES } from "@/lib/constants";
import { Providers } from "@/components/providers";
import { AppChrome } from "@/components/app-chrome";
import { TmaScript } from "@/components/tma/tma-script";
import { CHUNK_RELOAD_INLINE_SCRIPT } from "@/lib/chunk-reload";
import { WebVitalsReporter } from "@/components/perf/web-vitals-reporter";

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  
  if (!SUPPORTED_LOCALES.includes(locale as typeof SUPPORTED_LOCALES[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable}>
      <head>
        {/* Reload once if a startup script fails to download (see lib/chunk-reload). */}
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RELOAD_INLINE_SCRIPT }} />
        <TmaScript />
      </head>
      <body>
        <Providers>
          <NextIntlClientProvider messages={messages}>
            <div className="min-h-screen bg-background">
              {children}
            </div>
            <AppChrome />
            <WebVitalsReporter />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
