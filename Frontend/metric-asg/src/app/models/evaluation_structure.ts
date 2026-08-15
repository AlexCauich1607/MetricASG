export interface EvaluationStructure {
  ambits: EvaluationAmbit[];
}

export interface EvaluationAmbit {
  id: number;
  name: string;
  color: string;
  letter: string;
  indicators: EvaluationIndicator[];
}

export interface EvaluationIndicator {
  id: number;
  question: string;
  answers: EvaluationIndicatorAnswer[];
}

export interface EvaluationIndicatorAnswer {
  maturity_level_id: number;
  text: string;
}
