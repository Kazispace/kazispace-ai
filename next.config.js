const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify stays on default output. CN/Docker (KAZI-1120 SAE) sets
  // DOCKER_BUILD=1 or NEXT_OUTPUT=standalone at build time.
  ...(process.env.DOCKER_BUILD === '1' || process.env.NEXT_OUTPUT === 'standalone'
    ? { output: 'standalone' }
    : {}),
  webpack: (config) => {
    // KAZI-533: import bundled region directory YAML as raw source string.
    config.module.rules.push({
      test: /\.ya?ml$/,
      type: 'asset/source',
    });
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
