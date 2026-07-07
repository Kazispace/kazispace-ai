export type CompleteProfileRouteOptions = {
  /** After save, return to CV Builder (chat / CV gate flows). */
  returnToCv?: boolean;
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
  return base;
}
