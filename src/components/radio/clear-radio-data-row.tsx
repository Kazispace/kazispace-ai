'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { getRadioHome, radioAccessOf } from '@/lib/radio/api';
import { dropRadioEvents } from '@/lib/radio/events';
import { deleteRadioMemory } from '@/lib/radio/player-api';
import { useUIStore } from '@/lib/store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const CLEAR_BUSY_LIMIT = 5;

/**
 * Me · Settings: 「清除个人电台数据」 (KAZI-1209 part 5; kazispace-ui personal-radio.md, Clearing radio data
 * from Me, D29). For **every signed-in user while the radio is switched on**, whether or not the radio is
 * open to them, so anyone can remove what the radio kept. When Me opens, the radio's status is read once
 * with `GET home`, for every app language:
 *
 * - `200`, or `403` `radio_not_in_audience` / `radio_pro_required` ⇒ the row shows;
 * - `404` (off) or unknown (network / server error) ⇒ hidden this time (an entry that cannot work is never drawn).
 *
 * The row never opens a radio screen and says nothing about who the radio is for. Tapping it opens the same
 * dialog as radio settings; while clearing, the dialog cannot be dismissed. `204` ⇒ closed + `radio.settings.cleared`;
 * busy ⇒ sent again; `404` ⇒ closed and the row disappears, no toast; anything else ⇒ `radio.settings.clearFailed`.
 */
export function ClearRadioDataRow({ authenticated }: { authenticated: boolean }) {
  const tMine = useTranslations('mine');
  const t = useTranslations('radio');
  const showToast = useUIStore((s) => s.showToast);
  const [shown, setShown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    let live = true;
    void getRadioHome().then((res) => {
      if (!live) return;
      const access = radioAccessOf(res);
      setShown(access === 'open' || (access === 'closed' && res.status === 403));
    });
    return () => {
      live = false;
    };
  }, [authenticated]);

  const clear = async () => {
    setClearing(true);
    for (let n = 0; n <= CLEAR_BUSY_LIMIT; n += 1) {
      const res = await deleteRadioMemory();
      if (res.success) {
        dropRadioEvents();
        setClearing(false);
        setConfirming(false);
        showToast(t('settings.cleared'));
        return;
      }
      if (res.status === 503 && res.errorCode === 'busy' && n < CLEAR_BUSY_LIMIT) {
        await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
        continue;
      }
      setClearing(false);
      setConfirming(false);
      if (res.status === 404) setShown(false);
      else showToast(t('settings.clearFailed'));
      return;
    }
  };

  if (!shown) return null;
  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className="block w-full text-left" data-testid="me-clear-radio-data">
        <Card className="cursor-pointer transition-colors hover:border-red-300">
          <CardContent className="p-4">
            <span className="font-medium text-red-600">{tMine('clearRadioData')}</span>
          </CardContent>
        </Card>
      </button>
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => !clearing && setConfirming(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-describedby="me-clear-radio-text"
            data-testid="me-clear-radio-dialog"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="me-clear-radio-text" className="text-sm text-workspace-text">
              {t('settings.clearMemoryConfirm')}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={clearing}
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={() => void clear()}
                data-testid="me-clear-radio-confirm"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-70"
              >
                {clearing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {t('settings.clearMemoryAction')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
