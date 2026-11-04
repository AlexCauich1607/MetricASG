import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AsgReportService } from './asg-report.service';
import { EvaluationService } from './evaluation.service';
import { ImprovementActionService } from './improvement-action.service';
import { UserService } from './user.service';

import { User } from '../models/user';
import { ResultEvaluation } from '../models/evaluation_result';
import { EvaluationHistory } from '../models/history_evaluations';
import { EvaluationComparison } from '../models/evaluation_comparison';
import { ImprovementProgress } from '../models/improvement_progress';

describe('AsgReportService', () => {
  let service: AsgReportService;

  let evaluationService: jasmine.SpyObj<EvaluationService>;
  let improvementService: jasmine.SpyObj<ImprovementActionService>;
  let userService: jasmine.SpyObj<UserService>;

  const company = {
    id: 1,
    company_name: 'Empresa Test'
  } as User;

  const evaluation: ResultEvaluation = {
    evaluation_id: 20,
    date: '2026-10-20',
    global_score: 8,
    global_maturity_level: 'Intermedio',
    ambits: []
  };

  const progress: ImprovementProgress = {
    evaluation_id: 20,
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    progress_percentage: 0
  };

  const comparison: EvaluationComparison = {
    comparable: true,
    warning: null,
    evaluations: [],
    differences: {
      global_score: 1,
      ambits: []
    }
  };

  function createHistory(
    entries: { evaluation_id: number; date: string }[]
  ): EvaluationHistory {
    return {
      history: entries.map(entry => ({
        ...entry,
        global_score: 8,
        ambits: []
      })),
      averages: {
        global_score: 8,
        ambits: []
      }
    };
  }

  beforeEach(() => {
    evaluationService = jasmine.createSpyObj(
      'EvaluationService',
      [
        'getEvaluationResultById',
        'getEvaluationHistory',
        'getEvaluationComparison'
      ]
    );

    improvementService = jasmine.createSpyObj(
      'ImprovementActionService',
      ['getActions', 'getProgressMetrics']
    );

    userService = jasmine.createSpyObj(
      'UserService',
      ['getMe']
    );

    TestBed.configureTestingModule({
      providers: [
        AsgReportService,
        {
          provide: EvaluationService,
          useValue: evaluationService
        },
        {
          provide: ImprovementActionService,
          useValue: improvementService
        },
        {
          provide: UserService,
          useValue: userService
        }
      ]
    });

    service = TestBed.inject(AsgReportService);

    userService.getMe.and.returnValue(of(company));

    evaluationService.getEvaluationResultById
      .and.returnValue(of(evaluation));

    improvementService.getActions.and.returnValue(of([]));
    improvementService.getProgressMetrics
      .and.returnValue(of(progress));
  });

  it('should consolidate report data with comparison', () => {
    evaluationService.getEvaluationHistory.and.returnValue(
      of(createHistory([
        { evaluation_id: 10, date: '2026-09-10' },
        { evaluation_id: 20, date: '2026-10-20' }
      ]))
    );

    evaluationService.getEvaluationComparison
      .and.returnValue(of(comparison));

    service.getReport(20).subscribe(report => {
      expect(report.company).toEqual(company);
      expect(report.evaluation).toEqual(evaluation);
      expect(report.comparison).toEqual(comparison);
      expect(report.improvement_actions).toEqual([]);
      expect(report.improvement_progress).toEqual(progress);
    });

    expect(
      evaluationService.getEvaluationResultById
    ).toHaveBeenCalledOnceWith(20);

    expect(
      evaluationService.getEvaluationComparison
    ).toHaveBeenCalledOnceWith(10, 20);
  });

  it('should return null comparison for first evaluation', () => {
    evaluationService.getEvaluationHistory.and.returnValue(
      of(createHistory([
        { evaluation_id: 20, date: '2026-10-20' }
      ]))
    );

    service.getReport(20).subscribe(report => {
      expect(report.comparison).toBeNull();
    });

    expect(
      evaluationService.getEvaluationComparison
    ).not.toHaveBeenCalled();
  });

  it('should select the previous evaluation chronologically', () => {
    evaluationService.getEvaluationHistory.and.returnValue(
      of(createHistory([
        { evaluation_id: 30, date: '2026-11-01' },
        { evaluation_id: 10, date: '2026-08-01' },
        { evaluation_id: 20, date: '2026-10-20' },
        { evaluation_id: 15, date: '2026-09-01' }
      ]))
    );

    evaluationService.getEvaluationComparison
      .and.returnValue(of(comparison));

    service.getReport(20).subscribe();

    expect(
      evaluationService.getEvaluationComparison
    ).toHaveBeenCalledOnceWith(15, 20);
  });

  it('should preserve an incompatible comparison warning', () => {
    const incompatible: EvaluationComparison = {
      comparable: false,
      warning: 'Las metodologías no son comparables.',
      evaluations: [],
      differences: null
    };

    evaluationService.getEvaluationHistory.and.returnValue(
      of(createHistory([
        { evaluation_id: 10, date: '2026-09-10' },
        { evaluation_id: 20, date: '2026-10-20' }
      ]))
    );

    evaluationService.getEvaluationComparison
      .and.returnValue(of(incompatible));

    service.getReport(20).subscribe(report => {
      expect(report.comparison).toEqual(incompatible);
      expect(report.comparison?.comparable).toBeFalse();
      expect(report.comparison?.differences).toBeNull();
    });
  });

  it('should propagate an evaluation retrieval error', () => {
    evaluationService.getEvaluationHistory.and.returnValue(
      of(createHistory([]))
    );

    evaluationService.getEvaluationResultById.and.returnValue(
      throwError(() => new Error('Evaluation unavailable'))
    );

    service.getReport(20).subscribe({
      next: () => fail('Expected retrieval error'),
      error: error => {
        expect(error.message).toBe('Evaluation unavailable');
      }
    });
  });

  it('should propagate an improvement actions error', () => {
    evaluationService.getEvaluationHistory.and.returnValue(
      of(createHistory([]))
    );

    improvementService.getActions.and.returnValue(
      throwError(() => new Error('Actions unavailable'))
    );

    service.getReport(20).subscribe({
      next: () => fail('Expected actions error'),
      error: error => {
        expect(error.message).toBe('Actions unavailable');
      }
    });
  });
});