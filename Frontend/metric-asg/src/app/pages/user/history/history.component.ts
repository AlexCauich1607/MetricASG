import { Component, ChangeDetectionStrategy } from '@angular/core';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationHistory } from '../../../models/history_evaluations';
import { DatePipe } from '@angular/common';
import { AmbitCardComponent } from '../../../shared/ambit-card/ambit-card.component';
import { Router } from '@angular/router';
import { EvaluationDashboard } from '../../../models/evaluation_dashboard';
import {
  buildHistoricalChart,
  HistoricalDashboardChart
} from '../../../models/evaluation_dashboard_chart';
import { HistoricalTrendChartComponent } from '../../../shared/historical-trend-chart/historical-trend-chart.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    AmbitCardComponent,
    DatePipe,
    HistoricalTrendChartComponent
  ],
  templateUrl: './history.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './history.component.scss'
})
export class HistoryComponent {
  historial: EvaluationHistory | null = null;
  evaluationId1: number | null = null;
  evaluationId2: number | null = null;
  improvementEvaluationId: number | null = null;
  dashboard: EvaluationDashboard | null = null;
  latestEvaluation: EvaluationDashboard['history'][number] | null = null;

  globalTrend: HistoricalDashboardChart = {
    labels: [],
    datasets: []
  };

  ambitTrends: {
    id: number;
    name: string;
    chart: HistoricalDashboardChart;
  }[] = [];

  constructor(
    private historyService: EvaluationService,
    private router: Router
  ) { }
  ngOnInit(): void {
    this.loadHistory();
    this.loadHistoricalDashboard();
  }
  loadHistoricalDashboard(): void {
    this.historyService.getHistoricalDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.latestEvaluation =
          dashboard.history.at(-1) ?? null;
        this.globalTrend = buildHistoricalChart(dashboard);

        const ambits = new Map<number, string>();

        dashboard.history.forEach(evaluation => {
          evaluation.ambits.forEach(ambit => {
            if (!ambits.has(ambit.ambit_id)) {
              ambits.set(
                ambit.ambit_id,
                ambit.ambit_name ?? `Ámbito ${ambit.ambit_id}`
              );
            }
          });
        });

        this.ambitTrends = Array.from(ambits, ([id, name]) => ({
          id,
          name,
          chart: buildHistoricalChart(dashboard, id)
        }));
      },
      error: (error) => {
        console.error('Error al cargar el dashboard histórico', error);
      }
    });
  }
  getLetter(id: number): string {
    return this.historial?.averages?.ambits.find(
      ambit => ambit.ambit_id === id
    )?.letter ?? '';
  }
  getColor(id: number): string {
    return this.historial?.averages?.ambits.find(
      ambit => ambit.ambit_id === id
    )?.ambit_color ?? '';
  }
  loadHistory(): void {
    this.historyService.getEvaluationHistory().subscribe({
      next: (value) => {
        this.historial = value;
      },
      error: (error) => {
        console.error('Error al cargar el historial', error);
      }
    });
  }

  get hasComparableTrend(): boolean {
    return this.dashboard?.history.some(
      evaluation => evaluation.global_delta !== null
    ) ?? false;
  }

  get canCompare(): boolean {
    return (
      this.evaluationId1 !== null &&
      this.evaluationId2 !== null &&
      this.evaluationId1 !== this.evaluationId2
    );
  }

  compareEvaluations(): void {
    if (!this.canCompare) {
      return;
    }

    this.router.navigate(['/user/compare'], {
      queryParams: {
        evaluation_id_1: this.evaluationId1,
        evaluation_id_2: this.evaluationId2
      }
    });
  }
  openImprovementPlan(evaluationId: number): void {
    if (!Number.isSafeInteger(evaluationId) || evaluationId <= 0) {
      return;
    }

    this.router.navigate([
      '/user/evaluations',
      evaluationId,
      'improvement-plan'
    ]);
  }
}
