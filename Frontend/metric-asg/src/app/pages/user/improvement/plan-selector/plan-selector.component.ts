
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';

import {
  toObservable,
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

import {
  catchError,
  combineLatest,
  map,
  of,
  startWith,
  switchMap
} from 'rxjs';

import { EvaluationService } from
  '../../../../services/evaluation.service';

import { CompanyContextService } from
  '../../../../services/company-context.service';

import { EvaluationHistory } from
  '../../../../models/history_evaluations';


type HistoryItem =
  EvaluationHistory['history'][number];


interface PlanSelectorState {

  companyId: number | null;

  loading: boolean;

  error: boolean;

  evaluations: HistoryItem[];

}


@Component({

  selector: 'app-plan-selector',

  standalone: true,

  imports: [DatePipe],

  templateUrl: './plan-selector.component.html',

  styleUrl: './plan-selector.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush

})
export class PlanSelectorComponent {

  private readonly evaluationService =
    inject(EvaluationService);

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly router = inject(Router);

  private readonly destroyRef = inject(DestroyRef);

  private readonly retryVersion = signal(0);


  private readonly selection = signal<number | null>(null);


  private readonly selectorState =
    signal<PlanSelectorState>({

      companyId: null,

      loading: false,

      error: false,

      evaluations: []

    });


  readonly state = computed<PlanSelectorState>(() => {

    const companyId =
      this.companyContext.selectedCompanyId();

    const currentState =
      this.selectorState();

    if (currentState.companyId !== companyId) {

      return {

        companyId,

        loading: companyId !== null,

        error: false,

        evaluations: []

      };

    }

    return currentState;

  });


  readonly selectedEvaluationId = computed(() => {

    const evaluationId = this.selection();

    if (
      evaluationId === null ||
      !this.isValidEvaluationId(evaluationId)
    ) {

      return null;

    }

    return this.state().evaluations.some(
      evaluation =>
        evaluation.evaluation_id === evaluationId
    )
      ? evaluationId
      : null;

  });


  constructor() {

    combineLatest([

      toObservable(
        this.companyContext.selectedCompanyId
      ),

      toObservable(this.retryVersion)

    ]).pipe(

      switchMap(([companyId]) => {

        this.selection.set(null);

        if (companyId === null) {

          return of<PlanSelectorState>({

            companyId,

            loading: false,

            error: false,

            evaluations: []

          });

        }

        return this.evaluationService
          .getEvaluationHistory()
          .pipe(

            map((history): PlanSelectorState => ({

              companyId,

              loading: false,

              error: false,

              evaluations: [...history.history]

                .filter(evaluation =>
                  this.isValidEvaluationId(
                    evaluation.evaluation_id
                  )
                )

                .sort((a, b) =>

                  b.date.localeCompare(a.date) ||

                  b.evaluation_id - a.evaluation_id

                )

            })),

            startWith<PlanSelectorState>({

              companyId,

              loading: true,

              error: false,

              evaluations: []

            }),

            catchError(() =>

              of<PlanSelectorState>({

                companyId,

                loading: false,

                error: true,

                evaluations: []

              })

            )

          );

      }),

      takeUntilDestroyed(this.destroyRef)

    ).subscribe(state => {

      this.selectorState.set(state);

      this.selection.set(
        state.evaluations[0]?.evaluation_id ?? null
      );

    });

  }


  private isValidEvaluationId(
    evaluationId: number
  ): boolean {

    return Number.isSafeInteger(evaluationId) &&
      evaluationId > 0;

  }


  selectEvaluation(value: string): void {

    const evaluationId = Number(value);

    const valid =

      this.isValidEvaluationId(evaluationId) &&

      this.state().evaluations.some(
        evaluation =>
          evaluation.evaluation_id === evaluationId
      );

    this.selection.set(
      valid ? evaluationId : null
    );

  }


  retry(): void {

    if (
      this.companyContext.selectedCompanyId() === null
    ) {

      return;

    }

    this.retryVersion.update(
      version => version + 1
    );

  }


  openPlan(): void {

    const state = this.state();

    const evaluationId =
      this.selectedEvaluationId();

    if (

      state.loading ||

      state.error ||

      state.companyId === null ||

      state.companyId !==
        this.companyContext.selectedCompanyId() ||

      evaluationId === null ||

      !this.isValidEvaluationId(evaluationId)

    ) {

      return;

    }

    void this.router.navigate([

      '/user/improvement/plan',

      evaluationId

    ]);

  }

}
