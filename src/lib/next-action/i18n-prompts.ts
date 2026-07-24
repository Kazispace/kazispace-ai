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

type InSpacePromptsMap = Partial<Record<InSpaceChatPromptType, string>>;

type InSpacePromptsLocale = { chat: { inSpacePrompts?: InSpacePromptsMap } };

const MESSAGES: Record<SupportedLocale, InSpacePromptsLocale> = {
  en,
  ru,
  kk,
  uz,
  zh,
};

function readPrompt(locale: SupportedLocale, type: InSpaceChatPromptType): string | undefined {
  const fromLocale = MESSAGES[locale].chat.inSpacePrompts?.[type];
  if (fromLocale?.trim()) return fromLocale.trim();
  return MESSAGES.en.chat.inSpacePrompts?.[type]?.trim();
}

export function resolveInSpaceChatPrompt(
  locale: string,
  type: InSpaceChatPromptType
): string | null {
  const loc = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return readPrompt(loc, type) ?? null;
}
