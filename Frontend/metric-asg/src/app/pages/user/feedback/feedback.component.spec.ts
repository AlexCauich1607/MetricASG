
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject } from 'rxjs';

import { FeedbackComponent } from './feedback.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { CompanyContextService } from '../../../services/company-context.service';
import { ResultEvaluation } from '../../../models/evaluation_result';

describe('FeedbackComponent', () => {
  let component: FeedbackComponent;
  let fixture: ComponentFixture<FeedbackComponent>;

  let evaluationService: jasmine.SpyObj<EvaluationService>;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;

  beforeEach(async () => {
    selectedCompanyId = signal<number | null>(null);

    evaluationService = jasmine.createSpyObj<EvaluationService>(
      'EvaluationService',
      ['getLastEvaluationResult']
    );

    evaluationService.getLastEvaluationResult.and.returnValue(of(
      {} as ResultEvaluation
    ));

    await TestBed.configureTestingModule({
      imports: [FeedbackComponent],
      providers: [
        {
          provide: EvaluationService,
          useValue: evaluationService
        },
        {
          provide: CompanyContextService,
          useValue: { selectedCompanyId }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not request results without a selected company', async () => {
    await fixture.whenStable();

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();

    expect(component.results).toBeNull();
  });

  it('should reload results when the selected company changes', async () => {
    const companyAResults = { evaluation_id: 10 } as ResultEvaluation;
    const companyBResults = { evaluation_id: 20 } as ResultEvaluation;

    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      of(companyBResults)
    );

    selectedCompanyId.set(3);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toEqual(companyAResults);

    selectedCompanyId.set(7);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toEqual(companyBResults);
    expect(
      evaluationService.getLastEvaluationResult
    ).toHaveBeenCalledTimes(2);
  });

  it('should clear previous results when switching companies', async () => {
    const companyAResults = { evaluation_id: 10 } as ResultEvaluation;
    const pendingRequest = new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      pendingRequest.asObservable()
    );

    selectedCompanyId.set(3);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toEqual(companyAResults);

    selectedCompanyId.set(7);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toBeNull();

    pendingRequest.next({ evaluation_id: 20 } as ResultEvaluation);

    expect(component.results?.evaluation_id).toBe(20);
  });
});
