export interface MaturityLevel {
  id?: number;
  name: string;
  value: number;
  min_score: number;
  max_score: number;
  is_removable: boolean;
  color: string;

}
