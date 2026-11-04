
export type ImprovementPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH';

export type ImprovementStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ImprovementAction {
  id: number;
  evaluation_id: number;
  indicator_id: number | null;

  gap_description: string;
  description: string;

  priority: ImprovementPriority;
  responsible: string;
  target_date: string;

  status: ImprovementStatus;

  created_at: string;
  updated_at: string;
}

export interface ImprovementActionCreate {
  indicator_id?: number | null;

  gap_description: string;
  description: string;

  priority?: ImprovementPriority;
  responsible: string;
  target_date: string;
}

export interface ImprovementActionUpdate {
  indicator_id?: number | null;

  gap_description?: string;
  description?: string;

  priority?: ImprovementPriority;
  responsible?: string;
  target_date?: string;

  status?: ImprovementStatus;
}
