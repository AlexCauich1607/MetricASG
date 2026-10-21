import { CanDeactivateFn } from '@angular/router';
import { EvaluationComponent } from '../../pages/user/evaluation/evaluation.component';

export const evaluationExitGuard: CanDeactivateFn<EvaluationComponent> = (
  component
) => component.canLeaveEvaluation();