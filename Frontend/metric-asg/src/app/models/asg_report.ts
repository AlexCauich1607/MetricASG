import { ResultEvaluation } from './evaluation_result';
import { EvaluationComparison } from './evaluation_comparison';
import { ImprovementAction } from './improvement_action';
import { ImprovementProgress } from './improvement_progress';

export interface AsgReportCompany {
  id: number;
  name: string;
}

export interface AsgReport {
  company: AsgReportCompany;
  evaluation: ResultEvaluation;
  comparison: EvaluationComparison | null;
  improvement_actions: ImprovementAction[];
  improvement_progress: ImprovementProgress;
}