import { describe, expect, it } from 'vitest';

import {
  buildClinicHubHref,
  isClinicHubPathname,
  isLegacyHubAliasPathname,
  migrateLegacyWorkspaceHubHref,
  parseClinicHubAssetId,
  stripClinicHubAssetParam,
} from '@/lib/hub-entry';

describe('hub-entry', () => {
  it('buildClinicHubHref returns canonical path', () => {
    expect(buildClinicHubHref('zh')).toBe('/zh/clinic/hub');
    expect(buildClinicHubHref('zh', 'wa_av_abc_source_md')).toBe(
      '/zh/clinic/hub?asset=wa_av_abc_source_md'
    );
  });

  it('detects clinic hub pathname', () => {
    expect(isClinicHubPathname('/zh/clinic/hub')).toBe(true);
    expect(isClinicHubPathname('/en/clinic/hub')).toBe(true);
    expect(isClinicHubPathname('/zh/hub')).toBe(false);
    expect(isClinicHubPathname('/zh/workspace')).toBe(false);
    expect(isClinicHubPathname('/zh/chat')).toBe(false);
  });

  it('detects legacy alias pathnames', () => {
    expect(isLegacyHubAliasPathname('/zh/hub')).toBe(true);
    expect(isLegacyHubAliasPathname('/zh/workspace')).toBe(true);
    expect(isLegacyHubAliasPathname('/zh/clinic/hub')).toBe(false);
  });

  it('migrates legacy workspace preview paths', () => {
    expect(
      migrateLegacyWorkspaceHubHref('zh', '/workspace?asset=wa_av_1_source_md')
    ).toBe('/zh/clinic/hub?asset=wa_av_1_source_md');
    expect(migrateLegacyWorkspaceHubHref('zh', '/hub')).toBe('/zh/clinic/hub');
  });

  it('parses and strips asset query param', () => {
    const params = new URLSearchParams('asset=wa_av_1&foo=bar');
    expect(parseClinicHubAssetId(params)).toBe('wa_av_1');
    const stripped = stripClinicHubAssetParam(params);
    expect(stripped.get('asset')).toBeNull();
    expect(stripped.get('foo')).toBe('bar');
  });
});
