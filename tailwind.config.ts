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
          orange: '#F47920',
          'orange-dark': '#d96a10',
          navy: '#0D1B2A',
          navy2: '#132237',
        },
        'clinic-bubble': '#F0F2F5',
        'agent-bubble': '#F0FDF4',
        orange: {
          DEFAULT: '#F47920',
          d: '#d96a10',
        },
        navy: {
          DEFAULT: '#0D1B2A',
          2: '#132237',
        },
        'gray-bg': '#F5F7FA',
        text: '#1A2B3C',
        workspace: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          panel: '#1e1e1e',
          header: '#2d2d2d',
          border: '#3e3e42',
          text: '#cccccc',
          muted: '#858585',
          hover: '#2a2d2e',
          active: '#37373d',
          input: '#3c3c3c',
          accent: '#007acc',
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
