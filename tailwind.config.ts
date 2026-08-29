import type { Config } from 'tailwindcss';

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
          DEFAULT: '#2563EB',
          dark: '#1D4ED8',
        },
        kazi: {
          navy: '#0D1B2A',
          navy2: '#132237',
          'brand-accent': '#D96E28',
        },
        'clinic-bubble': '#F0F2F5',
        'agent-bubble': '#F0FDF4',
        /** User-sent message (Clinic) — cool tint, aligns with UX blue user bubble guidance */
        'user-bubble': '#E6F0FF',
        'user-bubble-border': '#C5DBF7',
        'gray-bg': '#F5F7FA',
        text: '#1A2B3C',
        workspace: {
          bg: '#F4F5F7',
          sidebar: '#FFFFFF',
          panel: '#FFFFFF',
          header: '#FAFBFC',
          border: '#E5E6EB',
          text: '#1D2129',
          /** Secondary body text — between `text` and `muted`. Promoted from a
           * raw `#4E5969` literal reused identically across 14 files (KAZI-656). */
          secondary: '#4E5969',
          muted: '#86909C',
          hover: '#F2F3F5',
          active: '#EFF6FF',
          input: '#FFFFFF',
          accent: '#2563EB',
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
