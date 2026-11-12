export interface BenchmarkAmbit {
  ambit_id: number;
  name: string;
  letter: string | null;
  average: number;
}

export interface BenchmarkResult {
  available: boolean;
  methodology_id: number;
  global_average: number | null;
  ambits: BenchmarkAmbit[];
}

export interface BenchmarkComparison {
  ambit_id: number;
  name: string;
  letter: string | null;
  companyScore: number;
  benchmarkAverage: number;
  difference: number;
}
