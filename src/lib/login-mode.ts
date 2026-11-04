/**
 * Which button opened the sign-in screen (kazispace-ui Homepage 0.4): the homepage's
 * "Sign up" links add mode=signup. Read from the page's searchParams on the server, so
 * the first paint already has the right title.
 */
export type LoginMode = 'signup' | 'login';

export function loginModeFromSearchParams(searchParams?: { mode?: string | string[] }): LoginMode {
  const m = searchParams?.mode;
  return (Array.isArray(m) ? m[0] : m) === 'signup' ? 'signup' : 'login';
}
