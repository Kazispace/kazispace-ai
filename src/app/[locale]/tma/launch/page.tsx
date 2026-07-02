'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  parseStartParam,
  routeForTmaAction,
  shouldPersistTmaAction,
  setPendingTmaAction,
} from '@/lib/tma-routing';
import {
  expandTelegramWebApp,
  getInitData,
  getTelegramWebApp,
  readyTelegramWebApp,
  applyTelegramTheme,
  resolveStartParam,
} from '@/lib/telegram';
import { authTelegramWebapp, getMe } from '@/lib/api-client';
import { setAuthToken } from '@/lib/auth';
import { useAuthStore, useUIStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

interface TmaLaunchPageProps {
  params: { locale: string };
}

export default function TmaLaunchPage({ params }: TmaLaunchPageProps) {
  const { locale } = params;
  const router = useRouter();
  const t = useTranslations('tma');
  const tRef = useRef(t);
  tRef.current = t;
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'fallback' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const tg = getTelegramWebApp();

      if (!tg || !getInitData()) {
        if (!cancelled) setStatus('fallback');
        return;
      }

      useUIStore.getState().setTelegramMiniApp(true);
      readyTelegramWebApp();
      expandTelegramWebApp();
      applyTelegramTheme();

      const authRes = await authTelegramWebapp(getInitData());
      if (cancelled) return;

      if (!authRes.success || !authRes.data?.access_token) {
        setError(authRes.error ?? tRef.current('authFailed'));
        setStatus('error');
        return;
      }

      const token = authRes.data.access_token;
      setAuthToken(token);

      const me = await getMe();
      if (cancelled) return;

      if (me.success && me.data) {
        useAuthStore.getState().login(token, me.data);
      } else {
        useAuthStore.setState({ token, isLoggedIn: true, user: null });
      }

      const action = parseStartParam(resolveStartParam());
      if (shouldPersistTmaAction(action)) {
        setPendingTmaAction(action);
      }
      useUIStore.getState().setTmaInitComplete(true);
      router.replace(routeForTmaAction(locale, action));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

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
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={() => router.push(`/${locale}/login`)}>{t('useOtpLogin')}</Button>
          <Button onClick={() => router.push(`/${locale}/chat`)} variant="secondary">
            {t('continueInBrowser')}
          </Button>
        </div>
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
