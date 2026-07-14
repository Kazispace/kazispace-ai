export const SPACES_LIST_INVALIDATE_EVENT = 'kazi-spaces-list-invalidate';

export function publishSpacesListInvalidate(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SPACES_LIST_INVALIDATE_EVENT));
}
