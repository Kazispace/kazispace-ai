export type CompleteProfileRouteOptions = {
  /** After save, return to CV Builder (chat / CV gate flows). */
  returnToCv?: boolean;
  /**
   * Opened from a reply in Chat: back returns to Chat, not Me (kazispace-ui page
   * header spec, "Back target"). Ignored when `returnToCv` is set.
   */
  returnToChat?: boolean;
};

/** Single entry for all `complete_profile` navigations (KAZI-72). */
export function getCompleteProfileHref(
  locale: string,
  options?: CompleteProfileRouteOptions
): string {
  const base = `/${locale}/profile`;
  if (options?.returnToCv) {
    return `${base}?return=cv`;
  }
  if (options?.returnToChat) {
    return `${base}?return=chat`;
  }
  return base;
}
