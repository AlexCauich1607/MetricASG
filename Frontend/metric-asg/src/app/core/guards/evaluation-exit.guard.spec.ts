import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';

import { evaluationExitGuard } from './evaluation-exit.guard';

import { EvaluationComponent } from
  '../../pages/user/evaluation/evaluation.component';

describe('evaluationExitGuard', () => {
  let component: jasmine.SpyObj<EvaluationComponent>;

  let currentRoute: ActivatedRouteSnapshot;
  let currentState: RouterStateSnapshot;
  let nextState: RouterStateSnapshot;

  beforeEach(() => {
    component = jasmine.createSpyObj<EvaluationComponent>(
      'EvaluationComponent',
      ['canLeaveEvaluation']
    );

    currentRoute = {} as ActivatedRouteSnapshot;

    currentState = {
      url: '/user/evaluation'
    } as RouterStateSnapshot;

    nextState = {
      url: '/user/home'
    } as RouterStateSnapshot;
  });

  it('should allow navigation when the evaluation permits leaving', () => {
    component.canLeaveEvaluation.and.returnValue(true);

    const result = evaluationExitGuard(
      component,
      currentRoute,
      currentState,
      nextState
    );

    expect(result).toBeTrue();

    expect(component.canLeaveEvaluation)
      .toHaveBeenCalledTimes(1);
  });

  it('should block navigation when the evaluation prevents leaving', () => {
    component.canLeaveEvaluation.and.returnValue(false);

    const result = evaluationExitGuard(
      component,
      currentRoute,
      currentState,
      nextState
    );

    expect(result).toBeFalse();

    expect(component.canLeaveEvaluation)
      .toHaveBeenCalledTimes(1);
  });

  it('should reevaluate the exit condition on each navigation attempt', () => {
    component.canLeaveEvaluation.and.returnValues(
      false,
      true
    );

    const firstAttempt = evaluationExitGuard(
      component,
      currentRoute,
      currentState,
      nextState
    );

    const secondAttempt = evaluationExitGuard(
      component,
      currentRoute,
      currentState,
      nextState
    );

    expect(firstAttempt).toBeFalse();
    expect(secondAttempt).toBeTrue();

    expect(component.canLeaveEvaluation)
      .toHaveBeenCalledTimes(2);
  });
});