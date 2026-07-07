import { getRequestConfig } from 'next-intl/server';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../constants';
import { mergeMessages } from './merge-messages';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? DEFAULT_LOCALE;
  const enMessages = (await import('./en.json')).default;
  if (locale === 'en') {
    return { locale, messages: enMessages };
  }
  const localeMessages = (await import(`./${locale}.json`)).default;
  return {
    locale,
    messages: mergeMessages(enMessages, localeMessages) as typeof enMessages,
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
