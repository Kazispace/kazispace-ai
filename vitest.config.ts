import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    {
      name: 'yaml-raw',
      load(id) {
        if (!id.endsWith('.yaml') && !id.endsWith('.yml')) return null;
        const source = readFileSync(id, 'utf8');
        return `export default ${JSON.stringify(source)};`;
      },
    },
  ],
});