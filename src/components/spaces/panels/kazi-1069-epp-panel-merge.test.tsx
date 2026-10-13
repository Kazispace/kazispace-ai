/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveSpacePanels } from '@/lib/spaces/panels';
import { useAuthStore } from '@/lib/store';
import type { SpaceDetail } from '@/types/spaces';

// KAZI-1069 — Owen 2026-10-13: 「英语练习」and「能力」are one tab. The ability section sits on
// top of the EPP panel; there is no separate ability panel / surface.

const flags = vi.hoisted(() => ({ epp: true }));
vi.mock('@/lib/constants', async (orig) => ({
  ...(await orig<typeof import('@/lib/constants')>()),
  get EPP_PROFILE_ENABLED() {
    return flags.epp;
  },
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/use-english-profile', () => ({
  // Real hook: a disabled query (EPP flag off) yields no profile.
  useEnglishProfile: () =>
    flags.epp
      ? {
          profile: { profile_status: 'ready', display_level: 'B1' },
          profileStatus: 'ready',
          isProfileLoading: false,
          profileError: null,
          refetchProfile: vi.fn(),
        }
      : {
          profile: null,
          profileStatus: null,
          isProfileLoading: false,
          profileError: null,
          refetchProfile: vi.fn(),
        },
  useEnglishSampleJobs: () => ({ sampleJobs: null }),
}));
vi.mock('@/components/english/epp-passport-home', () => ({
  EppPassportHome: () => <div data-testid="epp-passport" />,
}));
vi.mock('@/components/spaces/panels/english-ability-section', () => ({
  EnglishAbilitySection: ({ spaceId }: { spaceId: string }) => (
    <div data-testid="ability-section" data-space={spaceId} />
  ),
}));

import { IeltsPrepEppPanel } from '@/components/spaces/panels/ielts-prep-epp-panel';

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  flags.epp = true;
  useAuthStore.setState({ isLoggedIn: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  act(() => {
    root.render(<IeltsPrepEppPanel locale="zh" spaceId="sp_1" />);
  });
}

describe('KAZI-1069 — ability lives inside the English practice panel', () => {
  it('IELTS Spaces have one English tab, not two', () => {
    const space = { template_id: 'ielts_prep', config_snapshot: {} } as unknown as SpaceDetail;
    expect(resolveSpacePanels(space).map((p) => p.surface)).toEqual(['english_epp']);
  });

  it('renders the ability section above the EPP passport, for this Space', () => {
    render();
    const ability = container.querySelector('[data-testid="ability-section"]');
    const passport = container.querySelector('[data-testid="epp-passport"]');
    expect(ability?.getAttribute('data-space')).toBe('sp_1');
    expect(passport).not.toBeNull();
    expect(ability!.compareDocumentPosition(passport!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the ability section when the EPP feature flag is off', () => {
    flags.epp = false;
    render();
    expect(container.querySelector('[data-testid="ability-section"]')).not.toBeNull();
    expect(container.textContent).toContain('featureDisabled');
    // ⛔ not also the passport set-up prompt (the flag-off path must not fall into「empty」)
    expect(container.textContent).not.toContain('eppPanelEmptyCta');
    expect(container.querySelector('a')).toBeNull();
  });

  it('logged out: login prompt only, no ability fetch', () => {
    useAuthStore.setState({ isLoggedIn: false });
    render();
    expect(container.querySelector('[data-testid="ability-section"]')).toBeNull();
  });
});
