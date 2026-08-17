/** Isolated so tests can defer the chunk without mocking next/dynamic. */
export function loadClinicMessageVirtuoso() {
  return import('@/components/clinic/clinic-message-virtuoso');
}
