/** Isolated so tests can defer chunks without mocking next/dynamic. */

export function loadSessionNavPanel() {
  return import('@/components/session-nav/session-nav-panel');
}

export function loadSessionFileLibraryPanel() {
  return import('@/components/session-nav/session-file-library-panel');
}

export function loadSessionGlobalSearchPanel() {
  return import('@/components/session-nav/session-global-search-panel');
}

export function loadSpaceTemplatePicker() {
  return import('@/components/spaces/space-template-picker');
}
