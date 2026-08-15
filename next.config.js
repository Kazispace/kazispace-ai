const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone' — removed for Netlify deployment
  // Use `output: 'standalone'` only for Docker/Node.js server deployment
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
