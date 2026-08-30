import { create } from 'zustand';
import type { User, ChatMessage, CreditBalance } from '@/types';
import { clearAuthToken, clearPendingOtpPhone, setUserInfo } from './auth';
import { getSession as getRegionSession } from './region/session';
import { publishAuthSessionCleared } from './auth-session-events';
import { publishWorkspaceAssetsInvalidate } from './workspace-assets-invalidate';
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
import { CLINIC_SPACE_ID } from './spaces/constants';

// ---- Auth Store ----
interface AuthStore {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  /** False until Providers finishes session resume (KAZI-577 R1). */
  authReady: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  token: null,
  user: null,
  isLoggedIn: false,
  authReady: false,
  login: (token, user) => {
    if (!user?.id?.trim()) {
      console.warn('[auth] login() refused without a validated user');
      return;
    }
    // KAZI-533: token must already live in the region session blob.
    // Do not write a bare token — that would invalidate getAuthToken().
    const session = getRegionSession();
    if (!session || session.token !== token) {
      // Keep UI login soft-fail safe: still set in-memory; API calls need session.
      console.warn(
        '[auth] login() without matching region session; call setRegionAuthSession first'
      );
    }
    setUserInfo(user);
    clearPendingOtpPhone();
    set({ token, user, isLoggedIn: true, authReady: true });
    publishWorkspaceAssetsInvalidate();
  },
  logout: () => {
    clearAuthToken();
    clearMasterSession();
    clearLocaleCookies();
    clearBillingCache();
    useAgentStore.getState().reset();
    useSpaceStore.getState().reset();
    publishAuthSessionCleared();
    set({ token: null, user: null, isLoggedIn: false, authReady: true });
  },
  updateUser: (partialUser) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partialUser } : null,
    })),
}));

// ---- UI Store ----
export type PaywallTrigger = 'INSUFFICIENT_CREDITS' | 'PRO_FEATURE_LOCKED' | string;

/** Which ChatInput should consume a quote / composer insert (PR #126 P2). */
export type ComposerInsertTarget = 'clinic' | 'space';
/** `append` = quote/emoji (default); `replace` = starter capability chips (PRD). */
export type ComposerInsertMode = 'append' | 'replace';

interface UIStore {
  locale: string;
  sidebarOpen: boolean;
  toast: { message: string; type: 'error' | 'info' } | null;
  /** Insert into the matching ChatInput only (clinic vs space). */
  composerInsert: {
    text: string;
    nonce: number;
    target: ComposerInsertTarget;
    mode: ComposerInsertMode;
  } | null;
  paywallModalOpen: boolean;
  paywallTrigger: PaywallTrigger | null;
  isTelegramMiniApp: boolean;
  tmaInitComplete: boolean;
  setLocale: (locale: string) => void;
  toggleSidebar: () => void;
  showToast: (message: string, type?: 'error' | 'info') => void;
  clearToast: () => void;
  requestComposerInsert: (
    text: string,
    target: ComposerInsertTarget,
    mode?: ComposerInsertMode
  ) => void;
  clearComposerInsert: () => void;
  openPaywall: (trigger: PaywallTrigger) => void;
  closePaywall: () => void;
  setTelegramMiniApp: (value: boolean) => void;
  setTmaInitComplete: (value: boolean) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  locale: 'en',
  sidebarOpen: false,
  toast: null,
  composerInsert: null,
  paywallModalOpen: false,
  paywallTrigger: null,
  isTelegramMiniApp: false,
  tmaInitComplete: false,
  setLocale: (locale) => set({ locale }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),
  requestComposerInsert: (text, target, mode = 'append') =>
    set((state) => ({
      composerInsert: {
        text,
        target,
        mode,
        nonce: (state.composerInsert?.nonce ?? 0) + 1,
      },
    })),
  clearComposerInsert: () => set({ composerInsert: null }),
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
  /** KAZI-651 Phase C.1b — see SpaceSlice.isStreaming. */
  setSpaceStreaming: (spaceId: string, isStreaming: boolean) => void;
  setSpaceReplyNotice: (spaceId: string, notice: SpaceReplyNotice | null) => void;
  setSpaceActiveCapability: (spaceId: string, activeCapability: string | null) => void;
  setSpaceActivePanelHint: (spaceId: string, activePanelHint: string | null) => void;
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
      // KAZI-651 Phase C.1b test discovery: `touched.lruOrder` was being
      // spread directly, but this store's field is `spaceLruOrder` — the
      // touch-to-front never actually persisted (a stray unused `lruOrder`
      // key sat on the state object instead). Pre-existing bug, unrelated
      // to this migration; fixed here since it's a one-line adjacent fix
      // caught by this phase's own regression test.
      return {
        activeSpaceId: spaceId,
        spaces: touched.spaces,
        spaceLruOrder: touched.lruOrder,
      };
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
  setSpaceStreaming: (spaceId, isStreaming) =>
    set((state) => {
      if (!isStreaming && !state.spaces[spaceId]) return {};
      return applySpacePatch(state, spaceId, { isStreaming });
    }),
  setSpaceReplyNotice: (spaceId, notice) =>
    set((state) => {
      if (notice == null && !state.spaces[spaceId]) return {};
      return applySpacePatch(state, spaceId, { replyNotice: notice });
    }),
  setSpaceActiveCapability: (spaceId, activeCapability) =>
    set((state) => {
      // Do not recreate empty slices after LRU eviction (align with touchExistingSpaceLru).
      if (!state.spaces[spaceId]) return {};
      return applySpacePatch(state, spaceId, { activeCapability });
    }),
  setSpaceActivePanelHint: (spaceId, activePanelHint) =>
    set((state) => {
      if (!state.spaces[spaceId]) return {};
      return applySpacePatch(state, spaceId, { activePanelHint });
    }),
  clearSpaceSlice: (spaceId) =>
    set((state) => removeSpaceFromLru(state.spaces, state.spaceLruOrder, spaceId)),
  // KAZI-651 Phase C.1b: logout is the only production caller of reset() and
  // has never cleared Clinic's own thread (there was no useChatStore.clearMessages()
  // call in the logout flow before Clinic's messages moved into this store) —
  // preserve `__clinic__`'s slice so this migration doesn't newly wipe it.
  reset: () =>
    set((state) => {
      const clinicSlice = state.spaces[CLINIC_SPACE_ID];
      const spaces: Record<string, SpaceSlice> = clinicSlice
        ? { [CLINIC_SPACE_ID]: clinicSlice }
        : {};
      return {
        activeSpaceId: null,
        spaces,
        spaceLruOrder: clinicSlice ? [CLINIC_SPACE_ID] : [],
      };
    }),
}));

export type { SpaceReplyNotice, SpaceSlice };
export { emptySpaceSlice };
