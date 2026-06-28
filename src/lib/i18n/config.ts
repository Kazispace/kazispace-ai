import { getRequestConfig } from 'next-intl/server';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../constants';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});

export function getLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/');
  const locale = segments[1];
  if (locale && SUPPORTED_LOCALES.includes(locale as any)) {
    return locale;
  }
  return DEFAULT_LOCALE;
}
