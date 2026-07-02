/** Contract shapes for KAZI-32 / MI-W3 — aligned with OpenAPI draft (KAZI-35). */

export interface InterviewPrepCard {
  focus_areas?: string[];
  sample_questions?: string[];
  estimated_duration_min?: number;
  primary_cta?: string;
  job_title?: string;
}
