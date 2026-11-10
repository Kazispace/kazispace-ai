/**
 * Personal radio (KAZI-1209) — the client contract's radio shapes.
 *
 * Source: kazispace-ui `interfaces/openapi/client-api.json` (the contract governs every field and
 * value; these types copy it by hand because `src/types/api.generated.ts` is generated from an
 * older backend snapshot that has no radio paths yet).
 */

export type RadioBand = 'A2' | 'B1' | 'B2' | 'C1';
export const RADIO_BANDS: readonly RadioBand[] = ['A2', 'B1', 'B2', 'C1'] as const;

export type RadioVoiceId = 'en_us_f1' | 'en_us_m1' | 'en_gb_f1' | 'en_gb_m1';

export interface RadioListenerProfile {
  band: RadioBand;
  en_ratio: number;
  voice_id: string;
  source: 'override' | 'epp' | 'et_ability' | 'none';
}

export interface RadioPrefs {
  band_override?: RadioBand | null;
  en_ratio_override?: number | null;
  voice_id?: string | null;
  bgm_on?: boolean | null;
  bgm_level?: number | null;
  listen_window_on?: boolean | null;
}

export interface RadioAvailability {
  tts: boolean;
  asr: boolean;
  new_render: boolean;
  /** KAZI-1242: this region must label AI-generated audio (D20 = E1). Not used by the radio's players yet. */
  aigc_label?: boolean;
}

export type RadioSaveStatus = 'active' | 'completed' | 'overwritten';

export interface RadioSaveSummary {
  save_id: string;
  story_id?: string | null;
  title: string;
  status: RadioSaveStatus;
  current_node_id: string;
  save_version: number;
  updated_at: string;
  /** Choices made so far, not counting those taken back; shown as "Choice {n}" with n = choices_made + 1. */
  choices_made: number;
}

export interface RadioStorySummary {
  story_id: string;
  slug: string;
  title: string;
  synopsis?: string | null;
  tags?: string[];
  base_cefr?: string | null;
  recommended: boolean;
  /** Catalog attributes (KAZI-1257 E); `null` for a story not from the catalog. A `null` attribute = not labelled. */
  attrs?: RadioStoryAttrs | null;
}

export interface RadioStoryAttrs {
  suspense?: number | null;
  age_range?: string[] | null;
  genre?: string | null;
  duration_s_est?: number | null;
}

/** One filter `GET /radio/facets` offers (kazispace-ui personal-radio.md, Filtering and sorting stories). */
export interface RadioFacetFilter {
  key: string;
  type: 'int_range' | 'enum' | 'enum_multi' | 'int';
  /** enum / enum_multi: the allowed values; int_range: `{min, max}`; int: `{min}`. */
  values: unknown;
  /** The `GET /radio/stories` query parameters for it. */
  params: string[];
  meaning?: string | null;
}

export interface RadioFacets {
  vocab_version: number;
  source: string;
  fetched_at?: string | null;
  filters: RadioFacetFilter[];
  sorts: string[];
}

export interface RadioStoriesResponse {
  stories: RadioStorySummary[];
}

export interface RadioProgramSummary {
  program_id: string;
  kind: 'podcast' | 'column';
  series?: string | null;
  title: string;
  tags?: string[];
  /** Level and length of the version this listener will hear; null when there is none. */
  band?: RadioBand | null;
  duration_ms?: number | null;
}

/** A short sample of one host voice, signed for 15 minutes. */
export interface RadioVoiceSample {
  voice_id: string;
  audio_url: string;
  duration_ms: number;
}

export interface RadioHome {
  continue_listening: RadioSaveSummary[];
  stories: RadioStorySummary[];
  programs: RadioProgramSummary[];
  profile: RadioListenerProfile;
  prefs: RadioPrefs;
  availability: RadioAvailability;
  voices: string[];
  /** One per voice in `voices` that has a sample, in that order; may be empty. */
  voice_samples: RadioVoiceSample[];
}

export interface RadioPrefsResponse {
  prefs: RadioPrefs;
  profile: RadioListenerProfile;
}

export interface RadioSegment {
  seq: number;
  lang: 'zh' | 'en' | 'mix';
  text: string;
  audio_url?: string | null;
  duration_ms?: number | null;
  pending: boolean;
}

export interface RadioChoice {
  key: string;
  choice_id: string;
  label?: string | null;
  audio_url?: string | null;
}

export interface RadioGlossaryItem {
  term: string;
  gloss?: string | null;
  gloss_lang?: string | null;
  cefr?: string | null;
}

export interface RadioNode {
  node_id: string;
  node_type: 'choice' | 'narration' | 'ending';
  render_id?: string | null;
  source: 'llm' | 'fallback' | 'cache';
  segments: RadioSegment[];
  choices?: RadioChoice[];
  glossary?: RadioGlossaryItem[];
  ending?: RadioEnding | null;
}

/** A thumbs-down reason (closed set; personal-radio.md 0.15, Rating). */
export type RadioRatingReason = 'too_hard' | 'too_easy' | 'boring' | 'voice' | 'en_ratio';
export const RADIO_RATING_REASONS: RadioRatingReason[] = ['too_hard', 'too_easy', 'boring', 'voice', 'en_ratio'];

/** The listener's own rating of a whole story or program; reasons only with `down`. */
export interface RadioMyRating {
  rating: 'up' | 'down';
  reasons: RadioRatingReason[];
}

export interface RadioRatingResponse {
  target_kind: 'story' | 'program';
  target_id: string;
  rating: 'up' | 'down' | null;
  reasons: RadioRatingReason[];
}

/** The ending reached; `title` is null when the story gives no name. */
export interface RadioEnding {
  ending_key?: string | null;
  title?: string | null;
}

export type RadioNoticeKind =
  | 'retry'
  | 'paused'
  | 'quota'
  | 'handoff'
  | 'upgrade_offer'
  | 'downgrade_offer'
  | 'unavailable';

export interface RadioNotice {
  kind: RadioNoticeKind;
  code?: string | null;
  text?: string | null;
  ctas?: Record<string, unknown>[];
}

export interface RadioAnswerSegment {
  seq: number;
  lang?: string | null;
  text: string;
}

export interface RadioParsed {
  kind: string;
  command?: string | null;
  choice_id?: string | null;
  via?: string | null;
}

export interface RadioPlayerResponse {
  save_id?: string | null;
  save_version?: number | null;
  status?: RadioSaveStatus | null;
  node?: RadioNode | null;
  answer?: { segments: RadioAnswerSegment[] } | null;
  parsed?: RadioParsed | null;
  notice?: RadioNotice | null;
  profile: RadioListenerProfile;
  listen_window_ms?: number | null;
  degraded?: { node: string; reason: string }[];
  ai_calls_used: number;
}

export interface RadioTurnInput {
  kind: 'choice' | 'text' | 'command';
  choice_id?: string | null;
  text?: string | null;
  command?: string | null;
  /** `no_response` with `command: 'pause'`: the second silence at a choice point (two-strike rule). */
  reason?: string | null;
  position?: RadioPosition | null;
}

/** The sentence that was playing when the user spoke: `{seq, offset_ms?}`. */
export interface RadioPosition {
  seq: number;
  offset_ms?: number;
}

export interface RadioRenderAudio {
  render_id: string;
  voice_id: string;
  segments: { seq: number; audio_url?: string | null; duration_ms?: number | null; pending: boolean }[];
  choices: { choice_id: string; audio_url?: string | null }[];
}

export interface RadioProgramSegment {
  seq: number;
  lang: 'en' | 'zh';
  text: string;
  start_ms?: number | null;
  end_ms?: number | null;
  audio_url?: string | null;
}

export interface RadioProgramDetail {
  program_id: string;
  kind: string;
  series?: string | null;
  title?: string | null;
  tags?: string[];
  band: string;
  voice_id: string;
  duration_ms: number;
  segments: RadioProgramSegment[];
  my_rating?: RadioMyRating | null;
}

/** `POST programs/{program_id}/ask` and `/ask/audio` (personal-radio.md, Data · A program). */
export interface RadioProgramAskResponse {
  request_id: string;
  answer?: { segments: RadioAnswerSegment[] } | null;
  parsed?: RadioParsed | null;
  notice?: RadioNotice | null;
  degraded?: { node: string; reason: string }[];
  ai_calls_used: number;
}

/** `GET bgm` (Data): a background music track; `audio_url` is signed for 15 minutes. */
export interface RadioBgmTrack {
  track_id: string;
  title: string;
  mood?: string | null;
  audio_url?: string | null;
}

/** `GET saves/{save_id}/replay` (Data · Replay and deleting). */
export interface RadioReplaySegment {
  seq: number;
  lang?: string | null;
  text?: string | null;
  audio_url?: string | null;
  duration_ms?: number | null;
}

export interface RadioReplayStep {
  step: number;
  node_id: string;
  node_type?: 'narration' | 'choice' | 'ending' | null;
  segments: RadioReplaySegment[];
  chosen?: { choice_id: string; key?: 'A' | 'B' | 'C' | null; label?: string | null; via?: 'tap' | 'voice' | null } | null;
  undone: boolean;
  at?: string | null;
  ending?: RadioEnding | null;
  /** The key phrases of that part, as heard. */
  glossary?: RadioGlossaryItem[];
}

export interface RadioReplay {
  save_id: string;
  story_id?: string | null;
  title?: string | null;
  status: string;
  steps: RadioReplayStep[];
  my_rating?: RadioMyRating | null;
}

/** `POST events` (Data · Playback events). Payload keys are fixed per kind; never free text. */
export type RadioEventKind =
  | 'radio_interrupted'
  | 'radio_summary_shown'
  | 'node_finished'
  | 'replay'
  | 'speed_changed'
  | 'ttfa'
  | 'program_finished'
  | 'player_left';

export interface RadioClientEvent {
  client_event_id: string;
  kind: RadioEventKind;
  save_id?: string | null;
  program_id?: string | null;
  payload?: Record<string, string | number | boolean | null> | null;
}

export interface RadioEventsResponse {
  accepted: number;
  duplicates: number;
  rejected: { index: number; reason: string }[];
}
