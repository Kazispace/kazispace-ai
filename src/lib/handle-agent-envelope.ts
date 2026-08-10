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
  /** assistant_response.meta — e.g. recommended_strategy_id (KAZI-400). */
  assistantMeta?: Record<string, unknown>;
  /** english_tutor Cap custom_components (KAZI-502). */
  customComponents?: import('@/types/english-tutor-envelope').EnglishTutorEnvelopeComponent[];
};

/** Path A escalation from parsed envelope fields. */
export function envelopeToEscalation(
  envelope: ParsedAssistantEnvelope
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

  return {
    exitedAgent: envelope.exitedAgent,
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
  if (envelope.meta && Object.keys(envelope.meta).length > 0) {
    fields.assistantMeta = envelope.meta;
  }
  if (envelope.customComponents && envelope.customComponents.length > 0) {
    fields.customComponents = envelope.customComponents;
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
  return {
    envelope,
    assistant: buildAssistantMessageFields(envelope),
    escalation: envelopeToEscalation(envelope),
  };
}
