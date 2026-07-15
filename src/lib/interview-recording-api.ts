/**
 * Interview recording list — wraps the unified file API filtered by
 * interview/audio category. Score/transcript come from session metadata
 * when available; the file API provides audio URLs.
 */
import { fetchUserFiles, getFileDownloadUrl } from '@/lib/file-api';
import type { ApiResponse } from '@/types';
import type { UserFile } from '@/types/user-files';

export interface InterviewRecording {
  file_id: string;
  session_title: string;
  filename: string;
  size_bytes: number;
  duration_seconds: number;
  score?: number | null;
  category_scores?: Record<string, number> | null;
  ai_feedback?: string | null;
  created_at: string;
  audio_url?: string;
  transcript?: TranscriptEntry[] | null;
}

export interface TranscriptEntry {
  timestamp: number;
  speaker: 'interviewer' | 'user';
  text: string;
}

export interface RecordingListResponse {
  recordings: InterviewRecording[];
}

function fileToRecording(file: UserFile): InterviewRecording {
  return {
    file_id: file.file_id,
    session_title: file.filename.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
    filename: file.filename,
    size_bytes: file.size_bytes,
    duration_seconds: 0,
    score: null,
    category_scores: null,
    ai_feedback: null,
    created_at: file.created_at,
    audio_url: file.download_url ?? undefined,
    transcript: null,
  };
}

export async function fetchInterviewRecordings(): Promise<
  ApiResponse<RecordingListResponse>
> {
  const res = await fetchUserFiles('interview/audio');
  if (res.success && res.data) {
    return {
      success: true,
      data: { recordings: res.data.items.map(fileToRecording) },
    };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function getRecordingAudioUrl(
  fileId: string
): Promise<ApiResponse<{ audio_url: string }>> {
  const res = await getFileDownloadUrl(fileId);
  if (res.success && res.data) {
    return { success: true, data: { audio_url: res.data.download_url } };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}
