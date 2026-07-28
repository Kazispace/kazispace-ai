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
        kazi: {
          // UI v1.0: slightly desaturated ochre-orange (less promo/e-commerce feel)
          orange: '#D96E28',
          'orange-dark': '#B85A1F',
          navy: '#0D1B2A',
          navy2: '#132237',
        },
        'clinic-bubble': '#F0F2F5',
        'agent-bubble': '#F0FDF4',
        /** User-sent message fill (Clinic) — tint only, not saturated brand orange */
        'user-bubble': '#FFF7F0',
        orange: {
          DEFAULT: '#D96E28',
          d: '#B85A1F',
        },
        navy: {
          DEFAULT: '#0D1B2A',
          2: '#132237',
        },
        'gray-bg': '#F5F7FA',
        text: '#1A2B3C',
        workspace: {
          bg: '#F4F5F7',
          sidebar: '#FFFFFF',
          panel: '#FFFFFF',
          header: '#FAFBFC',
          border: '#E5E6EB',
          text: '#1D2129',
          muted: '#86909C',
          hover: '#F2F3F5',
          active: '#FFF4EC',
          input: '#FFFFFF',
          accent: '#D96E28',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
