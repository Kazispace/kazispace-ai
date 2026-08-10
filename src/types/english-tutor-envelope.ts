/** english_tutor Cap envelope custom_components (KAZI-502 / Cap SDD §6). */

export type EnglishTutorConfidence = 'low' | 'medium' | 'high';

export interface ExamPickerOption {
  id: string;
  label: string;
  description?: string;
}

export interface ExamPickerComponent {
  type: 'exam_picker';
  options: ExamPickerOption[];
  selected_id?: string | null;
}

export interface EssayPromptComponent {
  type: 'essay_prompt';
  prompt_id: string;
  title: string;
  body: string;
  word_limit?: number | null;
  exam_type?: string | null;
  /** When true, show AI-synthetic disclaimer (AC-X4). */
  ai_synthetic?: boolean;
  provenance?: string | null;
}

export interface EssaySpanIssue {
  start: number;
  end: number;
  category: string;
  message: string;
  rewrite_example?: string | null;
}

export interface EssayDiffComponent {
  type: 'essay_diff';
  original: string;
  rewrite?: string | null;
  issues: EssaySpanIssue[];
}

export interface ScoreDimension {
  key: string;
  label?: string | null;
  score: number;
  max?: number | null;
}

export interface WritingScorecardComponent {
  type: 'writing_scorecard';
  overall?: number | null;
  dimensions: ScoreDimension[];
  summary?: string | null;
  /** When true, show optional in-component revise CTA. */
  show_revise_cta?: boolean;
}

export interface SpeakingRadarComponent {
  type: 'speaking_radar';
  dimensions: ScoreDimension[];
  summary?: string | null;
}

export interface ModelAnswerComponent {
  type: 'model_answer';
  text: string;
  audio_url?: string | null;
}

export interface ProgressSummaryItem {
  label: string;
  value: string;
}

export interface ProgressSummaryComponent {
  type: 'progress_summary';
  items: ProgressSummaryItem[];
}

export type EnglishTutorEnvelopeComponent =
  | ExamPickerComponent
  | EssayPromptComponent
  | EssayDiffComponent
  | WritingScorecardComponent
  | SpeakingRadarComponent
  | ModelAnswerComponent
  | ProgressSummaryComponent;
