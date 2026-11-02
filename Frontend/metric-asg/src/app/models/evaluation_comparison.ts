
export interface EvaluationComparisonAmbit {
  ambit_id: number;
  ambit_name: string | null;
  score: number;
}

export interface EvaluationComparisonResult {
  evaluation_id: number;
  date: string;
  methodology_id: number;
  methodology_version: string;
  global_score: number;
  ambits: EvaluationComparisonAmbit[];
}

export interface EvaluationComparisonAmbitDifference {
  ambit_id: number;
  ambit_name: string | null;
  delta: number;
}

export interface EvaluationComparisonDifferences {
  global_score: number;
  ambits: EvaluationComparisonAmbitDifference[];
}

export interface EvaluationComparison {
  comparable: boolean;
  warning: string | null;
  evaluations: EvaluationComparisonResult[];
  differences: EvaluationComparisonDifferences | null;
}
