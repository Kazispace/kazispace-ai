/**
 * A page whose script files fail to download (a dropped request on a weak connection, or
 * files replaced by a new deploy) cannot recover by re-rendering: the error screen's
 * "Retry" asks for the same missing file. Reloading the page fetches it again, so the
 * error screens reload once by themselves before showing the error.
 *
 * Guarded per path: if the same path already reloaded within RELOAD_WINDOW_MS, the error
 * screen is shown instead, so a file that is really missing never causes a reload loop.
 */
export const CHUNK_RELOAD_KEY = 'kazi_chunk_reload';
export const RELOAD_WINDOW_MS = 30_000;

const CHUNK_ERROR =
  /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return name === 'ChunkLoadError' || (typeof message === 'string' && CHUNK_ERROR.test(message));
}

interface ReloadEnv {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  path: string;
  now: number;
}

function browserEnv(): ReloadEnv | null {
  if (typeof window === 'undefined') return null;
  try {
    return { storage: window.sessionStorage, path: window.location.pathname, now: Date.now() };
  } catch {
    return null;
  }
}

/** True when this error should reload the page now (and not show the error screen). */
export function shouldReloadForChunkError(error: unknown, env: ReloadEnv | null = browserEnv()): boolean {
  if (!env || !isChunkLoadError(error)) return false;
  try {
    const prev = JSON.parse(env.storage.getItem(CHUNK_RELOAD_KEY) ?? 'null') as
      | { path?: string; at?: number }
      | null;
    if (prev && prev.path === env.path && typeof prev.at === 'number' && env.now - prev.at < RELOAD_WINDOW_MS) {
      return false;
    }
    return true;
  } catch {
    // Without storage the loop guard cannot work: show the error screen instead.
    return false;
  }
}

/** Records the reload for the guard, then reloads. Call only after shouldReloadForChunkError. */
export function reloadForChunkError(
  env: ReloadEnv | null = browserEnv(),
  reload: () => void = () => window.location.reload()
): void {
  if (!env) return;
  try {
    env.storage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({ path: env.path, at: env.now }));
  } catch {
    return;
  }
  reload();
}

/**
 * The same guard for a script that fails before the app starts: a page whose startup
 * script fails never runs React, so no error screen can catch it and the page stays on
 * its server-rendered loading state. This runs inline in <head>, before those scripts,
 * and reloads once (same key, same window) when a /_next/static script fails to load.
 */
export const CHUNK_RELOAD_INLINE_SCRIPT = `(function(){var K=${JSON.stringify(CHUNK_RELOAD_KEY)},W=${RELOAD_WINDOW_MS};function go(){try{var s=window.sessionStorage,p=location.pathname,n=Date.now(),v=JSON.parse(s.getItem(K)||"null");if(v&&v.path===p&&n-v.at<W)return;s.setItem(K,JSON.stringify({path:p,at:n}));location.reload()}catch(e){}}window.addEventListener("error",function(e){var t=e&&e.target;if(t&&t.tagName==="SCRIPT"&&/\\/_next\\/static\\//.test(t.src||""))go()},true)})();`;
