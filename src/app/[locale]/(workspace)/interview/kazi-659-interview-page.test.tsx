/**
 * @vitest-environment jsdom
 *
 * This page assembles a large subtree (HubAgentShell, InterviewWorkspace,
 * ChatInput, HubMessageList, ...) around the `useInterview` state machine.
 * Those children already have their own tests; here we stub them to plain
 * passthroughs so this test stays focused on the page's *own* assembly
 * logic (which state renders which branch, which callback wires to which
 * button) rather than re-testing the whole subtree.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const useInterviewMock = vi.hoisted(() => vi.fn());
const useInterviewProfileMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const refetchProfileMock = vi.hoisted(() => vi.fn());
const submitIntakeMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/use-interview', () => ({
  useInterview: (jobId?: string | null) => useInterviewMock(jobId),
}));

vi.mock('@/hooks/use-interview-profile', () => ({
  useInterviewProfile: (opts?: unknown) => useInterviewProfileMock(opts),
}));

vi.mock('@/hooks/use-hub-session-stale-banner', () => ({
  useHubSessionStaleBanner: () => ({ stale: false, refresh: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock('@/hooks/use-hub-active-agent-sync', () => ({
  useHubActiveAgentSync: () => undefined,
}));

vi.mock('@/components/agent-transition/agent-transition-provider', () => ({
  AgentTransitionProvider: ({ children }: { children: React.ReactNode }) => children,
  useAgentTransition: () => ({ openSwitcher: vi.fn(), activateAgentWithoutPrecheck: vi.fn() }),
}));

vi.mock('@/components/hub/hub-agent-shell', () => ({
  HubAgentShell: ({
    header,
    workspace,
    input,
    children,
  }: {
    header?: React.ReactNode;
    workspace?: React.ReactNode;
    input?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="hub-agent-shell">
      <div data-testid="shell-header">{header}</div>
      <div data-testid="shell-workspace">{workspace}</div>
      <div data-testid="shell-body">{children}</div>
      <div data-testid="shell-input">{input}</div>
    </div>
  ),
}));

vi.mock('@/components/interview/interview-workspace', () => ({
  InterviewWorkspace: () => <div data-testid="interview-workspace" />,
}));

vi.mock('@/components/interview/interview-feedback-actions', () => ({
  InterviewFeedbackActions: () => <div data-testid="interview-feedback-actions" />,
}));

vi.mock('@/components/interview/irp-diagnosis-update', () => ({
  IrpDiagnosisUpdate: () => <div data-testid="irp-diagnosis-update" />,
}));

vi.mock('@/components/chat/chat-input', () => ({
  ChatInput: ({ onSend }: { onSend: (text: string) => void }) => (
    <button type="button" data-testid="chat-input" onClick={() => onSend('Backend Engineer')}>
      chat-input
    </button>
  ),
}));

vi.mock('@/components/chat/hub-message-list', () => ({
  HubMessageList: ({ messages }: { messages: Array<{ id: string; content: string }> }) => (
    <div data-testid="hub-message-list">
      {messages.map((m) => (
        <p key={m.id}>{m.content}</p>
      ))}
    </div>
  ),
}));

vi.mock('@/components/hub/hub-workflow-strip', () => ({
  HubWorkflowStrip: () => <div data-testid="hub-workflow-strip" />,
}));

vi.mock('@/components/clinic/quick-replies', () => ({
  QuickReplies: () => <div data-testid="quick-replies" />,
}));

vi.mock('@/components/hub/hub-session-stale-banner', () => ({
  HubSessionStaleBanner: () => <div data-testid="hub-session-stale-banner" />,
}));

import InterviewPage from '@/app/[locale]/(workspace)/interview/page';

function baseInterviewState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    phase: 'role_select',
    messages: [],
    displayRole: null,
    activeWorkflow: null,
    questionIndex: 0,
    questionCount: 0,
    diagnosisCtas: [],
    prepCard: null,
    prepAckRequired: false,
    jobContext: null,
    isStarting: false,
    isAckingPrep: false,
    isSending: false,
    isCheckingFeedback: false,
    needsLogin: false,
    isJobMode: false,
    startJobSession: vi.fn(),
    submitIntake: submitIntakeMock,
    ackPrep: vi.fn(),
    submitAnswer: vi.fn(),
    reset: vi.fn(),
    retrySession: vi.fn(),
    checkFeedbackNow: vi.fn(),
    agentSessionId: 'sess-1',
    resyncSession: vi.fn(),
    ...overrides,
  };
}

function baseProfileState(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    irpEnabled: true,
    profile: null,
    profileStatus: 'complete',
    isProfileLoading: false,
    profileError: null,
    refetchProfile: refetchProfileMock,
    ...overrides,
  };
}

describe('KAZI-659 /interview page', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    useInterviewMock.mockReset();
    useInterviewProfileMock.mockReset();
    pushMock.mockReset();
    refetchProfileMock.mockReset();
    submitIntakeMock.mockReset();
    useInterviewMock.mockReturnValue(baseInterviewState());
    useInterviewProfileMock.mockReturnValue(baseProfileState());
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    host?.remove();
    root = null;
    host = null;
  });

  it('shows the login banner (not the workspace shell) and routes to /login on sign-in', async () => {
    useInterviewMock.mockReturnValue(baseInterviewState({ needsLogin: true }));

    await act(async () => {
      root!.render(<InterviewPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('loginBanner');
    expect(host?.querySelector('[data-testid="hub-agent-shell"]')).toBeNull();

    const signInButton = Array.from(host?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent === 'signIn'
    );
    await act(async () => {
      signInButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledWith('/en/login');
  });

  it('renders the workspace shell with the intake chat input when logged in', async () => {
    useInterviewMock.mockReturnValue(
      baseInterviewState({
        needsLogin: false,
        phase: 'role_select',
        messages: [{ id: 'm1', content: 'Tell me the role you want to practice for.' }],
      })
    );

    await act(async () => {
      root!.render(<InterviewPage params={{ locale: 'en' }} />);
    });

    expect(host?.querySelector('[data-testid="hub-agent-shell"]')).not.toBeNull();
    expect(host?.textContent).toContain('Tell me the role you want to practice for.');

    const chatInput = host?.querySelector('[data-testid="chat-input"]') as HTMLButtonElement;
    expect(chatInput).not.toBeNull();

    await act(async () => {
      chatInput.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(submitIntakeMock).toHaveBeenCalledWith('Backend Engineer');
  });

  it('shows the profile-load-failed banner and retries on click', async () => {
    useInterviewMock.mockReturnValue(
      baseInterviewState({ needsLogin: false, phase: 'role_select' })
    );
    useInterviewProfileMock.mockReturnValue(
      baseProfileState({ profileError: 'network error' })
    );

    await act(async () => {
      root!.render(<InterviewPage params={{ locale: 'en' }} />);
    });

    expect(host?.textContent).toContain('irp.profileLoadFailed');
    const retryButton = Array.from(host?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent === 'irp.profileRetry'
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      retryButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(refetchProfileMock).toHaveBeenCalled();
  });
});
