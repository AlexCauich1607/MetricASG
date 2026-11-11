export interface EvaluationSubmitPayload {
  company_id?: number;

  responses: {
    indicator_id: number;
    indicator_answer_id: number;
  }[];
}
