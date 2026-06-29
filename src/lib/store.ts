import { create } from 'zustand';
import type { User, ChatMessage, CreditBalance } from '@/types';
import { setAuthToken, clearAuthToken, setUserInfo } from './auth';
import { clearBillingCache } from './billing-cache';

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
    clearBillingCache();
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
  setMessages: (messages) => set({ messages }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSending: (sending) => set({ isSending: sending }),
  clearMessages: () => set({ messages: [], currentSessionId: null }),
}));

// ---- UI Store ----
interface UIStore {
  locale: string;
  sidebarOpen: boolean;
  toast: { message: string; type: 'error' | 'info' } | null;
  setLocale: (locale: string) => void;
  toggleSidebar: () => void;
  showToast: (message: string, type?: 'error' | 'info') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  locale: 'en',
  sidebarOpen: false,
  toast: null,
  setLocale: (locale) => set({ locale }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
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
