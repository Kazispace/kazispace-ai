import {
  BUNDLED_DIRECTORY,
  bootstrapBase,
  ensureDirectoryLoaded,
  isKnownApiBase,
  resolveHome,
  setAdvertisedApiBasesForTests,
} from './directory';
import { selectLiveApiBase } from './live-host';
import {
  buildSessionFromVerify,
  clearSession,
  getSession,
  setSession,
} from './session';
import type { RegionDirectory, RegionSession, ResolvedHome } from './types';

export type RegionFetchOptions = RequestInit & {
  /**
   * Pre-login OTP / live host selection by phone.
   * Mutually exclusive with authenticated session routing.
   */
  phone?: string;
  /** Force bootstrap host (public directory, health). Never sends JWT. */
  bootstrap?: boolean;
  /**
   * Account-scoped call: require a region session (T9).
   * When false/omitted and no session, falls back to bootstrap without JWT (guest).
   */
  requireSession?: boolean;
};

export class RegionAccountFetchError extends Error {
  readonly code: 'NO_SESSION' | 'UNKNOWN_HOME' | 'HOST_MISMATCH';

  constructor(code: RegionAccountFetchError['code'], message: string) {
    super(message);
    this.name = 'RegionAccountFetchError';
    this.code = code;
  }
}

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/+$/, '');
}

function joinUrl(base: string, path: string): string {
  const b = normalizeApiBase(base);
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Sole browser API entry for region-aware host selection (KAZI-533).
 *
 * - OTP: pass `{ phone }` → `selectLiveApiBase`
 * - Account calls: session.home_api_base + JWT (no cross-host)
 * - Public/health: `{ bootstrap: true }`
 */
export class RegionAwareApiClient {
  loadDirectory(): Promise<RegionDirectory> {
    return ensureDirectoryLoaded().then(() => BUNDLED_DIRECTORY);
  }

  resolveHome(phone: string): ResolvedHome {
    return resolveHome(phone);
  }

  selectLiveApiBase(phone: string): string {
    return selectLiveApiBase(phone);
  }

  getSession(): RegionSession | null {
    return getSession();
  }

  setSession(session: RegionSession): void {
    setSession(session);
  }

  clearSession(): void {
    clearSession();
  }

  /**
   * Low-level fetch. Account-scoped calls without a session throw (T9).
   * JWT is only attached when the request host matches session.home_api_base.
   */
  async fetch(path: string, init: RegionFetchOptions = {}): Promise<Response> {
    const { phone, bootstrap, requireSession, headers: initHeaders, ...rest } =
      init;

    let base: string;
    let attachToken = false;

    if (bootstrap) {
      base = bootstrapBase();
    } else if (phone) {
      base = selectLiveApiBase(phone);
    } else {
      const session = getSession();
      if (session) {
        if (!isKnownApiBase(session.home_api_base)) {
          clearSession();
          throw new RegionAccountFetchError(
            'UNKNOWN_HOME',
            'home_api_base not in bundled directory'
          );
        }
        base = session.home_api_base;
        attachToken = true;
      } else if (requireSession) {
        throw new RegionAccountFetchError(
          'NO_SESSION',
          'Account API requires a region session'
        );
      } else {
        // Guest / anonymous → bootstrap only (no JWT, no cross-cluster guess).
        base = bootstrapBase();
      }
    }

    const url = joinUrl(base, path);
    const headers = new Headers(initHeaders);

    if (attachToken) {
      const session = getSession();
      if (!session) {
        throw new RegionAccountFetchError(
          'NO_SESSION',
          'Account API requires a region session'
        );
      }
      // Never send JWT to a different hostname.
      if (hostnameOf(url) !== hostnameOf(session.home_api_base)) {
        clearSession();
        throw new RegionAccountFetchError(
          'HOST_MISMATCH',
          'Refusing to send JWT to a non-home API host'
        );
      }
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${session.token}`);
      }
    } else {
      // Pre-login / bootstrap / guest: strip any accidental Authorization.
      headers.delete('Authorization');
    }

    return fetch(url, { ...rest, headers });
  }
}

export const regionAwareApiClient = new RegionAwareApiClient();

export {
  BUNDLED_DIRECTORY,
  bootstrapBase,
  buildSessionFromVerify,
  ensureDirectoryLoaded,
  isKnownApiBase,
  resolveHome,
  selectLiveApiBase,
  setAdvertisedApiBasesForTests,
  getSession,
  setSession,
  clearSession,
};
