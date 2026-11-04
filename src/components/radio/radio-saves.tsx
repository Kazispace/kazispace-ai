'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, MoreHorizontal } from 'lucide-react';

import { deleteRadioSave, getRadioSaves } from '@/lib/radio/player-api';
import { radioReplayHref } from '@/lib/radio/routes';
import { cn } from '@/lib/utils';
import type { RadioSaveSummary } from '@/types/radio';

/** Data · Replay and deleting: a delete answered busy is sent again, at most 5 times. */
export const DELETE_BUSY_LIMIT = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A story card's "more" menu (`radio.home.more`): `radio.home.replay` and `radio.home.delete`
 * (personal-radio.md, Radio home).
 */
export function SaveMenu({ save, locale, onDelete }: { save: RadioSaveSummary; locale: string; onDelete: (s: RadioSaveSummary) => void }) {
  const t = useTranslations('radio.home');
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('more')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="radio-save-more"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-workspace-secondary hover:bg-gray-100"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-32 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <Link
            role="menuitem"
            href={radioReplayHref(locale, save.save_id)}
            data-testid="radio-save-replay"
            className="block px-4 py-2 text-sm text-workspace-text hover:bg-gray-50"
          >
            {t('replay')}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete(save);
            }}
            data-testid="radio-save-delete"
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
          >
            {t('delete')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Deleting a story (Deleting a story · Data): asked first, `radio.home.deleteConfirm` with
 * `radio.home.delete` and `radio.cancel`. `204` (also for a story already gone) ⇒ `onDeleted`; busy is sent
 * again; `404` ⇒ `onClosed` (the radio is off); anything else ⇒ `onFailed`.
 */
export function DeleteSaveDialog({
  save,
  onCancel,
  onDeleted,
  onClosed,
  onFailed,
}: {
  save: RadioSaveSummary;
  onCancel: () => void;
  onDeleted: () => void;
  onClosed: () => void;
  onFailed: () => void;
}) {
  const t = useTranslations('radio');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    for (let n = 0; n <= DELETE_BUSY_LIMIT; n += 1) {
      const res = await deleteRadioSave(save.save_id);
      if (res.success) {
        onDeleted();
        return;
      }
      if (res.status === 503 && res.errorCode === 'busy' && n < DELETE_BUSY_LIMIT) {
        await sleep(Math.max(1, res.retryAfter ?? 1) * 1000);
        continue;
      }
      if (res.status === 404) onClosed();
      else onFailed();
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-describedby="radio-delete-text"
        data-testid="radio-delete-dialog"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="radio-delete-text" className="text-sm text-workspace-text">
          {t('home.deleteConfirm', { title: save.title })}
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run()}
            data-testid="radio-delete-confirm"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t('home.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Listened (`radio.home.history`): collapsed by default. Finished stories, and stories replaced by a new one
 * (marked `radio.home.overwritten`); each has only Replay and Delete, never Continue.
 */
export function ListenedSection({
  locale,
  reloadKey,
  onDelete,
}: {
  locale: string;
  reloadKey: number;
  onDelete: (s: RadioSaveSummary) => void;
}) {
  const t = useTranslations('radio');
  const tStates = useTranslations('states');
  const [open, setOpen] = useState(false);
  const [saves, setSaves] = useState<RadioSaveSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);
  useEffect(() => () => void (live.current = false), []);

  useEffect(() => {
    if (!open) return;
    setFailed(false);
    void getRadioSaves().then((res) => {
      if (!live.current) return;
      if (res.success && res.data) setSaves(res.data.saves.filter((s) => s.status === 'completed' || s.status === 'overwritten'));
      else setFailed(true);
    });
  }, [open, reloadKey, attempt]);

  return (
    <section data-testid="radio-home-history" className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="radio-history-toggle"
        className="flex items-center gap-1 self-start text-sm font-semibold text-workspace-muted"
      >
        {t('home.history')}
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        failed ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-workspace-secondary">{t('offline')}</span>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-lg border border-gray-300 px-3 py-1.5">
              {tStates('retry')}
            </button>
          </div>
        ) : saves === null ? (
          <div className="h-14 animate-pulse rounded-xl bg-gray-100" aria-busy="true" />
        ) : (
          saves.map((save) => (
            <article
              key={save.save_id}
              data-testid="radio-history-item"
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-workspace-text">{save.title}</h3>
                {save.status === 'overwritten' ? (
                  <p className="mt-0.5 text-xs text-workspace-muted" data-testid="radio-history-overwritten">
                    {t('home.overwritten')}
                  </p>
                ) : null}
              </div>
              <SaveMenu save={save} locale={locale} onDelete={onDelete} />
            </article>
          ))
        )
      ) : null}
    </section>
  );
}

const GREETING_KEY = 'kazi.radio.greetedOn';

/** The host's greeting (Radio home · Greeting): once a day, on the first visit of the day. */
export function useDailyGreeting(today: string = new Date().toISOString().slice(0, 10)): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(GREETING_KEY) !== today) {
        window.localStorage.setItem(GREETING_KEY, today);
        setShow(true);
      }
    } catch {
      // Without storage the greeting is simply not shown, rather than shown on every visit.
    }
  }, [today]);
  return show;
}
