import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  inject,
  signal
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { CompanyContextService } from '../../../services/company-context.service';
import { EvaluationService } from '../../../services/evaluation.service';
import { BenchmarkService } from '../../../services/benchmark.service';
import {
  BenchmarkComparison,
  BenchmarkResult
} from '../../../models/benchmark';
import {
  EvaluationDashboard,
  EvaluationDashboardHistory
} from '../../../models/evaluation_dashboard';

interface BenchmarkViewState {
  loading: boolean;
  error: string | null;
  available: boolean;
  methodologyVersion: string | null;
  companyScore: number | null;
  benchmarkAverage: number | null;
  globalDifference: number | null;
  comparisons: BenchmarkComparison[];
}

@Component({
  selector: 'app-benchmark',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './benchmark.component.html',
  styleUrl: './benchmark.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BenchmarkComponent {
  private readonly companyContext = inject(CompanyContextService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly benchmarkService = inject(BenchmarkService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly state = signal<BenchmarkViewState>(this.emptyState());
  readonly Math = Math;

  constructor() {
    toObservable(this.companyContext.selectedCompanyId, {
      injector: this.injector
    })
      .pipe(
        switchMap(companyId => {
          if (companyId === null) {
            return of(this.emptyState());
          }

          return this.evaluationService.getHistoricalDashboard().pipe(
            switchMap(dashboard => {
              const latest = this.getLatestEvaluation(dashboard);

              if (!latest) {
                return of({
                  ...this.emptyState(),
                  error: 'No hay evaluaciones finalizadas disponibles.'
                });
              }

              return this.benchmarkService
                .getBenchmark(latest.methodology_id)
                .pipe(
                  map(result => this.buildViewState(latest, result))
                );
            }),
            startWith({
              ...this.emptyState(),
              loading: true
            }),
            catchError(() => of({
              ...this.emptyState(),
              error: 'No se pudo cargar el benchmarking.'
            }))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(state => this.state.set(state));
  }

  private getLatestEvaluation(
    dashboard: EvaluationDashboard
  ): EvaluationDashboardHistory | null {
    const eligible = dashboard.history
      .filter(item => item.global_score !== null);

    return eligible.reduce<EvaluationDashboardHistory | null>(
      (latest, current) =>
        !latest || current.evaluation_id > latest.evaluation_id
          ? current
          : latest,
      null
    );
  }

  private buildViewState(
    evaluation: EvaluationDashboardHistory,
    benchmark: BenchmarkResult
  ): BenchmarkViewState {
    if (!benchmark.available || benchmark.global_average === null) {
      return {
        ...this.emptyState(),
        methodologyVersion: evaluation.methodology_version
      };
    }

    const companyScore = evaluation.global_score!;

    const comparisons: BenchmarkComparison[] = benchmark.ambits
      .flatMap(ambit => {
        const ownAmbit = evaluation.ambits.find(
          item => item.ambit_id === ambit.ambit_id
        );

        if (!ownAmbit || ownAmbit.score === null) {
          return [];
        }

        return [{
          ambit_id: ambit.ambit_id,
          name: ambit.name,
          letter: ambit.letter,
          companyScore: ownAmbit.score,
          benchmarkAverage: ambit.average,
          difference: ownAmbit.score - ambit.average
        }];
      });

    return {
      loading: false,
      error: null,
      available: true,
      methodologyVersion: evaluation.methodology_version,
      companyScore,
      benchmarkAverage: benchmark.global_average,
      globalDifference: companyScore - benchmark.global_average,
      comparisons
    };
  }

  private emptyState(): BenchmarkViewState {
    return {
      loading: false,
      error: null,
      available: false,
      methodologyVersion: null,
      companyScore: null,
      benchmarkAverage: null,
      globalDifference: null,
      comparisons: []
    };
  }
}
