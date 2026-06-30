'use client';

import { CLIENT_VARIANTS } from './constants';

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.Telegram?.WebApp?.initData);
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? '';
}

export function getTelegramPlatform(): string | null {
  return getTelegramWebApp()?.platform ?? null;
}

export function getStartParamFromSdk(): string | null {
  const tg = getTelegramWebApp();
  if (tg?.startParam) return tg.startParam;
  if (tg?.initDataUnsafe?.start_param) return tg.initDataUnsafe.start_param;
  return null;
}

/** startParam from SDK, URL ?startapp=, or ?tgWebAppStartParam= */
export function resolveStartParam(search?: string): string | null {
  const fromSdk = getStartParamFromSdk();
  if (fromSdk) return fromSdk;

  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(search ?? window.location.search);
  return params.get('startapp') ?? params.get('tgWebAppStartParam');
}

export function readyTelegramWebApp(): void {
  getTelegramWebApp()?.ready();
}

export function expandTelegramWebApp(): void {
  getTelegramWebApp()?.expand();
}

export function closeTelegramWebApp(): void {
  getTelegramWebApp()?.close();
}

export function openTelegramLink(url: string): void {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function applyTelegramTheme(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;

  const { themeParams, colorScheme } = tg;
  const root = document.documentElement;

  if (colorScheme === 'dark') {
    root.classList.add('tma-dark');
  }

  if (themeParams.bg_color) {
    tg.setBackgroundColor(themeParams.bg_color);
    root.style.setProperty('--tma-bg', themeParams.bg_color);
  }
  if (themeParams.text_color) {
    root.style.setProperty('--tma-text', themeParams.text_color);
  }
}

export function getTmaClientHeaders(): Record<string, string> {
  if (!isTelegramWebApp()) return {};
  const platform = getTelegramPlatform();
  return {
    'X-Client-Variant': CLIENT_VARIANTS.TELEGRAM_MINI_APP,
    ...(platform ? { 'X-Telegram-Platform': platform } : {}),
  };
}
