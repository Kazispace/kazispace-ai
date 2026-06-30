'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  captureStartParamFromContext,
  type TmaPendingAction,
} from '@/lib/tma-routing';
import {
  expandTelegramWebApp,
  getInitData,
  getTelegramWebApp,
  isTelegramWebApp,
  readyTelegramWebApp,
  applyTelegramTheme,
} from '@/lib/telegram';
import { authTelegramWebapp, getMe } from '@/lib/api-client';
import { setAuthToken } from '@/lib/auth';
import { useAuthStore, useUIStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

interface TmaLaunchPageProps {
  params: { locale: string };
}

function routeForAction(locale: string, action: TmaPendingAction): string {
  switch (action.type) {
    case 'subscription':
      return `/${locale}/subscription`;
    case 'job':
      return `/${locale}/chat`;
    case 'activate_agent':
    case 'clinic':
    case 'restore':
    default:
      return `/${locale}/chat`;
  }
}

export default function TmaLaunchPage({ params }: TmaLaunchPageProps) {
  const { locale } = params;
  const router = useRouter();
  const t = useTranslations('tma');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'fallback' | 'error'>('loading');

  useEffect(() => {
    const run = async () => {
      const tg = getTelegramWebApp();

      if (!tg || !getInitData()) {
        setStatus('fallback');
        return;
      }

      useUIStore.getState().setTelegramMiniApp(true);
      readyTelegramWebApp();
      expandTelegramWebApp();
      applyTelegramTheme();

      const authRes = await authTelegramWebapp(getInitData());
      if (!authRes.success || !authRes.data?.access_token) {
        setError(authRes.error ?? t('authFailed'));
        setStatus('error');
        return;
      }

      const token = authRes.data.access_token;
      setAuthToken(token);

      const me = await getMe();
      if (me.success && me.data) {
        useAuthStore.getState().login(token, me.data);
      } else {
        useAuthStore.setState({ token, isLoggedIn: true, user: null });
      }

      const action = captureStartParamFromContext();
      useUIStore.getState().setTmaInitComplete(true);
      router.replace(routeForAction(locale, action));
    };

    void run();
  }, [locale, router, t]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gray-bg">
        <div className="w-10 h-10 border-2 border-kazi-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-600">{t('launching')}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-kazi-navy">{t('authFailed')}</p>
        <p className="text-sm text-gray-600">{error}</p>
        <Button onClick={() => router.push(`/${locale}/login`)}>{t('useOtpLogin')}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center max-w-md mx-auto">
      <span className="text-5xl">✈️</span>
      <h1 className="text-xl font-bold text-kazi-navy">{t('openInTelegramTitle')}</h1>
      <p className="text-sm text-gray-600 leading-relaxed">{t('openInTelegramDesc')}</p>
      <Button onClick={() => router.push(`/${locale}/chat`)} variant="secondary">
        {t('continueInBrowser')}
      </Button>
    </div>
  );
}
