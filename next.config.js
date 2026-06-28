const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone' — removed for Netlify deployment
  // Use `output: 'standalone'` only for Docker/Node.js server deployment
};

module.exports = withNextIntl(nextConfig);
