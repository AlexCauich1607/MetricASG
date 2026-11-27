
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import { signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  of,
  Subject,
  throwError
} from 'rxjs';

import { PlanSelectorComponent } from
  './plan-selector.component';

import { EvaluationService } from
  '../../../../services/evaluation.service';

import { CompanyContextService } from
  '../../../../services/company-context.service';

import {
  EvaluationHistory,
  History
} from '../../../../models/history_evaluations';


describe('PlanSelectorComponent', () => {

  let component: PlanSelectorComponent;

  let fixture: ComponentFixture<PlanSelectorComponent>;

  let evaluationService:
    jasmine.SpyObj<EvaluationService>;

  let router: jasmine.SpyObj<Router>;

  let selectedCompanyId:
    ReturnType<typeof signal<number | null>>;


  const evaluationA: History = {
    evaluation_id: 10,
    date: '2026-05-10',
    global_score: 5.8,
    ambits: []
  };

  const evaluationB: History = {
    evaluation_id: 20,
    date: '2026-11-10',
    global_score: 7.4,
    ambits: []
  };

  const evaluationC: History = {
    evaluation_id: 30,
    date: '2026-11-20',
    global_score: 8.2,
    ambits: []
  };


  function buildHistory(
    evaluations: History[]
  ): EvaluationHistory {

    return {
      history: evaluations,
      averages: {
        global_score: 0,
        ambits: []
      }
    };

  }


  beforeEach(async () => {

    selectedCompanyId = signal<number | null>(null);

    evaluationService =
      jasmine.createSpyObj<EvaluationService>(
        'EvaluationService',
        ['getEvaluationHistory']
      );

    evaluationService.getEvaluationHistory.and.returnValue(
      of(buildHistory([evaluationA, evaluationB]))
    );

    router = jasmine.createSpyObj<Router>(
      'Router',
      ['navigate']
    );

    router.navigate.and.returnValue(
      Promise.resolve(true)
    );


    await TestBed.configureTestingModule({

      imports: [PlanSelectorComponent],

      providers: [

        {
          provide: EvaluationService,
          useValue: evaluationService
        },

        {
          provide: CompanyContextService,
          useValue: {
            selectedCompanyId
          }
        },

        {
          provide: Router,
          useValue: router
        }

      ]

    }).compileComponents();


    fixture = TestBed.createComponent(
      PlanSelectorComponent
    );

    component = fixture.componentInstance;

    synchronize();

  });


  function synchronize(): void {

    fixture.detectChanges();

    TestBed.flushEffects();

    fixture.detectChanges();

  }


  function selectCompany(
    companyId: number | null
  ): void {

    selectedCompanyId.set(companyId);

    synchronize();

  }


  // Contexto inicial.

  it('should create', () => {

    expect(component).toBeTruthy();

  });


  it('should not request evaluations without a selected company', () => {

    expect(
      evaluationService.getEvaluationHistory
    ).not.toHaveBeenCalled();

    expect(component.state().evaluations)
      .toEqual([]);

    expect(component.selectedEvaluationId())
      .toBeNull();

  });


  it('should load evaluations for the selected company', () => {

    selectCompany(3);

    expect(
      evaluationService.getEvaluationHistory
    ).toHaveBeenCalledTimes(1);

    expect(component.state().companyId)
      .toBe(3);

    expect(component.state().evaluations.length)
      .toBe(2);

  });


  // Ordenamiento y selección.

  it('should sort evaluations from newest to oldest', () => {

    evaluationService.getEvaluationHistory.and.returnValue(
      of(buildHistory([
        evaluationA,
        evaluationC,
        evaluationB
      ]))
    );

    selectCompany(3);

    expect(
      component.state().evaluations.map(
        evaluation => evaluation.evaluation_id
      )
    ).toEqual([30, 20, 10]);

  });


  it('should sort evaluations with the same date by descending id', () => {

    evaluationService.getEvaluationHistory.and.returnValue(
      of(buildHistory([

        evaluationA,

        {
          ...evaluationB,
          date: evaluationA.date
        }

      ]))
    );

    selectCompany(3);

    expect(
      component.state().evaluations.map(
        evaluation => evaluation.evaluation_id
      )
    ).toEqual([20, 10]);

  });


  it('should select the latest evaluation by default', () => {

    selectCompany(3);

    expect(component.selectedEvaluationId())
      .toBe(20);

  });


  it('should allow selecting another available evaluation', () => {

    selectCompany(3);

    component.selectEvaluation('10');

    expect(component.selectedEvaluationId())
      .toBe(10);

  });


  it('should reject invalid or unavailable evaluation identifiers', () => {

    selectCompany(3);

    const invalidValues = [
      '',
      'abc',
      '-1',
      '0',
      '10.5',
      '999',
      'Infinity'
    ];

    for (const value of invalidValues) {

      component.selectEvaluation(value);

      expect(component.selectedEvaluationId())
        .withContext(value)
        .toBeNull();

    }

  });


  it('should discard invalid evaluation identifiers returned by the service', () => {

    evaluationService.getEvaluationHistory.and.returnValue(
      of(buildHistory([

        {
          ...evaluationC,
          evaluation_id: -1
        },

        {
          ...evaluationC,
          evaluation_id: 0
        },

        {
          ...evaluationC,
          evaluation_id: 2.5
        },

        {
          ...evaluationC,
          evaluation_id: Number.MAX_SAFE_INTEGER + 1
        },

        evaluationA

      ]))
    );

    selectCompany(3);

    expect(component.state().evaluations)
      .toEqual([evaluationA]);

    expect(component.selectedEvaluationId())
      .toBe(10);

  });


  // Estados de interfaz.

  it('should display the loading state while requesting evaluations', () => {

    const pendingRequest =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValue(
      pendingRequest.asObservable()
    );

    selectCompany(3);

    expect(component.state().loading)
      .toBeTrue();

    expect(fixture.nativeElement.textContent)
      .toContain('Cargando evaluaciones...');

    pendingRequest.next(
      buildHistory([evaluationA])
    );

    synchronize();

    expect(component.state().loading)
      .toBeFalse();

    expect(component.selectedEvaluationId())
      .toBe(10);

  });


  it('should display the empty state without completed evaluations', () => {

    evaluationService.getEvaluationHistory.and.returnValue(
      of(buildHistory([]))
    );

    selectCompany(3);

    expect(component.state().evaluations)
      .toEqual([]);

    expect(component.selectedEvaluationId())
      .toBeNull();

    expect(fixture.nativeElement.textContent)
      .toContain('Aún no tienes evaluaciones finalizadas');

  });


  it('should display an error when the request fails', () => {

    evaluationService.getEvaluationHistory.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    selectCompany(3);

    expect(component.state().error)
      .toBeTrue();

    expect(component.state().evaluations)
      .toEqual([]);

    expect(fixture.nativeElement.textContent)
      .toContain('No fue posible cargar las evaluaciones.');

  });


  it('should retry a failed evaluations request', () => {

    evaluationService.getEvaluationHistory.and.returnValues(

      throwError(() => new Error('Request failed')),

      of(buildHistory([evaluationA]))

    );

    selectCompany(3);

    expect(component.state().error)
      .toBeTrue();

    component.retry();

    synchronize();

    expect(
      evaluationService.getEvaluationHistory
    ).toHaveBeenCalledTimes(2);

    expect(component.state().error)
      .toBeFalse();

    expect(component.selectedEvaluationId())
      .toBe(10);

  });


  // Navegación.

  it('should navigate to the selected improvement plan', () => {

    selectCompany(3);

    component.selectEvaluation('10');

    component.openPlan();

    expect(router.navigate)
      .toHaveBeenCalledOnceWith([
        '/user/improvement/plan',
        10
      ]);

  });


  it('should not navigate without a valid evaluation', () => {

    selectCompany(3);

    component.selectEvaluation('999');

    component.openPlan();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });


  it('should not navigate while loading evaluations', () => {

    const pendingRequest =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValue(
      pendingRequest.asObservable()
    );

    selectCompany(3);

    component.openPlan();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });


  it('should update the selected evaluation using the HTML select', () => {

    selectCompany(3);

    const select: HTMLSelectElement =
      fixture.nativeElement.querySelector(
        '#planEvaluationId'
      );

    expect(select).not.toBeNull();

    select.value = '10';

    select.dispatchEvent(
      new Event('change')
    );

    synchronize();

    expect(component.selectedEvaluationId())
      .toBe(10);

  });


  // Aislamiento empresarial.

  it('should invalidate the previous company selection immediately', () => {

    selectCompany(3);

    expect(component.selectedEvaluationId())
      .toBe(20);

    selectedCompanyId.set(7);

    // Sin ejecutar los efectos reactivos todavía.

    expect(component.state().companyId)
      .toBe(7);

    expect(component.state().loading)
      .toBeTrue();

    expect(component.state().evaluations)
      .toEqual([]);

    expect(component.selectedEvaluationId())
      .toBeNull();

    component.openPlan();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });


  it('should reload evaluations when switching companies', () => {

    evaluationService.getEvaluationHistory.and.returnValues(

      of(buildHistory([evaluationA])),

      of(buildHistory([evaluationC]))

    );

    selectCompany(3);

    expect(component.selectedEvaluationId())
      .toBe(10);

    selectCompany(7);

    expect(component.state().companyId)
      .toBe(7);

    expect(component.state().evaluations)
      .toEqual([evaluationC]);

    expect(component.selectedEvaluationId())
      .toBe(30);

    expect(
      evaluationService.getEvaluationHistory
    ).toHaveBeenCalledTimes(2);

  });


  it('should cancel pending evaluations from the previous company', () => {

    const previousRequest =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValues(

      previousRequest.asObservable(),

      of(buildHistory([evaluationC]))

    );

    selectCompany(3);

    expect(previousRequest.observed)
      .toBeTrue();

    selectCompany(7);

    expect(previousRequest.observed)
      .toBeFalse();

    previousRequest.next(
      buildHistory([evaluationA])
    );

    synchronize();

    expect(component.state().evaluations)
      .toEqual([evaluationC]);

    expect(component.selectedEvaluationId())
      .toBe(30);

  });


  it('should clear the selector when the company context is removed', () => {

    selectCompany(3);

    expect(component.selectedEvaluationId())
      .toBe(20);

    selectCompany(null);

    expect(component.state().companyId)
      .toBeNull();

    expect(component.state().evaluations)
      .toEqual([]);

    expect(component.selectedEvaluationId())
      .toBeNull();

    component.openPlan();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });

});
