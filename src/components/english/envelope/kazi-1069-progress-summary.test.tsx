/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { EnglishTutorEnvelopeBlocks } from '@/components/english/envelope/english-tutor-envelope-blocks';
import en from '@/lib/i18n/en.json';
import zh from '@/lib/i18n/zh.json';
import { mergeMessages } from '@/lib/i18n/merge-messages';
import type { EnglishTutorEnvelopeComponent } from '@/types/english-tutor-envelope';

const messages = mergeMessages(en, zh) as AbstractIntlMessages;

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(component: EnglishTutorEnvelopeComponent) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="zh" messages={messages} timeZone="UTC">
        <EnglishTutorEnvelopeBlocks locale="zh" components={[component]} />
      </NextIntlClientProvider>
    );
  });
  return container.textContent ?? '';
}

// Chat-bubble `progress_summary` (Capability §5.4) — same window semantics as the panel.
describe('KAZI-1069 chat progress_summary (#230 review ⚪① · M8)', () => {
  it('signs a falling window from the value, never "+-"', () => {
    const text = render({
      type: 'progress_summary',
      trend: 'declining',
      window: { n: 5, from: 4.5, to: 3.67, delta: -0.83 },
    } as EnglishTutorEnvelopeComponent);
    expect(text).toContain('前期均值 4.5 → 近期均值 3.67（−0.83）');
    expect(text).not.toContain('+-');
    expect(text).toContain('下降');
  });

  it('a rising window keeps its plus sign', () => {
    const text = render({
      type: 'progress_summary',
      trend: 'improving',
      window: { n: 5, from: 3.33, to: 3.89, delta: 0.56 },
    } as EnglishTutorEnvelopeComponent);
    expect(text).toContain('（+0.56）');
  });

  it('an unknown trend value shows the raw value, not a key path', () => {
    const text = render({
      type: 'progress_summary',
      trend: 'plateau',
    } as EnglishTutorEnvelopeComponent);
    expect(text).toContain('plateau');
    expect(text).not.toMatch(/english\.envelope\./);
  });
});
