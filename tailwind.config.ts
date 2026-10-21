import type { Config } from 'tailwindcss';
import tokens from './src/design-tokens/tokens.resolved.json';

/**
 * KAZI-1086: colour values come from the shared design tokens
 * (kazispace-ui `tokens/build/tokens.resolved.json`, copied into
 * `src/design-tokens/`), not hand-typed hex. Values are resolved hex, so
 * Tailwind opacity modifiers (`bg-primary/10`) keep working.
 * `src/design-tokens/tokens.test.ts` fails if a mapped token is missing.
 */
const t = (path: keyof typeof tokens): string => (tokens[path] as { value: string }).value;

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        /**
         * Primary/CTA color: the UX guide's blue (SSOT:
         * docs/ux/clinic-specialist-ux-guide-v1.0.md §6.1 in the design
         * repo) — a prior orange here read as too promo/e-commerce for the
         * product. `kazi.brand-accent` preserves the literal orange for the
         * few Header/Hero wordmark spots the guide's compromise keeps
         * branded (navy background + orange "Kazi" mark).
         *
         * KAZI-656: this used to also carry a `kazi.orange`/flat `orange`
         * pair of legacy token paths pointing at the same blue, kept only
         * so ~100 call sites didn't need a mechanical rename in the same
         * change that flipped the color. That rename is done — every call
         * site now reaches for `primary`/`kazi-navy` directly — so those
         * duplicate paths are removed.
         */
        primary: {
          DEFAULT: t('color.action.primary'),
          dark: t('color.action.primary-pressed'),
        },
        kazi: {
          navy: t('color.brand.navy'),
          navy2: t('color.navy.800'),
          'brand-accent': t('color.brand.accent'),
        },
        /** Mobile tab bar (kazispace-ui decisions D24): navy, so it never reads as the screen above. */
        'tab-bar': {
          bg: t('color.bg.inverse'),
          item: t('color.text.inverse-secondary'),
          'item-active': t('color.text.inverse'),
        },
        'clinic-bubble': t('color.chat.assistant-bg'),
        'agent-bubble': t('color.chat.specialist-bg'),
        /** User-sent message (Clinic) — cool tint, aligns with UX blue user bubble guidance */
        'user-bubble': t('color.chat.user-bg'),
        'user-bubble-border': t('color.chat.user-border'),
        /**
         * KAZI-662: resolved the "gray-bg vs. #F7F8FA" question left open
         * since KAZI-656/657 — they were never actually competing for the
         * same job. Every real #F7F8FA call site was either a `:hover`
         * background (mapped to `workspace.hover`, the token that already
         * exists for exactly that) or a passive resting surface (mapped to
         * `workspace.bg`). `gray-bg` keeps its own established, actively-used
         * role (Clinic/Space/Hub page backgrounds) — neither value needed to
         * "win," the bare #F7F8FA literal just needed to go.
         */
        // Not in the shared tokens (tokens v0 consolidates to one page grey,
        // color.bg.page). Kept as-is until the pages that use it are redone.
        'gray-bg': '#F5F7FA',
        text: '#1A2B3C',
        workspace: {
          bg: t('color.bg.page'),
          sidebar: t('color.bg.surface'),
          panel: t('color.bg.surface'),
          header: t('color.bg.header'),
          border: t('color.border.default'),
          text: t('color.text.primary'),
          /**
           * Secondary body text — between `text` and `muted`. Promoted from a
           * raw `#4E5969` literal reused identically across 14 files (KAZI-656).
           * KAZI-662: formally adopted (Owen sign-off) as a real type-hierarchy
           * tier, not a drift artifact — synced to kazispace-design's SDD
           * (`docs/sdd/kazispace-web-app-v1.0.md` §12.2.1), NOT the UX guide's
           * §6.1 (that section is Clinic chat-bubble-scoped and still lists an
           * unrelated `#6B7280`/`#111827` text-color pair for that surface —
           * §12.2.1 is the SSOT for `workspace.*` chrome specifically).
           */
          secondary: t('color.text.secondary'),
          muted: t('color.text.muted'),
          /**
           * Disabled/placeholder/empty-state foreground — lighter than `muted`,
           * used for de-emphasized text and icons (form placeholders, disabled
           * buttons, "no results" hints). Promoted from a raw `#C9CDD4` literal
           * reused identically across 8 call sites in 4 files (KAZI-662, same
           * high-frequency-reuse justification as `secondary` above) — synced
           * to kazispace-design's SDD §12.2.1 (see `secondary` above for why
           * that's §12.2.1 and not the UX guide's §6.1).
           */
          placeholder: t('color.text.placeholder'),
          hover: t('color.bg.hover'),
          active: t('color.bg.selected'),
          input: t('color.bg.surface'),
          accent: t('color.action.primary'),
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        bubble: '18px',
        pill: '24px',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.22s ease-out',
        'bounce-dot': 'bounce-dot 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
