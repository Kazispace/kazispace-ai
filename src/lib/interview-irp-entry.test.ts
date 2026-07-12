import { describe, expect, it } from 'vitest';

import { hasFormalIrp, resolveInterviewEntry } from '@/lib/interview-irp-entry';

describe('resolveInterviewEntry', () => {
  it('routes job_id to job_prep', () => {
    expect(resolveInterviewEntry({ jobId: 'job-1' })).toBe('job_prep');
  });

  it('routes cold open to training chat intake', () => {
    expect(resolveInterviewEntry({ jobId: null })).toBe('training');
    expect(resolveInterviewEntry({})).toBe('training');
  });
});

describe('hasFormalIrp', () => {
  it('detects formal profile status', () => {
    expect(hasFormalIrp('formal')).toBe(true);
    expect(hasFormalIrp('provisional')).toBe(false);
  });
});
