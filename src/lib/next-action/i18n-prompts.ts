import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '@/lib/constants';
import en from '@/lib/i18n/en.json';
import kk from '@/lib/i18n/kk.json';
import ru from '@/lib/i18n/ru.json';
import uz from '@/lib/i18n/uz.json';
import zh from '@/lib/i18n/zh.json';

/** next_action types that send an in-thread NL prompt (KAZI-321). */
export type InSpaceChatPromptType =
  | 'mock_interview'
  | 'cv_builder'
  | 'edit_cv'
  | 'english_tutor'
  | 'job_search';

const MESSAGES: Record<SupportedLocale, typeof en> = {
  en,
  ru,
  kk,
  uz,
  zh,
};

type ChatMessages = (typeof en)['chat'] & {
  inSpacePrompts?: Partial<Record<InSpaceChatPromptType, string>>;
};

function readPrompt(locale: SupportedLocale, type: InSpaceChatPromptType): string | undefined {
  const fromLocale = (MESSAGES[locale].chat as ChatMessages).inSpacePrompts?.[type];
  if (fromLocale?.trim()) return fromLocale.trim();
  return (MESSAGES.en.chat as ChatMessages).inSpacePrompts?.[type]?.trim();
}

export function resolveInSpaceChatPrompt(
  locale: string,
  type: InSpaceChatPromptType
): string | null {
  const loc = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return readPrompt(loc, type) ?? null;
}
