/** Contract shapes for KAZI-33 / KAZI-35 OpenAPI (api_schemas.CvDiffPayload). */

export interface CvDiffChange {
  path: string;
  before?: string;
  after?: string;
}

export interface CvDiffPayload {
  added?: string[];
  removed?: string[];
  modified?: CvDiffChange[];
}
