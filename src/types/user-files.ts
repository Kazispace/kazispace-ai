/** Backend file category constants (KAZI-203 files/constants.py) */
export type FileCategory =
  | 'cv/uploads'
  | 'cv/generated'
  | 'documents'
  | 'interview/audio'
  | 'scratch';

/** Optional metadata written by BE integrations (duration_sec, cv_document_id, …). */
export type UserFileMeta = {
  duration_sec?: number;
  interview_session_id?: string;
  question_idx?: number;
  cv_document_id?: number;
  version_number?: number;
  [key: string]: unknown;
};

export interface UserFile {
  file_id: string;
  filename: string;
  category: FileCategory;
  mime_type: string;
  size_bytes: number;
  tier: 'asset' | 'agent_output' | 'scratch';
  space_id?: string | null;
  download_url?: string | null;
  created_at: string;
  /** Present when BE list/detail includes UserFile.meta (KAZI-207 audio, KAZI-206 CV). */
  meta?: UserFileMeta | null;
}

export interface UserFileListResponse {
  items: UserFile[];
  total: number;
  has_more: boolean;
}

export interface UserFileUrlResponse {
  file_id: string;
  download_url: string;
  expires_in: number;
}
