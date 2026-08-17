/** Isolated so tests can defer the chunk without mocking next/dynamic. */
export function loadHubMessageVirtuoso() {
  return import('@/components/chat/hub-message-virtuoso');
}
