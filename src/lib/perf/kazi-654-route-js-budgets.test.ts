import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import routeJsBudgets from '@/lib/perf/route-js-budgets.json';

describe('KAZI-654 per-route JS budget gate', () => {
  it('defines a budget for each of the four target routes', () => {
    expect(Object.keys(routeJsBudgets.routes).sort()).toEqual(
      ['cv', 'english', 'interview', 'space'].sort()
    );
    for (const [name, budget] of Object.entries(routeJsBudgets.routes)) {
      expect(budget.page_key, name).toMatch(/^\/\[locale\]\/\(workspace\)\//);
      expect(budget.first_js_decoded_bytes, name).toBeGreaterThan(0);
      // Budgets must be traceable to a real measured build, not guessed.
      expect(budget.measured_decoded_bytes, name).toBeGreaterThan(0);
      expect(budget.first_js_decoded_bytes, name).toBeGreaterThan(
        budget.measured_decoded_bytes
      );
    }
    expect(routeJsBudgets.unit).toBe('decoded_bytes');
  });

  it('is wired into the hard build gate and the optional test/CI gate', () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
    );
    expect(pkg.scripts.build).toMatch(/check-route-js-budgets\.mjs/);
    expect(pkg.scripts.build).not.toMatch(/check-route-js-budgets\.mjs --optional/);
    expect(pkg.scripts.test).toMatch(/check-route-js-budgets\.mjs --optional/);
  });

  it('scopes each route to its own app-build-manifest page key', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../../scripts/check-route-js-budgets.mjs'),
      'utf8'
    );
    expect(src).toMatch(/route-js-budgets\.json/);
    expect(src).toMatch(/manifest\.pages\?\.\[pageKey\]/);
  });
});
