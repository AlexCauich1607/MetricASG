export interface EvaluationSubmitPayload {
  user_id: number;
  responses: {
    indicator_id: number;
    maturity_level_id: number;
  }[];
}