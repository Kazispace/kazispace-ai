/**
 * Exam tab · Form mode (KAZI-1493; kazispace-ui Exam 0.7.2, D43–D45).
 *
 * Owen, 2026-11-27, quoted as written: "我觉得前段使用表格和对话是等价的。 使用表格选择就是预设对话模式";
 * "1st level: exam type … 2 nd level : problem type …"; "为什么计费两次？ 不能接受。";
 * "答完题之前不能点击。 点完后， 过去的题集作为历史保存 并显示。 用户可以再点击。"
 *
 * The form is a preset conversation: each set is its own `exam_form` space; starting one sends ONE turn
 * — the sentence a user could type in Chat, with the chosen exam attached (`et_form_preset`).
 */
import type { SpaceTurnRequest } from '@/types/spaces';

export const FORM_TEMPLATE_ID = 'exam_form';
export const FORM_PRESET_ACTION = 'et_form_preset';

export type ProblemType = 'grammar' | 'vocabulary' | 'reading' | 'writing' | 'speaking';

/** The sentence a user would type in Chat for each problem type (backend `switch_intent` entry phrases). */
export const ENTRY_PHRASE: Record<ProblemType, string> = {
  grammar: '练语法',
  vocabulary: '练词汇',
  reading: '练阅读',
  writing: '练写作',
  speaking: '练口语',
};

export const CAMBRIDGE_EXAMS: readonly string[] = ['pet', 'fce', 'cae'];

/** The order problem types are shown in (the server sends them in this order too). */
export const PROBLEM_TYPE_ORDER: readonly ProblemType[] = ['grammar', 'vocabulary', 'reading', 'writing', 'speaking'];

/**
 * **Fallback only** (KAZI-1510, kazispace-ui Exam 0.10): the problem types come from the server,
 * `english_exam_problem_types` on `GET /api/v1/me`. This table is used for an exam only when that field is
 * missing (an older server), `{}` (the server could not read its questions), or has no entry for the exam.
 * Owen, 2026-11-28, quoted as written: 「标题可以固定 做过的题集显示得分 考试的题型由服务器下发」.
 */
const PROBLEM_TYPES: Record<string, readonly ProblemType[]> = {
  ielts: ['grammar', 'vocabulary', 'writing', 'speaking'],
  cet4: ['grammar', 'vocabulary', 'writing'],
  cet6: ['grammar', 'vocabulary', 'writing'],
  cky: ['grammar', 'vocabulary', 'writing'],
  gaokao: ['grammar', 'vocabulary', 'reading', 'writing'],
  pet: ['grammar', 'vocabulary', 'writing'],
  fce: ['grammar', 'vocabulary', 'writing'],
  cae: ['grammar', 'vocabulary', 'writing'],
};

/** The server's problem types per exam (`english_exam_problem_types`), or `null` when it sent none. */
export type ServedProblemTypes = Record<string, readonly ProblemType[]>;

/** The problem types under `exam`: the server's when it sent an entry for it, else this app's fallback table. */
export function problemTypesFor(exam: string, served?: ServedProblemTypes | null): readonly ProblemType[] {
  const fromServer = served?.[exam];
  if (fromServer) return fromServer;
  return PROBLEM_TYPES[exam] ?? ['grammar', 'vocabulary', 'writing'];
}

/**
 * The exams the home page shows: the server's order, leaving out only an exam whose problem-type list from the
 * server is empty (kazispace-ui Exam 0.10; the server can list an exam whose questions are none of the five types).
 */
export function shownExams(exams: readonly string[], served?: ServedProblemTypes | null): string[] {
  return exams.filter((exam) => problemTypesFor(exam, served).length > 0);
}

/** `english_exam_problem_types` as read: known types only, in `PROBLEM_TYPE_ORDER`; not an object ⇒ `null`. */
export function parseServedProblemTypes(raw: unknown): ServedProblemTypes | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, ProblemType[]> = {};
  for (const [exam, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    out[exam] = PROBLEM_TYPE_ORDER.filter((t) => list.includes(t));
  }
  return out;
}

/**
 * One set's result (`form_result` on `GET /api/v1/spaces?include_form=true`, KAZI-1510): right answers out of
 * the set's questions, or the 0–6 score for writing and speaking (the same score as the marking card).
 */
export type FormResult =
  | { kind: 'score'; correct: number; total: number }
  | { kind: 'band'; score: number; max: number };

export function parseFormResult(raw: unknown): FormResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (r.kind === 'score' && num(r.correct) && num(r.total)) {
    return { kind: 'score', correct: r.correct as number, total: r.total as number };
  }
  if (r.kind === 'band' && num(r.score) && num(r.max)) return { kind: 'band', score: r.score as number, max: r.max as number };
  return null;
}

/** "3 / 5" for a set; "4.00 / 6" for writing and speaking (two decimals, as on the marking card). */
export function formResultLabel(result: FormResult | null | undefined): string | null {
  if (!result) return null;
  if (result.kind === 'score') return `${result.correct} / ${result.total}`;
  const max = Number.isInteger(result.max) ? String(result.max) : result.max.toFixed(2);
  return `${result.score.toFixed(2)} / ${max}`;
}

/** First level, in the server's order; the Cambridge levels are one group where the first of them appears. */
export interface ExamGroup {
  id: string;
  exams: string[];
}

export function groupExams(exams: readonly string[]): ExamGroup[] {
  const groups: ExamGroup[] = [];
  let cambridge: ExamGroup | null = null;
  for (const exam of exams) {
    if (CAMBRIDGE_EXAMS.includes(exam)) {
      if (!cambridge) {
        cambridge = { id: 'cambridge', exams: [] };
        groups.push(cambridge);
      }
      cambridge.exams.push(exam);
    } else {
      groups.push({ id: exam, exams: [exam] });
    }
  }
  return groups;
}

/** The one turn that starts a set (D45): no `form_id`, so it is never read as a form answer. */
export function presetTurn(exam: string, type: ProblemType): SpaceTurnRequest {
  return { message: ENTRY_PHRASE[type], meta: { action_type: FORM_PRESET_ACTION, exam_type: exam } };
}

/**
 * Form kinds that are the practice itself. A set is in progress while the tutor's latest reply still holds
 * one (the first set of questions, or the same editor sent back for a too-short draft); it is submitted and
 * marked once a reply after an answer no longer does (#316 review: decided from the reply, not the submit).
 */
const ANSWER_KINDS = new Set(['objective_set', 'passage', 'writing_draft', 'speaking_answer']);

export function isAnswerForm(kind: string | null | undefined): boolean {
  return Boolean(kind && ANSWER_KINDS.has(kind));
}

/** "CET-4 · 语法 · 11月27日": the set's own name, so history needs no other field. */
export function setName(examLabel: string, typeLabel: string, locale: string, when: Date = new Date()): string {
  let day = '';
  try {
    day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(when);
  } catch {
    day = '';
  }
  return [examLabel, typeLabel, day].filter(Boolean).join(' · ');
}

/**
 * The set in progress (Exam 0.7.2 "One set at a time"). Which set is in progress comes from the server
 * (the Form panel's `findOpenSet`: the newest form set whose last tutor reply still holds an answer form), so it holds across
 * devices. This device also remembers the exam and problem type of a set it started, which a new set needs
 * for its first (preset) turn. Browser storage can be unavailable: then nothing is remembered locally.
 */
export interface CurrentSet {
  spaceId: string;
  /** The set's own name, e.g. 「大学英语四级 · 语法 · 11月27日」. */
  name?: string;
  exam?: string;
  type?: ProblemType;
}

const CURRENT_KEY = 'kazi.examForm.current';

export function readCurrentSet(): CurrentSet | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CurrentSet>;
    if (typeof parsed.spaceId === 'string' && typeof parsed.exam === 'string' && typeof parsed.type === 'string'
        && parsed.type in ENTRY_PHRASE) {
      return {
        spaceId: parsed.spaceId,
        exam: parsed.exam,
        type: parsed.type as ProblemType,
        ...(typeof parsed.name === 'string' ? { name: parsed.name } : {}),
      };
    }
  } catch {
    // storage unavailable or unreadable: nothing remembered
  }
  return null;
}

export function writeCurrentSet(current: CurrentSet): void {
  try {
    window.localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function clearCurrentSet(): void {
  try {
    window.localStorage.removeItem(CURRENT_KEY);
  } catch {
    // ignore
  }
}
