/**
 * Clinic keep-alive must not treat a failed history GET as a finished
 * bootstrap (KAZI-588 R3). Failed loads stay retryable on re-show.
 */
export function clinicHistoryBootstrapOutcome(historyOk: boolean): {
  markComplete: boolean;
  showHistoryFailed: boolean;
} {
  if (historyOk) {
    return { markComplete: true, showHistoryFailed: false };
  }
  return { markComplete: false, showHistoryFailed: true };
}
