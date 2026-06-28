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
        muted: '#6B7A8D',
        border: '#E2E8F0',
        green: '#4CAF50',
        blue: '#2196F3',
        teal: '#26C6DA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
