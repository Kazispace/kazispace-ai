export type SessionLibraryFile = {
  file_id: string;
  name: string;
  mime_type?: string | null;
  agent_id?: string | null;
  session_id?: string | null;
  session_title?: string | null;
  hub_segment?: string | null;
  updated_at?: string | null;
  size_bytes?: number | null;
};

export type SessionLibrarySearchHit = {
  hit_id: string;
  type: 'session' | 'file' | 'message';
  title: string;
  snippet?: string | null;
  agent_id?: string | null;
  session_id?: string | null;
  hub_segment?: string | null;
};

export type SessionLibraryFilesResponse = {
  files: SessionLibraryFile[];
};

export type SessionLibrarySearchResponse = {
  hits: SessionLibrarySearchHit[];
};

export type SessionMessageSearchHit = {
  message_id: string;
  role: string;
  snippet: string;
};
