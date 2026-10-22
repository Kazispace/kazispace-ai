/**
 * @vitest-environment jsdom
 *
 * KAZI-1145 review #259 · `cv_upload` posts to `/api/v1/inputs`, which only
 * reaches the Clinic CV session and writes no message to a user-created
 * space ⇒ a space row never renders it; the Clinic bubble still does.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
  useLocale: () => 'en',
}));

import { MessageBubble } from '@/components/clinic/message-bubble';
import { SpaceMessageRow } from '@/components/spaces/space-message-row';
import { CV_PASTE_META, CV_UPLOAD_META } from '@/lib/__fixtures__/kazi-1145-cv-forms';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

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

function reply(meta: Record<string, unknown>): SpaceChatMessage {
  return {
    id: 'assistant_1',
    role: 'assistant',
    content: 'Upload your resume.',
    assistantMeta: meta,
    streamComplete: true,
  } as SpaceChatMessage;
}

function spaceRow(meta: Record<string, unknown>) {
  const noop = () => undefined;
  act(() =>
    root.render(
      <SpaceMessageRow
        message={reply(meta)}
        strategy={{ latestTurn: true }}
        locale="en"
        actionsDisabled={false}
        onRetryById={noop}
        onNextAction={noop}
        onFocusComposer={noop}
        onExamSelect={noop}
        onEtFormSubmit={vi.fn()}
        onJobCardClick={noop}
      />
    )
  );
}

describe('cv_upload by surface', () => {
  it('space row: no upload form, the reply text still reads', () => {
    spaceRow(CV_UPLOAD_META);
    expect(container.textContent).toContain('Upload your resume.');
    expect(container.querySelector('[data-cv-form]')).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('space row: other CV forms still render', () => {
    spaceRow(CV_PASTE_META);
    expect(container.querySelector('[data-cv-form="cv_paste"]')).not.toBeNull();
  });

  it('Clinic bubble (default): the upload form renders', () => {
    act(() =>
      root.render(
        <MessageBubble
          role="assistant"
          content="Upload your resume."
          assistantMeta={CV_UPLOAD_META}
          locale="en"
          streamComplete
          etFormActive
          onEtFormSubmit={vi.fn()}
        />
      )
    );
    expect(container.querySelector('[data-cv-form="cv_upload"]')).not.toBeNull();
  });
});
