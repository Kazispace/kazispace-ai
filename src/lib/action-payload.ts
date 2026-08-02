export const STRATEGY_PAYLOAD_PREFIX = '__strategy:';
export const TASK_PAYLOAD_PREFIX = '__task:';
export const ACTION_PAYLOAD_PREFIX = '__action:';

export function strategyIdFromPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(STRATEGY_PAYLOAD_PREFIX)) return null;
  const id = trimmed.slice(STRATEGY_PAYLOAD_PREFIX.length).trim();
  return id || null;
}

export function taskIdFromPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(TASK_PAYLOAD_PREFIX)) return null;
  const id = trimmed.slice(TASK_PAYLOAD_PREFIX.length).trim();
  return id || null;
}

export function isTransportPayload(payload: string): boolean {
  const trimmed = payload.trim();
  return (
    trimmed.startsWith(STRATEGY_PAYLOAD_PREFIX) ||
    trimmed.startsWith(TASK_PAYLOAD_PREFIX) ||
    trimmed.startsWith(ACTION_PAYLOAD_PREFIX)
  );
}

export function isStrategyPayloadContent(content: string): boolean {
  return strategyIdFromPayload(content) !== null;
}
