/**
 * KAZI-1145 · the one channel every `meta.form` answer leaves a bubble through
 * (english_tutor KAZI-1041, cv_builder KAZI-1145).
 *
 * Two shapes:
 * - a chat send — `content` + form meta, posted through the surface's normal
 *   send path (clinic, clinic agent mode, spaces);
 * - an already-answered turn — `cv_upload` posts the file to `/api/v1/inputs`,
 *   which itself returns the next CV reply. The surface only appends the
 *   user bubble and that reply to the conversation.
 */
import { buildAssistantMessageFields } from '@/lib/handle-agent-envelope';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import type { AssistantMessageEnvelopeFields } from '@/lib/handle-agent-envelope';
import type { SpaceChatMessage } from '@/lib/spaces/turn';
import type { AgentChatResponse, ChatMessage } from '@/types';
import type { UserMessageActionMeta } from '@/types/chat-envelope';

export interface ReplyFormChatSubmit {
  /** Text the user bubble shows; also the chat `content`. */
  display: string;
  meta: UserMessageActionMeta;
}

export interface ReplyFormAnsweredTurn {
  kind: 'answered';
  /** User bubble text, e.g. "Uploaded resume.pdf". */
  display: string;
  /** The agent reply the endpoint returned (`response{text,next_actions,cards,meta}`). */
  response: NonNullable<AgentChatResponse['response']>;
}

export type ReplyFormSubmit = ReplyFormChatSubmit | ReplyFormAnsweredTurn;

export function isAnsweredTurn(submit: ReplyFormSubmit): submit is ReplyFormAnsweredTurn {
  return (submit as ReplyFormAnsweredTurn).kind === 'answered';
}

/** Assistant message fields for an answered turn (same parsing as a chat reply). */
export function answeredTurnAssistantFields(turn: ReplyFormAnsweredTurn): AssistantMessageEnvelopeFields {
  return buildAssistantMessageFields(parseAssistantEnvelope({ response: turn.response }));
}

/** The user bubble + reply of an answered turn, for a space-slice conversation (clinic, spaces). */
export function answeredTurnSpaceMessages(
  turn: ReplyFormAnsweredTurn,
  now: number = Date.now()
): [SpaceChatMessage, SpaceChatMessage] {
  // `workflow` has no home on a space message (it never had on the clinic slice either).
  const fields: Omit<AssistantMessageEnvelopeFields, 'workflow'> = { ...answeredTurnAssistantFields(turn) };
  delete (fields as AssistantMessageEnvelopeFields).workflow;
  return [
    { id: `user_${now}`, role: 'user', content: turn.display, status: 'sent' },
    { id: `assistant_${now}`, role: 'assistant', ...fields, streamComplete: true },
  ];
}

/** The user bubble + reply of an answered turn, for a clinic agent-mode conversation. */
export function answeredTurnAgentMessages(
  turn: ReplyFormAnsweredTurn,
  sessionId: string,
  now: number = Date.now()
): [ChatMessage, ChatMessage] {
  const timestamp = new Date(now).toISOString();
  return [
    { id: `user_${now}`, role: 'user', content: turn.display, timestamp, sessionId, status: 'sent' },
    { id: `assistant_${now}`, role: 'assistant', timestamp, sessionId, ...answeredTurnAssistantFields(turn) },
  ];
}
