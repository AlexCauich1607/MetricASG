import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  toObservable,
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';
import { CompanyContextService } from '../../../services/company-context.service';
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
  private historyRequest?: Subscription;
  private dashboardRequest?: Subscription;
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
    private router: Router,
    private companyContext: CompanyContextService,
    private destroyRef: DestroyRef
  ) {
    toObservable(this.companyContext.selectedCompanyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(companyId => {
        // Cancelar solicitudes de la empresa anterior.
        this.historyRequest?.unsubscribe();
        this.dashboardRequest?.unsubscribe();

        // Limpiar el historial, las gráficas y las selecciones.
        this.clearHistoryState();

        if (companyId === null) {
          return;
        }

        // Consultar los datos de la empresa seleccionada.
        this.loadHistory();
        this.loadHistoricalDashboard();
      });
  }

  ngOnInit(): void {
    this.loadHistory();
    this.loadHistoricalDashboard();
  }

  private clearHistoryState(): void {
    // Historial de evaluaciones
    this.historial = null;

    // Evaluaciones seleccionadas
    this.evaluationId1 = null;
    this.evaluationId2 = null;
    this.improvementEvaluationId = null;

    // Dashboard histórico
    this.dashboard = null;
    this.latestEvaluation = null;

    // Gráfica global
    this.globalTrend = {
      labels: [],
      datasets: []
    };

    // Gráficas por ámbito
    this.ambitTrends = [];
  }

  loadHistoricalDashboard(): void {
    this.dashboardRequest?.unsubscribe();

    this.dashboardRequest = this.historyService
      .getHistoricalDashboard()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    this.historyRequest?.unsubscribe();

    this.historyRequest = this.historyService
      .getEvaluationHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
