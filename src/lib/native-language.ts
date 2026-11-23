/**
 * The profile's native language (kazispace-ui personal-radio.md, "Story list by native language").
 *
 * A closed set, read and written as `native_language` on `/me`; `null` is Not set (the default, never
 * guessed). The radio's server uses it to order story and program lists; the app only shows and sets it.
 * The same seven-item list, in the same order, is used on Me's Profile and in radio settings.
 */
export const NATIVE_LANGUAGES = ['zh', 'ru', 'kk', 'uz', 'en', 'other'] as const;

export type NativeLanguage = (typeof NATIVE_LANGUAGES)[number];

export function isNativeLanguage(value: unknown): value is NativeLanguage {
  return typeof value === 'string' && (NATIVE_LANGUAGES as readonly string[]).includes(value);
}

/** The API value as the app keeps it: a known language, else `null` (Not set). */
export function nativeLanguageFromApi(value: unknown): NativeLanguage | null {
  return isNativeLanguage(value) ? value : null;
}

/** Form value for Not set. Kept as an empty string so it works as a `<select>` / radio value. */
export const NATIVE_LANGUAGE_UNSET = '';

export type NativeLanguageChoice = NativeLanguage | typeof NATIVE_LANGUAGE_UNSET;

/**
 * The seven items in spec order: the six languages, then Not set. `t` is the `profile` namespace.
 */
export function nativeLanguageOptions(
  t: (key: string) => string
): { value: NativeLanguageChoice; label: string }[] {
  return [
    ...NATIVE_LANGUAGES.map((lang) => ({ value: lang, label: t(`nativeLanguageOptions.${lang}`) })),
    { value: NATIVE_LANGUAGE_UNSET, label: t('nativeLanguageUnset') },
  ];
}

/** What `PATCH /me` sends for a choice: Not set is `null`, which clears the setting. */
export function nativeLanguageToApi(choice: string): NativeLanguage | null {
  return isNativeLanguage(choice) ? choice : null;
}
