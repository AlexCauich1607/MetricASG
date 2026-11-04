export interface ImprovementProgress {
  evaluation_id: number;
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  progress_percentage: number;
}
