import { create } from 'zustand';
import type { User, ChatMessage, CreditBalance } from '@/types';
import { setAuthToken, clearAuthToken, setUserInfo } from './auth';
import { clearBillingCache } from './billing-cache';
import { clearMockAgentSessions } from './agent-api';
import { clearLocaleCookies } from './locale';
import { clearMasterSession } from './master-session';

// ---- Auth Store ----
interface AuthStore {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  token: null,
  user: null,
  isLoggedIn: false,
  login: (token, user) => {
    setAuthToken(token);
    setUserInfo(user);
    set({ token, user, isLoggedIn: true });
  },
  logout: () => {
    clearAuthToken();
    clearMasterSession();
    clearLocaleCookies();
    clearBillingCache();
    useAgentStore.getState().reset();
    set({ token: null, user: null, isLoggedIn: false });
  },
  updateUser: (partialUser) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partialUser } : null,
    })),
}));

// ---- Chat Store ----
interface ChatStore {
  currentSessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  isSending: boolean;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  setSending: (sending: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  isSending: false,
  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  setMessages: (messages) => set({ messages }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSending: (sending) => set({ isSending: sending }),
  clearMessages: () => set({ messages: [], currentSessionId: null }),
}));

// ---- UI Store ----
export type PaywallTrigger = 'INSUFFICIENT_CREDITS' | 'PRO_FEATURE_LOCKED' | string;

interface UIStore {
  locale: string;
  sidebarOpen: boolean;
  toast: { message: string; type: 'error' | 'info' } | null;
  paywallModalOpen: boolean;
  paywallTrigger: PaywallTrigger | null;
  isTelegramMiniApp: boolean;
  tmaInitComplete: boolean;
  setLocale: (locale: string) => void;
  toggleSidebar: () => void;
  showToast: (message: string, type?: 'error' | 'info') => void;
  clearToast: () => void;
  openPaywall: (trigger: PaywallTrigger) => void;
  closePaywall: () => void;
  setTelegramMiniApp: (value: boolean) => void;
  setTmaInitComplete: (value: boolean) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  locale: 'en',
  sidebarOpen: false,
  toast: null,
  paywallModalOpen: false,
  paywallTrigger: null,
  isTelegramMiniApp: false,
  tmaInitComplete: false,
  setLocale: (locale) => set({ locale }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
  openPaywall: (trigger) => set({ paywallModalOpen: true, paywallTrigger: trigger }),
  closePaywall: () => set({ paywallModalOpen: false, paywallTrigger: null }),
  setTelegramMiniApp: (value) => set({ isTelegramMiniApp: value }),
  setTmaInitComplete: (value) => set({ tmaInitComplete: value }),
}));

// ---- Credits Store ----
interface CreditsStore {
  balance: CreditBalance;
  setBalance: (balance: CreditBalance) => void;
}

export const useCreditsStore = create<CreditsStore>()((set) => ({
  balance: { cvCredits: 0, interviewCredits: 0 },
  setBalance: (balance) => set({ balance }),
}));

// ---- Agent Store (Sprint 2) ----
interface AgentStore {
  activeAgentId: string | null;
  agentSessionId: string | null;
  isSwitching: boolean;
  switcherOpen: boolean;
  isAgentSending: boolean;
  isAgentStreaming: boolean;
  agentMessages: Record<string, ChatMessage[]>;
  setSwitcherOpen: (open: boolean) => void;
  setSwitching: (switching: boolean) => void;
  setActiveAgent: (agentId: string | null, sessionId: string | null) => void;
  getAgentMessages: (agentId: string) => ChatMessage[];
  setAgentMessages: (agentId: string, messages: ChatMessage[]) => void;
  addAgentMessage: (agentId: string, message: ChatMessage) => void;
  updateAgentMessage: (agentId: string, id: string, patch: Partial<ChatMessage>) => void;
  setAgentSending: (sending: boolean) => void;
  setAgentStreaming: (streaming: boolean) => void;
  reset: () => void;
}

const initialAgentState = {
  activeAgentId: null as string | null,
  agentSessionId: null as string | null,
  isSwitching: false,
  switcherOpen: false,
  isAgentSending: false,
  isAgentStreaming: false,
  agentMessages: {} as Record<string, ChatMessage[]>,
};

export const useAgentStore = create<AgentStore>()((set, get) => ({
  ...initialAgentState,
  setSwitcherOpen: (open) => set({ switcherOpen: open }),
  setSwitching: (switching) => set({ isSwitching: switching }),
  setActiveAgent: (agentId, sessionId) =>
    set({ activeAgentId: agentId, agentSessionId: sessionId }),
  getAgentMessages: (agentId) => get().agentMessages[agentId] ?? [],
  setAgentMessages: (agentId, messages) =>
    set((state) => ({
      agentMessages: { ...state.agentMessages, [agentId]: messages },
    })),
  addAgentMessage: (agentId, message) =>
    set((state) => ({
      agentMessages: {
        ...state.agentMessages,
        [agentId]: [...(state.agentMessages[agentId] ?? []), message],
      },
    })),
  updateAgentMessage: (agentId, id, patch) =>
    set((state) => ({
      agentMessages: {
        ...state.agentMessages,
        [agentId]: (state.agentMessages[agentId] ?? []).map((m) =>
          m.id === id ? { ...m, ...patch } : m
        ),
      },
    })),
  setAgentSending: (sending) => set({ isAgentSending: sending }),
  setAgentStreaming: (streaming) => set({ isAgentStreaming: streaming }),
  reset: () => {
    clearMockAgentSessions();
    set({ ...initialAgentState, agentMessages: {} });
  },
}));
