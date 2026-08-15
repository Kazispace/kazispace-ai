import {
  allowNotReadyLiveHost,
  bootstrapBase,
  getAdvertisedApiBases,
  resolveHome,
} from './directory';

/**
 * Host used for OTP request/verify (pre-login).
 *
 * Production +86 while CN is not advertised → bootstrap intl (login stays up).
 * After ops advertises CN → api-cn with zero FE code change.
 * Staging may set NEXT_PUBLIC_REGION_ALLOW_NOT_READY=1 to hit not_ready CN.
 */
export function selectLiveApiBase(phone: string): string {
  const home = resolveHome(phone);
  const advertised = getAdvertisedApiBases();

  if (advertised.has(home.api_base)) {
    return home.api_base;
  }

  if (allowNotReadyLiveHost()) {
    return home.api_base;
  }

  return bootstrapBase();
}
