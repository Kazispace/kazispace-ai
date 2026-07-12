import { describe, expect, it } from 'vitest';

import {
  englishProfileRedirectTarget,
  englishWorkspaceShowsOnboarding,
} from '@/lib/english-profile-routes';

describe('englishProfileRedirectTarget', () => {
  it('passport sends empty profile to onboarding', () => {
    expect(
      englishProfileRedirectTarget({
        page: 'passport',
        isProfileLoading: false,
        profileStatus: 'empty',
        hasProfile: false,
      })
    ).toBe('onboarding');
  });

  it('passport stays on error without profile', () => {
    expect(
      englishProfileRedirectTarget({
        page: 'passport',
        isProfileLoading: false,
        profileError: 'network',
        profileStatus: null,
        hasProfile: false,
      })
    ).toBeNull();
  });

  it('onboarding sends ready profile to passport', () => {
    expect(
      englishProfileRedirectTarget({
        page: 'onboarding',
        isProfileLoading: false,
        profileStatus: 'ready',
        hasProfile: true,
      })
    ).toBe('passport');
  });

  it('onboarding stays while loading', () => {
    expect(
      englishProfileRedirectTarget({
        page: 'onboarding',
        isProfileLoading: true,
        profileStatus: 'ready',
        hasProfile: true,
      })
    ).toBeNull();
  });
});

describe('englishWorkspaceShowsOnboarding', () => {
  it('shows link for empty profile', () => {
    expect(
      englishWorkspaceShowsOnboarding({ isProfileLoading: false, profileStatus: 'empty' })
    ).toBe(true);
  });

  it('hides link for ready profile', () => {
    expect(
      englishWorkspaceShowsOnboarding({ isProfileLoading: false, profileStatus: 'ready' })
    ).toBe(false);
  });
});
