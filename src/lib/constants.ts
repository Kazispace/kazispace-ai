export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://bot.kazispace.ai';

export const SUPPORTED_LOCALES = ['en', 'ru', 'kk', 'uz'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
/** CIS / Kazakhstan primary market — SDD §11 */
export const DEFAULT_LOCALE: SupportedLocale = 'ru';

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
  TMA_LAUNCH: '/tma/launch',
} as const;

export const CLIENT_VARIANTS = {
  WEB_BROWSER: 'web_browser',
  TELEGRAM_MINI_APP: 'telegram_mini_app',
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'kazi_auth_token',
  AUTH_COOKIE: 'kazi_token',
  DEVICE_ID: 'kazi_device_id',
  USER_INFO: 'kazi_user_info',
  PREFERRED_LOCALE: 'kazi_preferred_locale',
  SESSION_ID: 'kazi_chat_session_id',
  ENGLISH_LEVEL: 'kazi_english_level',
  REFERRAL_DISMISSED: 'kazi_referral_dismissed',
  TMA_PENDING_ACTION: 'kazi_tma_pending_action',
  CV_AGENT_HANDOFF: 'kazi_cv_agent_handoff',
} as const;

export const AGENT_NAME = 'Serík';
