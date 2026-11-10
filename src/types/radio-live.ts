/**
 * Live Room (KAZI-1287): the client contract's shapes under `/api/v1/radio/live`.
 *
 * Source: kazispace-ui `interfaces/openapi/client-api.json` (`Live*` schemas). Copied by hand, as
 * `types/radio.ts` is, because `api.generated.ts` comes from an older backend snapshot.
 */

export type LiveHostKey = 'warm' | 'clear';
export type LiveLang = 'en' | 'zh' | 'mix';

export interface LiveHost {
  key: LiveHostKey;
  /** A working name, shown exactly as sent (never a title the app adds). */
  name: string;
  voice_id: string;
}

export interface LiveTopic {
  id: string;
  title_zh: string;
  question_en: string;
  /** Hosts that can open this topic (their `key`s). */
  hosts: string[];
}

export interface LiveAvailability {
  asr: boolean;
  tts: boolean;
  llm: boolean;
  /** This region must mark the host's voice as AI-generated (KAZI-1242): the Morse "AI" rhythm before the opening. */
  aigc_label: boolean;
}

export interface LiveLimits {
  record_max_ms: number;
  chunk_max_ms: number;
  chunks_max: number;
}

export interface LiveHome {
  hosts: LiveHost[];
  topics: LiveTopic[];
  sessions_left_today: number;
  availability: LiveAvailability;
  disclaimer_acked: boolean;
  open_session_id?: string | null;
  limits: LiveLimits;
}

export interface LiveStartRequest {
  request_id: string;
  host: string;
  topic_id: string;
}

/** A host line with its own audio: `opening`, `acks`. */
export interface LiveSegment {
  clip_id: string;
  text: string;
  audio_url?: string | null;
  duration_ms?: number | null;
  pending?: boolean;
}

export interface LiveOpeningSegment extends LiveSegment {
  seq: number;
  lang: LiveLang;
}

export interface LiveSession {
  session_id: string;
  host: string;
  topic_id: string;
  status: string;
  opening: LiveOpeningSegment[];
  acks: LiveSegment[];
  limits: LiveLimits;
}

export type LiveNoticeKind = 'retry' | 'paused' | 'ended' | 'limit' | 'quota';

export interface LiveNotice {
  kind: LiveNoticeKind;
  code: string;
  /** The host's own words, never the listener's. */
  text: string;
}

export interface LiveTurnSegment {
  seq: number;
  text: string;
  audio_url?: string | null;
  duration_ms?: number | null;
  pending: boolean;
}

export type LiveTurnKind = 'reply' | 'final' | 'retry' | 'crisis' | 'ended' | 'limit';

export interface LiveTurn {
  turn_id: string;
  turn_no?: number | null;
  kind: LiveTurnKind;
  notice?: LiveNotice | null;
  segments: LiveTurnSegment[];
  next?: 'upgrade' | null;
}

export interface LiveClip {
  text: string;
  audio_url?: string | null;
  duration_ms?: number | null;
}

export interface LiveUpgradeLine {
  seq: number;
  text: string;
  audio_url?: string | null;
  duration_ms?: number | null;
}

export interface LiveUpgrade {
  status: 'pending' | 'ready' | 'skipped';
  retry_after_ms?: number | null;
  handover?: LiveClip | null;
  lines?: LiveUpgradeLine[] | null;
  key_word?: string | null;
  key_word_zh?: string | null;
  notice?: LiveNotice | null;
}

export interface LiveClosingSegment {
  seq: number;
  clip_id: string;
  text: string;
  audio_url?: string | null;
  duration_ms?: number | null;
  lang: 'en';
  pending?: boolean;
}

export interface LiveCard {
  sentence: string;
  key_word?: string | null;
  key_word_zh?: string | null;
}

export interface LiveClose {
  session_id: string;
  end_reason: string;
  closing: LiveClosingSegment[];
  card?: LiveCard | null;
}

export type LiveEventKind = 'live_replay' | 'live_slow' | 'live_show_zh' | 'live_key_word_tap';
export type LivePart = 'reply' | 'upgrade' | 'closing';

export interface LiveClientEvent {
  client_event_id: string;
  kind: LiveEventKind;
  part: LivePart;
  seq?: number;
}

export interface LiveEventsResult {
  accepted: number;
  duplicates: number;
}
