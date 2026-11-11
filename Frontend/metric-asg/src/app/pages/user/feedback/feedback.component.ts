
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  effect,
  inject
} from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, switchMap, catchError, tap } from 'rxjs';

import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { CompanyContextService } from '../../../services/company-context.service';
import { FeedbackComponent as FeedbackCardComponent } from '../../../shared/feedback/feedback.component';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    FeedbackCardComponent
  ],
  templateUrl: './feedback.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './feedback.component.scss'
})
export class FeedbackComponent {
  private readonly evaluationService = inject(EvaluationService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly destroyRef = inject(DestroyRef);

  results: ResultEvaluation | null = null;

  constructor() {
    toObservable(this.companyContext.selectedCompanyId)
      .pipe(
        tap(() => {
          this.results = null;
        }),
        switchMap(companyId => {
          if (companyId === null) {
            return EMPTY;
          }

          return this.evaluationService.getLastEvaluationResult()
            .pipe(
              catchError(error => {
                console.error(error);
                return EMPTY;
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(results => {
        this.results = results;
      });
  }
}
