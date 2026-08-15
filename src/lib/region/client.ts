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
  /**
   * Pin to an allowlisted pre-auth host (OtpAttempt.api_base).
   * Never sends JWT. Rejects unknown hosts.
   */
  apiBase?: string;
  /** Force bootstrap host (public directory, health). Never sends JWT. */
  bootstrap?: boolean;
  /**
   * Account-scoped call: require a region session (T9).
   * When false/omitted and no session, falls back to bootstrap without JWT (guest).
   */
  requireSession?: boolean;
};

export class RegionAccountFetchError extends Error {
  readonly code:
    | 'NO_SESSION'
    | 'UNKNOWN_HOME'
    | 'HOST_MISMATCH'
    | 'ABSOLUTE_PATH'
    | 'UNKNOWN_API_BASE';

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
  if (path.startsWith('http://') || path.startsWith('https://')) {
    throw new RegionAccountFetchError(
      'ABSOLUTE_PATH',
      'Absolute API URLs are not allowed — pass a path only'
    );
  }
  const b = normalizeApiBase(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Sole browser API entry for region-aware host selection (KAZI-533).
 *
 * - OTP: `{ phone }` or pinned `{ apiBase }` from OtpAttempt
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
   * JWT is only attached when the request origin matches session.home_api_base.
   * Session token always overwrites any caller Authorization.
   */
  async fetch(path: string, init: RegionFetchOptions = {}): Promise<Response> {
    const {
      phone,
      apiBase,
      bootstrap,
      requireSession,
      headers: initHeaders,
      ...rest
    } = init;

    let base: string;
    let attachToken = false;

    if (bootstrap) {
      base = bootstrapBase();
    } else if (apiBase) {
      const normalized = normalizeApiBase(apiBase);
      if (!isKnownApiBase(normalized)) {
        throw new RegionAccountFetchError(
          'UNKNOWN_API_BASE',
          'Pinned apiBase not in bundled directory'
        );
      }
      base = normalized;
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
    // Caller must never supply Authorization — session is authoritative.
    headers.delete('Authorization');

    if (attachToken) {
      const session = getSession();
      if (!session) {
        throw new RegionAccountFetchError(
          'NO_SESSION',
          'Account API requires a region session'
        );
      }
      // Compare full origin (scheme + host + port), not hostname alone.
      if (originOf(url) !== originOf(session.home_api_base)) {
        clearSession();
        throw new RegionAccountFetchError(
          'HOST_MISMATCH',
          'Refusing to send JWT to a non-home API origin'
        );
      }
      headers.set('Authorization', `Bearer ${session.token}`);
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
