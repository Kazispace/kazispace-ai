'use client';

import { useEffect } from 'react';
import { authTelegramWebapp, getMe } from '@/lib/api-client';
import { getAuthToken } from '@/lib/auth';
import { syncMasterSession } from '@/lib/master-session';
import { captureStartParamFromContext } from '@/lib/tma-routing';
import {
  applyTelegramTheme,
  expandTelegramWebApp,
  getInitData,
  isTelegramWebApp,
  readyTelegramWebApp,
} from '@/lib/telegram';
import { useAuthStore, useUIStore } from '@/lib/store';

async function authenticateWithInitData(): Promise<boolean> {
  const initData = getInitData();
  if (!initData) return false;

  const res = await authTelegramWebapp(initData);
  if (!res.success || !res.data?.access_token) {
    return false;
  }

  const token = res.data.access_token;
  // Region session persisted inside authTelegramWebapp (KAZI-533).

  const me = await getMe();
  if (me.success && me.data) {
    useAuthStore.getState().login(token, me.data);
    await syncMasterSession();
    return true;
  }

  useAuthStore.setState({ token, isLoggedIn: true, user: null });
  return true;
}

export function useTmaInit() {
  const setTelegramMiniApp = useUIStore((s) => s.setTelegramMiniApp);
  const setTmaInitComplete = useUIStore((s) => s.setTmaInitComplete);

  useEffect(() => {
    // telegram-web-app.js injects `window.Telegram.WebApp` on every page load
    // (TmaScript is global). Only treat this as TMA when initData is present —
    // otherwise SessionNavShell would skip the whole desktop nav chrome.
    if (!isTelegramWebApp()) return;

    const init = async () => {
      setTelegramMiniApp(true);
      readyTelegramWebApp();
      expandTelegramWebApp();
      applyTelegramTheme();

      if (!getAuthToken()) {
        await authenticateWithInitData();
      }

      captureStartParamFromContext();
      setTmaInitComplete(true);
    };

    void init();
  }, [setTelegramMiniApp, setTmaInitComplete]);
}

export async function reauthTelegramIfPossible(): Promise<boolean> {
  if (!isTelegramWebApp()) return false;
  return authenticateWithInitData();
}
