/** Isolated so tests can defer the chunk without mocking next/dynamic. */
export function loadSpaceMessageVirtuoso() {
  return import('@/components/spaces/space-message-virtuoso');
}
