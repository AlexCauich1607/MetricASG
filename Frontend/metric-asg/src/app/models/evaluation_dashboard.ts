
export interface EvaluationDashboardAmbit {
  ambit_id: number;
  ambit_name: string | null;
  score: number | null;
  delta: number | null;
}

export interface EvaluationDashboardHistory {
  evaluation_id: number;
  date: string | null;
  methodology_id: number;
  methodology_version: string;
  global_score: number | null;
  global_delta: number | null;
  ambits: EvaluationDashboardAmbit[];
}

export interface EvaluationDashboard {
  history: EvaluationDashboardHistory[];
}
