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

/**
 * Problem types listed under each exam (design SDD «考试 · 表单模式» §3). Reading is Gaokao only;
 * speaking only where the bank has speaking tasks. Which exams appear at all is the server's
 * `english_exams` (only exams it has questions for), so this table never adds an exam.
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

export function problemTypesFor(exam: string): readonly ProblemType[] {
  return PROBLEM_TYPES[exam] ?? ['grammar', 'vocabulary', 'writing'];
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

/** Form kinds that are the practice itself: submitting one finishes the set. */
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
 * The set in progress on this device (Exam 0.7.2 "One set at a time"): the list stays locked until it is
 * submitted or dropped, also after leaving the screen. Browser storage can be unavailable: then nothing
 * is remembered and the page still works.
 */
export interface CurrentSet {
  spaceId: string;
  exam: string;
  type: ProblemType;
}

const CURRENT_KEY = 'kazi.examForm.current';

export function readCurrentSet(): CurrentSet | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CurrentSet>;
    if (typeof parsed.spaceId === 'string' && typeof parsed.exam === 'string' && typeof parsed.type === 'string'
        && parsed.type in ENTRY_PHRASE) {
      return { spaceId: parsed.spaceId, exam: parsed.exam, type: parsed.type as ProblemType };
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
