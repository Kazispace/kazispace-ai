import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import {
  CV_UPLOAD_PROXY_MAX_BYTES,
  resolveUploadTargets,
} from '@/lib/cv-input-api';
import { clearSession, setSession } from '@/lib/region';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('window', {
    localStorage,
    location: { pathname: '/en' },
  });
}

function fakeFile(size: number): File {
  const blob = new Blob([new Uint8Array(size)]);
  return new File([blob], 'resume.pdf', { type: 'application/pdf' });
}

describe('CV upload targets (P1-1)', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    clearSession();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it('logged-in ≤5MB upload is direct-only (no BFF proxy)', () => {
    setSession({
      token: 'tok',
      home_api_base: 'https://bot.kazispace.ai',
      data_region: 'global',
      directory_version: 4,
    });
    const small = fakeFile(1024);
    expect(small.size).toBeLessThan(CV_UPLOAD_PROXY_MAX_BYTES);
    expect(resolveUploadTargets(small)).toEqual(['direct']);
  });

  it('guest small file may use proxy then direct', () => {
    const small = fakeFile(1024);
    expect(resolveUploadTargets(small)).toEqual(['proxy', 'direct']);
  });
});

describe('CV upload proxy route (P1-2)', () => {
  it('never forwards Authorization or client-claimed home host', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../app/api/cv/upload/route.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/request\.headers\.get\(\s*['"]authorization['"]/i);
    expect(src).not.toMatch(/['"]x-kazi-home-api-base['"]/i);
    expect(src).toContain('bootstrapBase()');
  });
});
