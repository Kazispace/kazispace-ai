export class ReadinessCheckLimitError extends Error {
  readonly code = 'READINESS_CHECK_LIMIT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ReadinessCheckLimitError';
  }
}

export function isReadinessCheckLimitError(error: unknown): error is ReadinessCheckLimitError {
  return error instanceof ReadinessCheckLimitError;
}
