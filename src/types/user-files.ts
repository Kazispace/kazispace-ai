/** Backend file category constants (KAZI-203 files/constants.py) */
export type FileCategory =
  | 'cv/uploads'
  | 'cv/generated'
  | 'documents'
  | 'interview/audio'
  | 'scratch';

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
