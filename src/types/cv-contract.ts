/** Contract shapes for KAZI-33 / TR-V02-05 — aligned with OpenAPI draft (KAZI-35). */

export interface CvDiffSection {
  section: string;
  text?: string;
  before?: string;
  after?: string;
}

export interface CvDiffPayload {
  added?: CvDiffSection[];
  removed?: CvDiffSection[];
  modified?: CvDiffSection[];
}
