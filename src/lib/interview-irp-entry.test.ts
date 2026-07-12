import { describe, expect, it } from 'vitest';

import { resolveInterviewEntry } from '@/lib/interview-irp-entry';

describe('resolveInterviewEntry', () => {
  it('routes job_id to job_prep', () => {
    expect(resolveInterviewEntry({ jobId: 'job-1' })).toBe('job_prep');
  });

  it('routes cold open to training chat intake', () => {
    expect(resolveInterviewEntry({ jobId: null })).toBe('training');
    expect(resolveInterviewEntry({})).toBe('training');
  });
});
