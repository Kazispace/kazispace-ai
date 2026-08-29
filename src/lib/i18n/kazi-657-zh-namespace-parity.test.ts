import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import en from '@/lib/i18n/en.json';
import zh from '@/lib/i18n/zh.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  let out: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out = out.concat(flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      out.push(fullKey);
    }
  }
  return out;
}

function placeholders(value: unknown): string {
  if (typeof value !== 'string') return '';
  return (value.match(/\{[^}]+\}/g) ?? []).sort().join(',');
}

function getPath(obj: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

describe('KAZI-657 zh.json namespace parity', () => {
  it('has every top-level namespace en.json has', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('has full deep-key coverage for the namespaces this ticket added', () => {
    const addedNamespaces = [
      'billing',
      'ledger',
      'jobs',
      'referral',
      'paywall',
      'subscription',
      'credits',
      'nba',
      'workflow',
      'tma',
    ];
    for (const ns of addedNamespaces) {
      const enKeys = flattenKeys({ [ns]: (en as Record<string, unknown>)[ns] });
      const zhKeys = new Set(flattenKeys({ [ns]: (zh as Record<string, unknown>)[ns] }));
      const missing = enKeys.filter((k) => !zhKeys.has(k));
      expect(missing, `${ns} missing keys`).toEqual([]);
    }
  });

  it('keeps ICU placeholders identical between en and zh for the added namespaces', () => {
    const addedNamespaces = [
      'billing',
      'ledger',
      'jobs',
      'referral',
      'paywall',
      'subscription',
      'credits',
      'nba',
      'workflow',
      'tma',
    ];
    for (const ns of addedNamespaces) {
      const enKeys = flattenKeys({ [ns]: (en as Record<string, unknown>)[ns] });
      for (const key of enKeys) {
        const enVal = getPath(en as Record<string, unknown>, key);
        const zhVal = getPath(zh as Record<string, unknown>, key);
        expect(placeholders(zhVal), key).toBe(placeholders(enVal));
      }
    }
  });

  it('is wired into the CI test chain as a hard gate for zh', () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
    );
    expect(pkg.scripts.test).toMatch(/check-i18n-namespace-parity\.mjs/);
  });
});
