import { create } from 'zustand';
import type { User, ChatMessage, CreditBalance } from '@/types';
import { setAuthToken, clearAuthToken, setUserInfo } from './auth';
import { clearBillingCache } from './billing-cache';
import { clearMockAgentSessions } from './agent-api';
import { clearLocaleCookies } from './locale';
import { clearMasterSession } from './master-session';
import {
  getAgentSliceFromRecord,
  patchAgentSlice,
  type AgentSlice,
} from './agent-slice';
import {
  emptySpaceSlice,
  getSpaceSliceFromRecord,
  patchSpaceSliceWithLru,
  removeSpaceFromLru,
  touchExistingSpaceLru,
  type SpaceReplyNotice,
  type SpaceSlice,
} from './space-slice';
import type { SpaceChatMessage } from './spaces/turn';

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
    useSpaceStore.getState().reset();
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

// ---- Agent Store (ADR-005 per-agent slices) ----
interface AgentStore {
  /** Clinic inline chat focus — null on cold-open Clinic or dedicated hub pages. */
  activeAgentId: string | null;
  agentSessionId: string | null;
  isSwitching: boolean;
  switcherOpen: boolean;
  pendingAgentSwitch: {
    fromAgentId: string;
    toAgentId: string;
    triggerMessage?: string;
  } | null;
  agents: Record<string, AgentSlice>;
  setSwitcherOpen: (open: boolean) => void;
  setPendingAgentSwitch: (
    pending: {
      fromAgentId: string;
      toAgentId: string;
      triggerMessage?: string;
    } | null
  ) => void;
  setSwitching: (switching: boolean) => void;
  setActiveAgent: (agentId: string | null, sessionId: string | null) => void;
  setAgentSession: (agentId: string, sessionId: string | null) => void;
  getAgentSlice: (agentId: string) => AgentSlice;
  getAgentMessages: (agentId: string) => ChatMessage[];
  setAgentMessages: (agentId: string, messages: ChatMessage[]) => void;
  addAgentMessage: (agentId: string, message: ChatMessage) => void;
  updateAgentMessage: (agentId: string, id: string, patch: Partial<ChatMessage>) => void;
  removeAgentMessage: (agentId: string, id: string) => void;
  setAgentSending: (agentId: string, sending: boolean) => void;
  setAgentStreaming: (agentId: string, streaming: boolean) => void;
  reset: () => void;
}

const initialAgentState = {
  activeAgentId: null as string | null,
  agentSessionId: null as string | null,
  isSwitching: false,
  switcherOpen: false,
  pendingAgentSwitch: null as {
    fromAgentId: string;
    toAgentId: string;
    triggerMessage?: string;
  } | null,
  agents: {} as Record<string, AgentSlice>,
};

export const useAgentStore = create<AgentStore>()((set, get) => ({
  ...initialAgentState,
  setSwitcherOpen: (open) => set({ switcherOpen: open }),
  setPendingAgentSwitch: (pending) => set({ pendingAgentSwitch: pending }),
  setSwitching: (switching) => set({ isSwitching: switching }),
  setActiveAgent: (agentId, sessionId) =>
    set((state) => ({
      activeAgentId: agentId,
      agentSessionId: sessionId,
      agents:
        agentId != null
          ? patchAgentSlice(state.agents, agentId, { sessionId })
          : state.agents,
    })),
  setAgentSession: (agentId, sessionId) =>
    set((state) => {
      const agents = patchAgentSlice(state.agents, agentId, { sessionId });
      return {
        agents,
        ...(state.activeAgentId === agentId ? { agentSessionId: sessionId } : {}),
      };
    }),
  getAgentSlice: (agentId) => getAgentSliceFromRecord(get().agents, agentId),
  getAgentMessages: (agentId) => getAgentSliceFromRecord(get().agents, agentId).messages,
  setAgentMessages: (agentId, messages) =>
    set((state) => ({
      agents: patchAgentSlice(state.agents, agentId, { messages }),
    })),
  addAgentMessage: (agentId, message) =>
    set((state) => {
      const slice = getAgentSliceFromRecord(state.agents, agentId);
      return {
        agents: patchAgentSlice(state.agents, agentId, {
          messages: [...slice.messages, message],
        }),
      };
    }),
  updateAgentMessage: (agentId, id, patch) =>
    set((state) => {
      const slice = getAgentSliceFromRecord(state.agents, agentId);
      return {
        agents: patchAgentSlice(state.agents, agentId, {
          messages: slice.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }),
      };
    }),
  removeAgentMessage: (agentId, id) =>
    set((state) => {
      const slice = getAgentSliceFromRecord(state.agents, agentId);
      return {
        agents: patchAgentSlice(state.agents, agentId, {
          messages: slice.messages.filter((m) => m.id !== id),
        }),
      };
    }),
  setAgentSending: (agentId, sending) =>
    set((state) => ({
      agents: patchAgentSlice(state.agents, agentId, { isSending: sending }),
    })),
  setAgentStreaming: (agentId, streaming) =>
    set((state) => ({
      agents: patchAgentSlice(state.agents, agentId, { isStreaming: streaming }),
    })),
  reset: () => {
    clearMockAgentSessions();
    set({ ...initialAgentState, agents: {} });
  },
}));

// ---- Space Store (ADR-006 / KAZI-178 per-space slices) ----
interface SpaceStore {
  activeSpaceId: string | null;
  spaces: Record<string, SpaceSlice>;
  /** Most-recent-first ids; paired with LRU prune on patch (max SPACE_SLICE_LRU_LIMIT). */
  spaceLruOrder: string[];
  setActiveSpaceId: (spaceId: string | null) => void;
  getSpaceSlice: (spaceId: string) => SpaceSlice;
  setSpaceMasterSessionId: (spaceId: string, masterSessionId: string | null) => void;
  setSpaceMessages: (spaceId: string, messages: SpaceChatMessage[]) => void;
  patchSpaceMessages: (
    spaceId: string,
    updater: (prev: SpaceChatMessage[]) => SpaceChatMessage[]
  ) => void;
  setSpaceHydrating: (spaceId: string, isHydrating: boolean) => void;
  setSpaceSending: (spaceId: string, isSending: boolean) => void;
  setSpaceReplyNotice: (spaceId: string, notice: SpaceReplyNotice | null) => void;
  setSpaceActiveCapability: (spaceId: string, activeCapability: string | null) => void;
  clearSpaceSlice: (spaceId: string) => void;
  reset: () => void;
}

function applySpacePatch(
  state: Pick<SpaceStore, 'spaces' | 'spaceLruOrder' | 'activeSpaceId'>,
  spaceId: string,
  patch: Partial<SpaceSlice>
) {
  return patchSpaceSliceWithLru(state.spaces, state.spaceLruOrder, spaceId, patch, {
    protectSpaceId: state.activeSpaceId,
  });
}

export const useSpaceStore = create<SpaceStore>()((set, get) => ({
  activeSpaceId: null,
  spaces: {},
  spaceLruOrder: [],
  setActiveSpaceId: (spaceId) =>
    set((state) => {
      if (!spaceId) return { activeSpaceId: null };
      // Do not create empty slices on browse — wait for messages/masterSession patch.
      const touched = touchExistingSpaceLru(
        state.spaces,
        state.spaceLruOrder,
        spaceId,
        { protectSpaceId: spaceId }
      );
      return { activeSpaceId: spaceId, ...touched };
    }),
  getSpaceSlice: (spaceId) => getSpaceSliceFromRecord(get().spaces, spaceId),
  setSpaceMasterSessionId: (spaceId, masterSessionId) =>
    set((state) => applySpacePatch(state, spaceId, { masterSessionId })),
  setSpaceMessages: (spaceId, messages) =>
    set((state) => applySpacePatch(state, spaceId, { messages })),
  patchSpaceMessages: (spaceId, updater) =>
    set((state) => {
      const slice = getSpaceSliceFromRecord(state.spaces, spaceId);
      return applySpacePatch(state, spaceId, {
        messages: updater(slice.messages),
      });
    }),
  setSpaceHydrating: (spaceId, isHydrating) =>
    set((state) => {
      if (!isHydrating && !state.spaces[spaceId]) return {};
      return applySpacePatch(state, spaceId, { isHydrating });
    }),
  setSpaceSending: (spaceId, isSending) =>
    set((state) => {
      if (!isSending && !state.spaces[spaceId]) return {};
      return applySpacePatch(state, spaceId, { isSending });
    }),
  setSpaceReplyNotice: (spaceId, notice) =>
    set((state) => {
      if (notice == null && !state.spaces[spaceId]) return {};
      return applySpacePatch(state, spaceId, { replyNotice: notice });
    }),
  setSpaceActiveCapability: (spaceId, activeCapability) =>
    set((state) => applySpacePatch(state, spaceId, { activeCapability })),
  clearSpaceSlice: (spaceId) =>
    set((state) => removeSpaceFromLru(state.spaces, state.spaceLruOrder, spaceId)),
  reset: () => set({ activeSpaceId: null, spaces: {}, spaceLruOrder: [] }),
}));

export type { SpaceReplyNotice, SpaceSlice };
export { emptySpaceSlice };
