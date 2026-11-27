
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

import { ResultEvaluation } from
  '../../../models/evaluation_result';

import { EvaluationService } from
  '../../../services/evaluation.service';

import { CompanyContextService } from
  '../../../services/company-context.service';

import {
  FeedbackComponent as FeedbackCardComponent
} from '../../../shared/feedback/feedback.component';

type FeedbackStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error';

interface FeedbackState {
  companyId: number | null;
  status: FeedbackStatus;
  results: ResultEvaluation | null;
}

@Component({
  selector: 'app-feedback',
  standalone: true,

  imports: [
    DatePipe,
    FeedbackCardComponent
  ],

  templateUrl: './feedback.component.html',
  styleUrl: './feedback.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackComponent {

  private readonly evaluationService =
    inject(EvaluationService);

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly router = inject(Router);

  private readonly destroyRef = inject(DestroyRef);

  private readonly retryVersion = signal(0);

  private readonly feedbackState =
    signal<FeedbackState>({
      companyId: null,
      status: 'loading',
      results: null
    });

  readonly state = computed<FeedbackState>(() => {

    const companyId =
      this.companyContext.selectedCompanyId();

    const currentState = this.feedbackState();

    if (currentState.companyId !== companyId) {

      return {
        companyId,
        status: companyId === null
          ? 'empty'
          : 'loading',
        results: null
      };

    }

    return currentState;

  });

  readonly results = computed(
    () => this.state().results
  );

  readonly canOpenPlan = computed(() => {

    const evaluationId =
      this.results()?.evaluation_id;

    return (
      this.state().status === 'ready' &&
      evaluationId !== undefined &&
      Number.isSafeInteger(evaluationId) &&
      evaluationId > 0
    );

  });

  constructor() {

    combineLatest([
      toObservable(
        this.companyContext.selectedCompanyId
      ),
      toObservable(this.retryVersion)
    ]).pipe(

      switchMap(([companyId]) => {

        if (companyId === null) {

          return of<FeedbackState>({
            companyId,
            status: 'empty',
            results: null
          });

        }

        return this.evaluationService
          .getLastEvaluationResult()
          .pipe(

            map((results): FeedbackState => ({
              companyId,
              status: results ? 'ready' : 'empty',
              results: results ?? null
            })),

            startWith<FeedbackState>({
              companyId,
              status: 'loading',
              results: null
            }),

            catchError(error => {

              if (error.status !== 404) {
                console.error(
                  'Error al cargar recomendaciones:',
                  error
                );
              }

              return of<FeedbackState>({
                companyId,
                status: error.status === 404
                  ? 'empty'
                  : 'error',
                results: null
              });

            })

          );

      }),

      takeUntilDestroyed(this.destroyRef)

    ).subscribe(state => {

      this.feedbackState.set(state);

    });

  }

  retry(): void {

    this.retryVersion.update(
      version => version + 1
    );

  }

  openPlan(): void {

    const evaluationId =
      this.results()?.evaluation_id;

    if (
      !this.canOpenPlan() ||
      evaluationId === undefined
    ) {
      return;
    }

    void this.router.navigate([
      '/user/improvement/plan',
      evaluationId
    ]);

  }

  goToHome(): void {

    void this.router.navigate([
      '/user/home'
    ]);

  }

}
