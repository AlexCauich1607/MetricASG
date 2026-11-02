
export type EvidenceType = 'COMMENT' | 'URL' | 'FILE';

export type TextEvidenceType = 'COMMENT' | 'URL';

export interface EvaluationEvidence {
  id: number;
  evaluation_id: number;
  indicator_id: number;
  type: EvidenceType;
  content: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceCreateRequest {
  indicator_id: number;
  type: TextEvidenceType;
  content: string;
}
