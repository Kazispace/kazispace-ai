/**
 * @vitest-environment jsdom
 *
 * KAZI-1171 — Studio「英语护照」: the passport card when the user has one, the ability from
 * practice (read-only), and one link to the English Space. ⛔ No link to `/english`.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  profile: null as null | { display_level: number },
  status: 'empty' as string,
  abilityProps: [] as Array<{ spaceId?: string }>,
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/constants', async (orig) => ({
  ...(await orig<typeof import('@/lib/constants')>()),
  EPP_PROFILE_ENABLED: true,
}));
vi.mock('@/hooks/use-english-profile', () => ({
  useEnglishProfile: () => ({ profile: state.profile, profileStatus: state.status }),
}));
vi.mock('@/components/english/epp-passport-home', () => ({
  EppPassportHome: ({ profile }: { profile: { display_level: number } }) => (
    <div data-testid="passport-card">L{profile.display_level}</div>
  ),
}));
vi.mock('@/components/spaces/panels/english-ability-section', () => ({
  EnglishAbilitySection: (props: { spaceId?: string }) => {
    state.abilityProps.push(props);
    return <div data-testid="ability" />;
  },
}));

import { StudioPassport } from '@/components/workspace/studio-passport';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  state.profile = null;
  state.status = 'empty';
  state.abilityProps = [];
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (authenticated = true) =>
  act(() => root.render(<StudioPassport locale="zh" authenticated={authenticated} />));

describe('Studio passport', () => {
  it('shows the passport card and the read-only ability when the user has a passport', () => {
    state.profile = { display_level: 3 };
    state.status = 'ready';
    render();
    expect(container.querySelector('[data-testid="passport-card"]')?.textContent).toBe('L3');
    expect(container.querySelector('[data-testid="ability"]')).not.toBeNull();
    // Read-only: no Space to send 「练这个」 into.
    expect(state.abilityProps.at(-1)?.spaceId).toBeUndefined();
    expect(container.textContent).not.toContain('studio.passport.empty');
  });

  it('says there is no level yet when the user has none', () => {
    render();
    expect(container.querySelector('[data-testid="passport-card"]')).toBeNull();
    expect(container.textContent).toContain('studio.passport.empty');
  });

  it('links the English Space, never /english', () => {
    vi.stubEnv('NEXT_PUBLIC_SPACES_ENABLED', 'true');
    render();
    vi.unstubAllEnvs();
    const link = container.querySelector('[data-testid="studio-passport-open-space"]');
    expect(link?.getAttribute('href')).toBe('/zh/spaces?template=ielts_prep');
    expect(container.innerHTML).not.toMatch(/\/english\b/);
  });

  it('does not ask for the ability signed out', () => {
    render(false);
    expect(container.querySelector('[data-testid="ability"]')).toBeNull();
  });
});
