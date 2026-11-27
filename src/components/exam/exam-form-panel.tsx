'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { MarkdownContent } from '@/components/clinic/markdown-content';
import { EtFormBlock } from '@/components/english/envelope/et-form-block';
import { Button } from '@/components/ui/button';
import { fetchChatHistory } from '@/lib/api-client';
import { parseEtForm, type EtForm, type EtFormSubmit } from '@/lib/english-tutor/form';
import { getEnglishExams, listFormSets } from '@/lib/exam-form/api';
import {
  FORM_TEMPLATE_ID,
  clearCurrentSet,
  groupExams,
  isAnswerForm,
  presetTurn,
  problemTypesFor,
  readCurrentSet,
  setName,
  writeCurrentSet,
  type CurrentSet,
  type ProblemType,
} from '@/lib/exam-form/model';
import { createSpace, deleteSpace, getSpace, sendSpaceTurn } from '@/lib/spaces-api';
import {
  mapSpaceHistoryMessages,
  resolveSpaceTurnAssistantMeta,
  resolveSpaceTurnReply,
} from '@/lib/spaces/turn';
import type { SpaceSummary } from '@/types/spaces';
import { cn } from '@/lib/utils';

/** One tutor reply as the form shows it: short text and, if any, its form (no user bubbles, no composer). */
interface FormTurn {
  key: string;
  text: string;
  form: EtForm | null;
}

type View =
  | { kind: 'home' }
  | { kind: 'practice'; current: CurrentSet }
  | { kind: 'history'; set: SpaceSummary };

function turnFromResponse(data: unknown, key: string): FormTurn {
  const meta = resolveSpaceTurnAssistantMeta(data) as Record<string, unknown> | undefined;
  return { key, text: resolveSpaceTurnReply(data), form: parseEtForm(meta ?? null) };
}

async function loadTurns(spaceId: string, locale: string): Promise<FormTurn[] | null> {
  const space = await getSpace(spaceId);
  if (!space.success || !space.data?.master_session_id) return null;
  const history = await fetchChatHistory(space.data.master_session_id, { limit: 200, fields: 'full' });
  if (!history.success || !history.data) return null;
  const rows = Array.isArray(history.data) ? history.data : history.data.messages ?? [];
  return mapSpaceHistoryMessages(rows as unknown[], locale)
    .filter((m) => m.role === 'assistant')
    .map((m, i) => ({
      key: `${m.id}-${i}`,
      text: m.content,
      form: parseEtForm((m as { assistantMeta?: Record<string, unknown> }).assistantMeta ?? null),
    }));
}

/**
 * The set in progress, read from the server (#316 review): only one set is open at a time (Exam 0.7.2), so
 * it is the newest form set if that set's last tutor reply still holds an answer form. This device's own
 * record adds the exam and problem type when it is the same set; a set started here whose first (preset)
 * turn never got a reply is still open, since it can be sent again. `undefined`: the server could not be read.
 */
async function findOpenSet(
  sets: SpaceSummary[],
  saved: CurrentSet | null,
  locale: string,
): Promise<CurrentSet | null | undefined> {
  const newest = sets[0];
  if (!newest) return null;
  const own = saved && saved.spaceId === newest.id ? saved : null;
  const turns = await loadTurns(newest.id, locale);
  if (turns === null) return undefined;
  const last = turns[turns.length - 1];
  const open = last ? isAnswerForm(last.form?.kind) : Boolean(own?.exam && own?.type);
  if (!open) return null;
  return { ...(own ?? {}), spaceId: newest.id, name: newest.name };
}

/** The set's title: its exam and problem type when this device knows them, else the set's own name. */
function setTitle(current: CurrentSet, t: ReturnType<typeof useTranslations>): string {
  if (current.exam && current.type) return `${t(`exams.${current.exam}`)} · ${t(`types.${current.type}`)}`;
  return current.name ?? '';
}

/**
 * Exam tab · Form mode (KAZI-1493; kazispace-ui Exam 0.7.2, D43–D45).
 *
 * Home: the user's own exams (`english_exams`, server order; Cambridge as one group), each with its
 * problem types; the set in progress (Continue / Drop this set) locks the list; past sets as history.
 * Practice: one `exam_form` space per set, started by ONE preset turn; the tutor's reply forms are the
 * steps; the set is finished once the reply to an answer no longer holds an answer form.
 */
export function ExamFormPanel({ locale }: { locale: string }) {
  const t = useTranslations('exam.form');
  const [view, setView] = useState<View>({ kind: 'home' });

  if (view.kind === 'practice') {
    return (
      <PracticeView
        locale={locale}
        current={view.current}
        onBack={() => setView({ kind: 'home' })}
      />
    );
  }
  if (view.kind === 'history') {
    return <HistoryView locale={locale} set={view.set} onBack={() => setView({ kind: 'home' })} />;
  }
  return (
    <FormHome
      locale={locale}
      onOpenPractice={(current) => setView({ kind: 'practice', current })}
      onOpenHistory={(set) => setView({ kind: 'history', set })}
      t={t}
    />
  );
}

function FormHome({
  locale,
  onOpenPractice,
  onOpenHistory,
  t,
}: {
  locale: string;
  onOpenPractice: (current: CurrentSet) => void;
  onOpenHistory: (set: SpaceSummary) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [exams, setExams] = useState<string[] | null | undefined>(undefined);
  const [sets, setSets] = useState<SpaceSummary[]>([]);
  const [current, setCurrent] = useState<CurrentSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [list, formSets] = await Promise.all([getEnglishExams(), listFormSets()]);
    const known = formSets ?? [];
    const saved = readCurrentSet();
    // The server decides which set is open (so it holds on every device); unreadable ⇒ this device's record.
    const open = formSets ? await findOpenSet(known, saved, locale) : undefined;
    const next = open === undefined ? saved : open;
    if (saved && next?.spaceId !== saved.spaceId) clearCurrentSet();
    else if (next) writeCurrentSet(next);
    setExams(list);
    setSets(known);
    setCurrent(next);
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async (exam: string, type: ProblemType) => {
    if (busy || current) return;
    setBusy(true);
    setError(null);
    const name = setName(t(`exams.${exam}`), t(`types.${type}`), locale);
    const created = await createSpace({ template_id: FORM_TEMPLATE_ID, name });
    setBusy(false);
    if (!created.success || !created.data?.id) {
      setError(t('startFailed'));
      return;
    }
    const next: CurrentSet = { spaceId: created.data.id, name, exam, type };
    writeCurrentSet(next);
    onOpenPractice(next);
  };

  const drop = async () => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    const res = await deleteSpace(current.spaceId);
    setBusy(false);
    if (!res.success) {
      // Not dropped: the set is still open on the server, so the list stays locked.
      setError(t('dropFailed'));
      return;
    }
    clearCurrentSet();
    setCurrent(null);
    void load();
  };

  if (exams === undefined) {
    return (
      <div className="flex justify-center py-10" data-testid="exam-form-loading">
        <Loader2 className="h-5 w-5 animate-spin text-workspace-muted" />
      </div>
    );
  }

  const history = sets.filter((s) => s.id !== current?.spaceId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="exam-form-home">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {current ? (
        <section
          data-testid="exam-form-in-progress"
          className="rounded-xl border border-primary/30 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-primary">{t('inProgress')}</p>
          <p className="mt-1 text-base font-semibold text-workspace-text" data-testid="exam-form-in-progress-title">
            {setTitle(current, t)}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => onOpenPractice(current)} data-testid="exam-form-continue">
              {t('continue')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void drop()}
              data-testid="exam-form-drop"
            >
              {t('drop')}
            </Button>
          </div>
        </section>
      ) : null}

      {!exams || exams.length === 0 ? (
        <p data-testid="exam-form-no-list" className="text-sm text-workspace-secondary">
          {t('noList')}
        </p>
      ) : (
        <section aria-label={t('examsHeading')} className="space-y-4">
          {current ? (
            <p className="text-xs text-workspace-muted" data-testid="exam-form-locked">
              {t('locked')}
            </p>
          ) : null}
          {groupExams(exams).map((group) => (
            <div key={group.id} className="rounded-xl bg-white p-4 shadow-sm" data-testid={`exam-form-group-${group.id}`}>
              {group.id === 'cambridge' ? (
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-workspace-text">{t('cambridge')}</h3>
                  <p className="text-[11px] text-workspace-muted">{t('cambridgeNote')}</p>
                </div>
              ) : null}
              {group.exams.map((exam) => (
                <div key={exam} className="mt-2 first:mt-0">
                  <h3 className={cn('font-semibold text-workspace-text', group.id === 'cambridge' ? 'text-xs' : 'text-sm')}>
                    {t(`exams.${exam}`)}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {problemTypesFor(exam).map((type) => (
                      <button
                        key={type}
                        type="button"
                        disabled={Boolean(current) || busy}
                        onClick={() => void start(exam, type)}
                        data-testid={`exam-form-start-${exam}-${type}`}
                        className="min-h-11 rounded-full border border-workspace-border px-4 text-sm text-workspace-text hover:bg-workspace-hover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t(`types.${type}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {history.length > 0 ? (
        <section aria-label={t('historyHeading')} data-testid="exam-form-history">
          <h2 className="mb-2 text-sm font-semibold text-workspace-text">{t('historyHeading')}</h2>
          <ul className="divide-y divide-workspace-border rounded-xl bg-white shadow-sm">
            {history.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onOpenHistory(s)}
                  className="w-full px-4 py-3 text-left text-sm text-workspace-text hover:bg-workspace-hover"
                  data-testid="exam-form-history-row"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TurnList({
  turns,
  activeKey,
  onSubmit,
  onCancel,
}: {
  turns: FormTurn[];
  activeKey: string | null;
  onSubmit?: (submit: EtFormSubmit) => Promise<boolean | void>;
  onCancel?: () => Promise<boolean | void>;
}) {
  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <div key={turn.key} className="rounded-xl bg-white p-4 shadow-sm" data-testid="exam-form-turn">
          {turn.text ? (
            <div className="text-sm text-workspace-text">
              <MarkdownContent content={turn.text} />
            </div>
          ) : null}
          {turn.form ? (
            <div className="mt-3">
              <EtFormBlock
                form={turn.form}
                active={turn.key === activeKey}
                onSubmit={turn.key === activeKey ? onSubmit : undefined}
                onCancel={turn.key === activeKey ? onCancel : undefined}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PracticeView({
  locale,
  current,
  onBack,
}: {
  locale: string;
  current: CurrentSet;
  onBack: () => void;
}) {
  const t = useTranslations('exam.form');
  const [turns, setTurns] = useState<FormTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      setSending(true);
      // Continue: the set already has turns ⇒ show them. A new set: send the one preset turn (D45).
      const existing = await loadTurns(current.spaceId, locale);
      if (existing && existing.length > 0) {
        setTurns(existing);
        setSending(false);
        return;
      }
      if (!current.exam || !current.type) {
        // Only a set started on this device can send its first turn; nothing else reaches here.
        setSending(false);
        setError(t('turnFailed'));
        return;
      }
      const res = await sendSpaceTurn(current.spaceId, presetTurn(current.exam, current.type));
      setSending(false);
      if (!res.success || !res.data) {
        setError(t('turnFailed'));
        return;
      }
      setTurns([turnFromResponse(res.data, 'preset')]);
    })();
  }, [current, locale, t]);

  const last = turns[turns.length - 1];
  // The latest form stays usable after the set is marked (e.g. the writing revision editor).
  const activeKey = !sending && last?.form ? last.key : null;

  const submit = async (built: EtFormSubmit): Promise<boolean> => {
    if (!last) return false;
    const answered = isAnswerForm(last.form?.kind);
    setSending(true);
    setError(null);
    const res = await sendSpaceTurn(current.spaceId, { message: built.display, meta: built.meta });
    setSending(false);
    if (!res.success || !res.data) {
      setError(t('turnFailed'));
      return false;
    }
    const reply = turnFromResponse(res.data, `t${turns.length}`);
    setTurns((prev) => [...prev, { ...reply, key: `t${prev.length}` }]);
    // Decided from the reply, not the submit (#316 review): an answer form sent back (a draft too short to
    // mark) keeps the set open; a reply to an answer without one means it was marked ⇒ history, list unlocks.
    if (isAnswerForm(reply.form?.kind)) {
      writeCurrentSet(current);
      setDone(false);
    } else if (answered) {
      clearCurrentSet();
      setDone(true);
    }
    return true;
  };

  // Cancel on the answer card (KAZI-1505, D46): the same as Drop this set on the home page.
  const cancel = async (): Promise<boolean> => {
    setError(null);
    const res = await deleteSpace(current.spaceId);
    if (!res.success) {
      setError(t('dropFailed'));
      return false;
    }
    clearCurrentSet();
    onBack();
    return true;
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-testid="exam-form-practice">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-workspace-secondary hover:bg-workspace-hover"
          aria-label={t('backToList')}
          data-testid="exam-form-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-workspace-text">{setTitle(current, t)}</h2>
      </div>
      <TurnList turns={turns} activeKey={activeKey} onSubmit={submit} onCancel={cancel} />
      {sending ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-workspace-muted" />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {done ? (
        <Button onClick={onBack} data-testid="exam-form-done-back">
          {t('backToList')}
        </Button>
      ) : null}
    </div>
  );
}

function HistoryView({ locale, set, onBack }: { locale: string; set: SpaceSummary; onBack: () => void }) {
  const t = useTranslations('exam.form');
  const [turns, setTurns] = useState<FormTurn[] | null>(null);

  useEffect(() => {
    void loadTurns(set.id, locale).then((loaded) => setTurns(loaded ?? []));
  }, [set.id, locale]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-testid="exam-form-history-view">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-workspace-secondary hover:bg-workspace-hover"
          aria-label={t('backToList')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-workspace-text">{set.name}</h2>
      </div>
      {turns === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-workspace-muted" />
        </div>
      ) : (
        // Read-only: every form frozen.
        <TurnList turns={turns} activeKey={null} />
      )}
    </div>
  );
}
