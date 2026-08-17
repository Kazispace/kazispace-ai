/**
 * Named FE perf policy knobs (KAZI-562 / 563 / 565 review).
 * Keep tunables here so RUM/benchmarks can cite one source of truth.
 */

/** Space detail Query stale window — Header + Workspace share one GET. */
export const SPACE_DETAIL_STALE_MS = 30_000;

/** Space master-session history Query stale window. */
export const SPACE_HISTORY_STALE_MS = 30_000;

/** Keep unused history queries briefly for A→B→A warm revisits. */
export const SPACE_HISTORY_GC_MS = 5 * 60_000;

/**
 * Placeholder recovery reads (Clinic parity).
 * Success path must not 3× scrape master history (KAZI-563).
 */
export const SPACE_HISTORY_RECOVERY_ATTEMPTS = 1;

/** Public directory network refresh: idle callback timeout. */
export const DIRECTORY_IDLE_TIMEOUT_MS = 2500;

/** Fallback when requestIdleCallback is unavailable. */
export const DIRECTORY_FALLBACK_DELAY_MS = 2000;

/** Mounted SpaceWorkspace instances kept across A→B→A (KAZI-573). */
export const SPACE_WORKSPACE_KEEPALIVE_LIMIT = 3;

/**
 * Space chat virtualizes after this many bubbles (KAZI-574).
 * Below the threshold the existing map stays — no react-virtuoso chunk.
 * 60 is lower than the original “200+” leftover so markdown-heavy threads
 * benefit before the DOM is already huge.
 */
export const SPACE_CHAT_VIRTUALIZE_AFTER = 60;

/**
 * Virtuoso probe skip. Markdown bubbles vary (cards / tables / short replies);
 * 160px is a mid-size text row so the first estimate is not a one-line stub.
 */
export const SPACE_CHAT_VIRTUOSO_DEFAULT_ITEM_HEIGHT = 160;

/**
 * Extra pixels rendered above/below the viewport. Fast flick through
 * markdown-heavy rows should not flash empty gutters.
 */
export const SPACE_CHAT_VIRTUOSO_VIEWPORT_OVERSCAN = 800;
