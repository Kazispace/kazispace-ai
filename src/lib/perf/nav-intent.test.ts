import { afterEach, describe, expect, it, vi } from 'vitest';

import { consumeNavIntent, markNavIntent } from '@/lib/perf/nav-intent';

describe('nav-intent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Drain any pending mark so tests do not leak state into each other.
    consumeNavIntent();
  });

  it('records performance.now() at mark time and returns it once', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234);
    markNavIntent();
    expect(consumeNavIntent()).toBe(1234);
  });

  it('clears the mark after consuming it', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    markNavIntent();
    consumeNavIntent();
    expect(consumeNavIntent()).toBeNull();
  });

  it('returns null when nothing was marked', () => {
    expect(consumeNavIntent()).toBeNull();
  });

  it('a later mark overwrites an unconsumed earlier one', () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(1).mockReturnValueOnce(2);
    markNavIntent();
    markNavIntent();
    expect(consumeNavIntent()).toBe(2);
  });
});
