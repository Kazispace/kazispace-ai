import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import CvLegacyRedirectPage from '@/app/[locale]/(workspace)/cv/page';

describe('KAZI-659 legacy /cv redirect page', () => {
  it('redirects to Clinic chat with the CV rail open param, no job id', () => {
    redirectMock.mockReset();
    CvLegacyRedirectPage({ params: { locale: 'en' }, searchParams: {} });

    expect(redirectMock).toHaveBeenCalledWith('/en/chat?open_cv=1');
  });

  it('forwards a job_id query param onto the redirect target', () => {
    redirectMock.mockReset();
    CvLegacyRedirectPage({
      params: { locale: 'ru' },
      searchParams: { job_id: 'job-42' },
    });

    expect(redirectMock).toHaveBeenCalledWith('/ru/chat?open_cv=1&job_id=job-42');
  });

  it('takes the first value when job_id is passed as an array', () => {
    redirectMock.mockReset();
    CvLegacyRedirectPage({
      params: { locale: 'en' },
      searchParams: { job_id: ['job-1', 'job-2'] },
    });

    expect(redirectMock).toHaveBeenCalledWith('/en/chat?open_cv=1&job_id=job-1');
  });
});
