
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

import { UserHomeComponent } from './user-home.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { CompanyContextService } from '../../../services/company-context.service';
import { UserService } from '../../../services/user.service';
import { ResultEvaluation } from '../../../models/evaluation_result';

describe('UserHomeComponent', () => {
  let component: UserHomeComponent;
  let fixture: ComponentFixture<UserHomeComponent>;

  let evaluationService: jasmine.SpyObj<EvaluationService>;
  let userService: jasmine.SpyObj<UserService>;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;

  const companyAResults = {
    evaluation_id: 10,
    date: '2026-09-15T12:00:00',
    global_score: 8,
    ambits: [
      {
        ambit_name: 'Ambiental',
        score: 8.5,
        color: '#00AA00',
        maturity_color: '#15b91d'
      }
    ]
  } as ResultEvaluation;

  const companyBResults = {
    evaluation_id: 20,
    date: '2026-10-20T12:00:00',
    global_score: 7,
    ambits: [
      {
        ambit_name: 'Social',
        score: 7.5,
        color: '#0000AA',
        maturity_color: '#eac84f'
      }
    ]
  } as ResultEvaluation;

  beforeEach(async () => {
    selectedCompanyId = signal<number | null>(null);

    evaluationService = jasmine.createSpyObj<EvaluationService>(
      'EvaluationService',
      ['getLastEvaluationResult']
    );

    evaluationService.getLastEvaluationResult.and.returnValue(
      of(companyAResults)
    );

    userService = jasmine.createSpyObj<UserService>(
      'UserService',
      ['getMe']
    );

    await TestBed.configureTestingModule({
      imports: [UserHomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: EvaluationService,
          useValue: evaluationService
        },
        {
          provide: UserService,
          useValue: userService
        },
        {
          provide: CompanyContextService,
          useValue: { selectedCompanyId }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserHomeComponent);
    component = fixture.componentInstance;

    // Evitar que la carga del perfil interfiera con estas pruebas.
    spyOn(component, 'loadUser');

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

  it('should reload results and chart data when switching companies', async () => {
    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      of(companyBResults)
    );

    selectedCompanyId.set(3);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toEqual(companyAResults);
    expect(component.ambits).toEqual(['Ambiental']);
    expect(component.scores).toEqual([8.5]);

    selectedCompanyId.set(7);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toEqual(companyBResults);
    expect(component.ambits).toEqual(['Social']);
    expect(component.scores).toEqual([7.5]);

    expect(
      evaluationService.getLastEvaluationResult
    ).toHaveBeenCalledTimes(2);
  });

  it('should clear previous results while loading another company', async () => {
    const pendingResults = new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      pendingResults.asObservable()
    );

    selectedCompanyId.set(3);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toEqual(companyAResults);

    selectedCompanyId.set(7);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.results).toBeNull();
    expect(component.ambits).toEqual([]);
    expect(component.scores).toEqual([]);
    expect(component.loadingChart).toBeFalse();

    pendingResults.next(companyBResults);

    expect(component.results).toEqual(companyBResults);
  });
});
