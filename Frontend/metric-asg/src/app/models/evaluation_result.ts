export interface ResultAmbit {
  ambit_id: number;
  ambit_name: string;
  score: number;
  letter: string;
  color: string;
  maturity_level: string;
  maturity_color: string;
  feedback: string;
}

export interface ResultEvaluation {
  evaluation_id: number;
  date: string;
  global_score: number;
  global_maturity_level: string;
  ambits: ResultAmbit[];
}
