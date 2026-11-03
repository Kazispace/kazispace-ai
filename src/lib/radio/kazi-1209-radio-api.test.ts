/**
 * KAZI-1209 — how the radio reads the server's answers (kazispace-ui personal-radio.md, Who sees it ·
 * Data) and where its screens sit in navigation (Screens and back · Platform notes).
 */
import { describe, expect, it } from 'vitest';

import { newRadioRequestId, radioAccessOf } from '@/lib/radio/api';
import { isRadioLocale, radioHomeHref, radioProgramHref, radioStoryHref } from '@/lib/radio/routes';
import { isTopLevelScreen, resolveTopLevelDestination } from '@/lib/top-level-nav';

describe('radioAccessOf (Who sees it)', () => {
  it.each([
    [{ success: true, data: {} }, 'open'],
    // The radio's off: `404 {"detail": "Not Found"}`, which apiRequest relabels.
    [{ success: false, status: 404, errorCode: 'REGION_ACCOUNT_NOT_FOUND' }, 'closed'],
    [{ success: false, status: 404 }, 'closed'],
    [{ success: false, status: 403, errorCode: 'radio_not_in_audience' }, 'closed'],
    [{ success: false, status: 403, errorCode: 'radio_pro_required' }, 'closed'],
    // Anything else leaves the status unknown: never drawn as "off".
    [{ success: false, status: 403, errorCode: 'something_else' }, 'unknown'],
    [{ success: false, status: 500 }, 'unknown'],
    [{ success: false, errorCode: 'NETWORK_ERROR' }, 'unknown'],
    [{ success: false, status: 401 }, 'unknown'],
  ] as const)('%j → %s', (res, expected) => {
    expect(radioAccessOf(res)).toBe(expected);
  });
});

describe('request ids', () => {
  it('match the server pattern ^[A-Za-z0-9_-]{8,40}$ and differ per call', () => {
    const a = newRadioRequestId('start');
    const b = newRadioRequestId('start');
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
    expect(a).not.toBe(b);
  });
});

describe('MVP audience: Chinese interface only', () => {
  it.each([
    ['zh', true],
    ['zh-CN', true],
    ['zh_Hans', true],
    ['en', false],
    ['ru', false],
    ['', false],
    [null, false],
  ] as const)('%s → %s', (locale, expected) => {
    expect(isRadioLocale(locale)).toBe(expected);
  });
});

describe('the radio screens are Studio sub-screens', () => {
  it('builds the three addresses', () => {
    expect(radioHomeHref('zh')).toBe('/zh/radio');
    expect(radioStoryHref('zh', 'sv1')).toBe('/zh/radio/story/sv1');
    expect(radioStoryHref('zh', 'sv1', 'studio')).toBe('/zh/radio/story/sv1?from=studio');
    expect(radioProgramHref('zh', 'sotd_20261103')).toBe('/zh/radio/program/sotd_20261103');
  });

  it.each(['/zh/radio', '/zh/radio/story/sv1', '/zh/radio/program/p1'])(
    '%s belongs to Studio and hides the tab bar',
    (path) => {
      expect(resolveTopLevelDestination(path, 'zh')).toBe('studio');
      expect(isTopLevelScreen(path, 'zh')).toBe(false);
    }
  );
});
