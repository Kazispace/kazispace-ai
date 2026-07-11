import { AGENT_REGISTRY } from '@/lib/agents/registry';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import type {
  AssistantWorkflow,
  ChatJobCard,
  ChatNextAction,
  ParsedAssistantEnvelope,
} from '@/types/chat-envelope';

export type AgentEscalation = {
  exitedAgent?: string;
  exitReason?: string;
  targetAgentId: string;
  suggestedNextSteps: string[];
};

/** Fields to attach when appending an assistant turn (§19.4). */
export type AssistantMessageEnvelopeFields = {
  content: string;
  nextActions?: ChatNextAction[];
  cards?: ChatJobCard[];
  workflow?: AssistantWorkflow;
  intent?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Path A escalation from parsed envelope fields. */
export function envelopeToEscalation(
  envelope: ParsedAssistantEnvelope,
  raw?: Record<string, unknown>
): AgentEscalation | null {
  if (!envelope.exited) return null;
  const steps = envelope.suggestedNextSteps;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const targetAgentId = steps.find(
    (step): step is string => typeof step === 'string' && step.length > 0
  );
  if (!targetAgentId) return null;

  const known = AGENT_REGISTRY.some((a) => a.agentId === targetAgentId);
  if (!known) return null;

  const agentId =
    typeof raw?.agent_id === 'string' ? raw.agent_id : undefined;

  return {
    exitedAgent: envelope.exitedAgent ?? agentId,
    exitReason: envelope.exitReason,
    targetAgentId,
    suggestedNextSteps: steps,
  };
}

/** Build assistant message patch from a parsed envelope. */
export function buildAssistantMessageFields(
  envelope: ParsedAssistantEnvelope
): AssistantMessageEnvelopeFields {
  const fields: AssistantMessageEnvelopeFields = {
    content: envelope.reply || '…',
  };
  if (envelope.intent) fields.intent = envelope.intent;
  if (envelope.nextActions.length > 0) {
    fields.nextActions = envelope.nextActions;
  }
  if (envelope.cards.length > 0) {
    fields.cards = envelope.cards;
  }
  if (envelope.workflow) {
    fields.workflow = envelope.workflow;
  }
  return fields;
}

/**
 * Single FE entry for agent/clinic turn responses (Web App SDD §19.4).
 * Parses envelope, builds assistant message fields, and resolves Path A escalation.
 */
export function handleAgentEnvelope(data: unknown): {
  envelope: ParsedAssistantEnvelope;
  assistant: AssistantMessageEnvelopeFields;
  escalation: AgentEscalation | null;
} {
  const envelope = parseAssistantEnvelope(data);
  const raw = asRecord(data);
  return {
    envelope,
    assistant: buildAssistantMessageFields(envelope),
    escalation: envelopeToEscalation(envelope, raw),
  };
}

/** Prefer BE workflow; fall back to transitional FE builder. */
export function resolveActiveWorkflow<T>(
  messages: Array<{ role: string; workflow?: AssistantWorkflow }>,
  fallback: () => T
): AssistantWorkflow | T {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.workflow) {
      return msg.workflow;
    }
  }
  return fallback();
}
