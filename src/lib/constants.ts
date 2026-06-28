export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://bot.kazispace.ai';

export const SUPPORTED_LOCALES = ['en', 'ru', 'kk', 'uz'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const ROUTES = {
  HOME: '/',
  CHAT: '/chat',
  LOGIN: '/login',
  MINE: '/mine',
  PROFILE: '/profile',
  SUBSCRIPTION: '/subscription',
  CREDITS: '/credits',
  LEDGER: '/ledger',
  CV: '/cv',
  INTERVIEW: '/interview',
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'kazi_auth_token',
  DEVICE_ID: 'kazi_device_id',
  USER_INFO: 'kazi_user_info',
  PREFERRED_LOCALE: 'kazi_preferred_locale',
} as const;
