/** Hub grid cell = one openable file (SSOT: kazispace-design workspace-asset-rail-v2 §3.1). */

export type WorkspaceAssetCategory = 'resume' | 'english' | 'interview';

export type WorkspaceAssetMime = 'application/pdf' | 'text/markdown';

export type WorkspaceAssetVariant =
  | 'source_md'
  | 'export_pdf'
  | 'readiness_report'
  | 'mock_scorecard'
  | 'speaking_scorecard';

export type WorkspaceAssetIndexingStatus = 'ready' | 'pending' | 'failed';

export type WorkspaceAssetScope = 'user' | 'space';

export interface WorkspaceAssetProvenance {
  core_asset_id?: string;
  asset_version_id?: string;
  file_id?: string;
  space_id?: string | null;
  session_id?: string | null;
  agent_id?: string | null;
  job_id?: string | null;
}

export interface WorkspaceAsset {
  asset_id: string;
  category: WorkspaceAssetCategory;
  display_name: string;
  subtitle?: string | null;
  mime_type: WorkspaceAssetMime;
  variant: WorkspaceAssetVariant;
  indexing_status: WorkspaceAssetIndexingStatus;
  preview_url?: string | null;
  download_url: string;
  updated_at: string;
  is_current: boolean;
  logical_key: string;
  provenance?: WorkspaceAssetProvenance;
}

export interface WorkspaceAssetCategoryCounts {
  resume: number;
  english: number;
  interview: number;
}

export interface WorkspaceAssetsResponse {
  items: WorkspaceAsset[];
  categories: WorkspaceAssetCategoryCounts;
  history_counts: WorkspaceAssetCategoryCounts;
}

export interface WorkspaceAssetDetail extends WorkspaceAsset {
  /** Inline MD body when mime is text/markdown. */
  content?: string | null;
}

export interface FetchWorkspaceAssetsParams {
  scope?: WorkspaceAssetScope;
  spaceId?: string;
  category?: WorkspaceAssetCategory;
  includeHistory?: boolean;
}
