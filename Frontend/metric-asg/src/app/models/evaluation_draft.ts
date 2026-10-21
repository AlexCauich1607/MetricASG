import { EvaluationSubmitPayload } from './evaluation_submit';

export interface EvaluationDraft extends EvaluationSubmitPayload {
  evaluation_id: number;
  status: 'draft';
}