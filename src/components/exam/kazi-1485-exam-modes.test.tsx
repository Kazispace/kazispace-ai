/**
 * @vitest-environment jsdom
 *
 * KAZI-1485 (Owen 2026-11-26, kazispace-ui D36, D38, Exam 0.2): Exam's Chat / Form switch. Chat
 * is the spaces (the shell's space list and each space's conversation; the shell tests cover
 * where the switch sits); Form is not built yet. Chat first, then the mode used last. Studio's
 * Get started text goes to the `exam` target, which only the English Space on screen takes,
 * and brings Exam back to Chat. The English Space has no panel row of its own (D38).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'en',
}));
const composerProps = vi.hoisted(() => ({ last: {} as Record<string, unknown> }));
vi.mock('@/components/chat/voice-enabled-chat-input', () => ({
  VoiceEnabledChatInput: (props: Record<string, unknown>) => {
    composerProps.last = props;
    return null;
  },
}));
vi.mock('@/components/spaces/starter-prompts-bar', () => ({
  useStarterPromptsController: () => null,
  StarterCapabilityToolbar: () => null,
  StarterExampleStrip: () => null,
}));
vi.mock('@/components/spaces/space-chat-pane', () => ({
  SpaceChatPane: () => <div data-testid="space-chat-pane">chat</div>,
}));

import { ChatInput } from '@/components/chat/chat-input';
import { SpaceComposerWithStarter } from '@/components/spaces/space-composer-with-starter';
import { IeltsPrepWorkspace } from '@/components/spaces/ielts-prep-workspace';
import { ExamModeSwitch } from '@/components/exam/exam-mode-switch';
import { useExamMode } from '@/hooks/use-exam-mode';
import { EXAM_MODE_STORAGE_KEY } from '@/lib/exam-mode';
import { EXAM_INSERT_TTL_MS, useUIStore } from '@/lib/store';
import type { SpaceDetail } from '@/types/spaces';

const SPACE = { id: 'sp_en', template_id: 'ielts_prep' } as SpaceDetail;

let root: Root;
let host: HTMLDivElement;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({ composerInsert: null, composerDrafts: {}, toast: null });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const q = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/** The switch as the shell wires it (session-nav-shell.tsx): useExamMode + ExamModeSwitch. */
function Harness() {
  const [mode, setMode] = useExamMode();
  return (
    <>
      <ExamModeSwitch mode={mode} onChange={setMode} panelId={(m) => `p-${m}`} />
      <div data-testid="mode">{mode}</div>
    </>
  );
}
const render = () => act(() => root.render(<Harness />));

describe('Exam modes', () => {
  it('starts in Chat, a tab list of Chat then Form', () => {
    render();
    const tabs = Array.from(host.querySelectorAll('[role="tab"]'));
    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('exam.modes');
    expect(tabs.map((t) => t.textContent)).toEqual(['exam.mode.chat', 'exam.mode.form']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((t) => t.getAttribute('aria-controls'))).toEqual(['p-chat', 'p-form']);
  });

  it('remembers the mode used last', () => {
    render();
    act(() => q('exam-mode-form')!.click());
    expect(localStorage.getItem(EXAM_MODE_STORAGE_KEY)).toBe('form');
    act(() => root.unmount());
    root = createRoot(host);
    render();
    expect(q('mode')?.textContent).toBe('form');
  });

  it('arrow keys move between the tabs', () => {
    render();
    act(() => {
      q('exam-mode-chat')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(q('exam-mode-form')?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(q('exam-mode-form'));
  });

  it('a Get started insert brings Exam back to Chat', () => {
    localStorage.setItem(EXAM_MODE_STORAGE_KEY, 'form');
    render();
    expect(q('mode')?.textContent).toBe('form');
    act(() => useUIStore.getState().requestComposerInsert('Practise IELTS speaking', 'exam', 'replace'));
    expect(q('mode')?.textContent).toBe('chat');
    expect(localStorage.getItem(EXAM_MODE_STORAGE_KEY)).toBe('chat');
  });
});

// D38 (Owen: two rows of tabs with 对话 repeated): the English Space shows its conversation only.
describe('the English Space', () => {
  it('has no panel row: no second "Chat" tab and no English passport tab', () => {
    act(() => root.render(<IeltsPrepWorkspace space={SPACE} />));
    expect(q('space-chat-pane')).not.toBeNull();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
  });
});

describe('the exam composer target', () => {
  const textarea = () => host.querySelector('textarea')!;

  it('the English Space composer takes an exam insert', () => {
    act(() =>
      root.render(<ChatInput onSend={() => undefined} composerTarget="space" alsoAcceptsTarget="exam" />)
    );
    act(() => useUIStore.getState().requestComposerInsert('Practise IELTS speaking', 'exam', 'replace'));
    expect(textarea().value).toBe('Practise IELTS speaking');
    expect(useUIStore.getState().composerInsert).toBeNull();
  });

  it('any other Space composer (a kept-alive CV Space) leaves it alone', () => {
    act(() => root.render(<ChatInput onSend={() => undefined} composerTarget="space" />));
    act(() => useUIStore.getState().requestComposerInsert('Practise IELTS speaking', 'exam', 'replace'));
    expect(textarea().value).toBe('');
    expect(useUIStore.getState().composerInsert?.target).toBe('exam');
  });

  // #313 review: an `exam` insert that waited too long (the English Space never opened) is
  // dropped, so it cannot fill a composer on a much later visit.
  it('drops an exam insert older than EXAM_INSERT_TTL_MS', () => {
    act(() => useUIStore.getState().requestComposerInsert('old guide text', 'exam', 'replace'));
    const insert = useUIStore.getState().composerInsert!;
    useUIStore.setState({ composerInsert: { ...insert, at: insert.at - EXAM_INSERT_TTL_MS - 1 } });
    act(() =>
      root.render(<ChatInput onSend={() => undefined} composerTarget="space" alsoAcceptsTarget="exam" />)
    );
    expect(textarea().value).toBe('');
    expect(useUIStore.getState().composerInsert).toBeNull();
  });

  // #313 review: only the English Space on screen takes it; an older one kept alive does not.
  it.each([
    ['the English Space on screen', { template_id: 'ielts_prep' }, true, 'exam'],
    ['an English Space kept alive off-screen', { template_id: 'ielts_prep' }, false, undefined],
    ['a CV Space on screen', { template_id: 'job_sprint' }, true, undefined],
  ])('%s: alsoAcceptsTarget is %s', (_n, sp, active, expected) => {
    act(() =>
      root.render(
        <SpaceComposerWithStarter
          space={{ id: 'sp', ...sp } as SpaceDetail}
          muted={false}
          sendMessage={async () => ({ ok: true }) as never}
          isSending={false}
          spaceSessionReady
          hasUserMessage={false}
          active={active}
        />
      )
    );
    expect(composerProps.last.alsoAcceptsTarget).toBe(expected);
  });
});
