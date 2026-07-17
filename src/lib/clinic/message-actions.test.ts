import { describe, expect, it } from 'vitest';

import {
  downloadMessageAsMarkdown,
  formatQuotedMessage,
} from '@/lib/clinic/message-actions';

describe('formatQuotedMessage', () => {
  it('prefixes each line with >', () => {
    expect(formatQuotedMessage('a\nb')).toBe('> a\n> b\n\n');
  });

  it('does not double-prefix already quoted lines', () => {
    expect(formatQuotedMessage('> already\nplain')).toBe('> already\n> plain\n\n');
  });

  it('returns empty for blank', () => {
    expect(formatQuotedMessage('  \n')).toBe('');
  });
});

describe('downloadMessageAsMarkdown', () => {
  it('returns false for empty content', () => {
    expect(downloadMessageAsMarkdown('')).toBe(false);
  });
});
