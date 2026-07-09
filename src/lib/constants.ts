export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://bot.kazispace.ai';

/** MVP UI locales — Global South + Chinese (SDD §11) */
export const SUPPORTED_LOCALES = ['en', 'ru', 'kk', 'uz', 'zh'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
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
  ENGLISH: '/english',
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
  /** Set when user explicitly picks UI language (Header / Mine). */
  LOCALE_MANUAL: 'kazi_locale_manual',
  /** Profile `primary_locale` mirrored for middleware route redirect. */
  PROFILE_LANGUAGE: 'kazi_profile_language',
  SESSION_ID: 'kazi_chat_session_id',
  /** Canonical master session from GET /chat/sessions/default (logged-in). */
  MASTER_SESSION: 'kazi_master_session_id',
  ENGLISH_LEVEL: 'kazi_english_level',
  REFERRAL_DISMISSED: 'kazi_referral_dismissed',
  TMA_PENDING_ACTION: 'kazi_tma_pending_action',
  CV_AGENT_HANDOFF: 'kazi_cv_agent_handoff',
} as const;

export const AGENT_NAME = 'Serík';

/** Phase 1.5 IRP — off until KAZI-58 staging (API §7.7). */
export const IRP_PROFILE_ENABLED =
  process.env.NEXT_PUBLIC_IRP_PROFILE_ENABLED === 'true';

/** Phase 1 EPP — off until KAZI-64 staging (API §14). */
export const EPP_PROFILE_ENABLED =
  process.env.NEXT_PUBLIC_EPP_PROFILE_ENABLED === 'true';
