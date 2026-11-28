
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  of,
  Subject,
  throwError
} from 'rxjs';

import { FeedbackComponent } from './feedback.component';

import { EvaluationService } from
  '../../../services/evaluation.service';

import { CompanyContextService } from
  '../../../services/company-context.service';

import { ResultEvaluation } from
  '../../../models/evaluation_result';

describe('FeedbackComponent', () => {

  let component: FeedbackComponent;
  let fixture: ComponentFixture<FeedbackComponent>;

  let evaluationService:
    jasmine.SpyObj<EvaluationService>;

  let router: jasmine.SpyObj<Router>;

  let selectedCompanyId:
    ReturnType<typeof signal<number | null>>;

  const companyAResults: ResultEvaluation = {
    evaluation_id: 10,
    date: '2026-11-02T12:00:00',
    global_score: 8.5,
    global_maturity_level: 'Avanzado',
    ambits: []
  };

  const companyBResults: ResultEvaluation = {
    evaluation_id: 20,
    date: '2026-11-15T12:00:00',
    global_score: 9.2,
    global_maturity_level: 'Avanzado',
    ambits: []
  };

  beforeEach(async () => {

    selectedCompanyId =
      signal<number | null>(null);

    evaluationService =
      jasmine.createSpyObj<EvaluationService>(
        'EvaluationService',
        ['getLastEvaluationResult']
      );

    evaluationService.getLastEvaluationResult
      .and.returnValue(of(companyAResults));

    router = jasmine.createSpyObj<Router>(
      'Router',
      ['navigate']
    );

    router.navigate.and.returnValue(
      Promise.resolve(true)
    );

    await TestBed.configureTestingModule({

      imports: [
        FeedbackComponent
      ],

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
      FeedbackComponent
    );

    component = fixture.componentInstance;

    fixture.detectChanges();

  });

  async function selectCompany(
    companyId: number | null
  ): Promise<void> {

    selectedCompanyId.set(companyId);

    fixture.detectChanges();

    await fixture.whenStable();

    fixture.detectChanges();

  }

  // Creación del componente.

  it('should create', () => {

    expect(component).toBeTruthy();

  });

  // Contexto empresarial.

  it('should not request results without a selected company', async () => {

    await fixture.whenStable();

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();

    expect(component.results()).toBeNull();

    expect(
      component.state().status
    ).toBe('empty');

  });

  it('should reload results when the selected company changes', async () => {

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        of(companyAResults),
        of(companyBResults)
      );

    await selectCompany(3);

    expect(component.results())
      .toEqual(companyAResults);

    await selectCompany(7);

    expect(component.results())
      .toEqual(companyBResults);

    expect(
      evaluationService.getLastEvaluationResult
    ).toHaveBeenCalledTimes(2);

  });

  it('should clear previous results when switching companies', async () => {

    const pendingRequest =
      new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        of(companyAResults),
        pendingRequest.asObservable()
      );

    await selectCompany(3);

    expect(component.results())
      .toEqual(companyAResults);

    selectedCompanyId.set(7);

    // El contexto anterior se oculta inmediatamente.
    expect(component.results()).toBeNull();

    fixture.detectChanges();

    await fixture.whenStable();

    expect(component.results()).toBeNull();

    expect(
      component.state().status
    ).toBe('loading');

    pendingRequest.next(companyBResults);

    expect(
      component.results()?.evaluation_id
    ).toBe(20);

    expect(
      component.state().status
    ).toBe('ready');

  });

  it('should ignore pending results from the previous company', async () => {

    const previousRequest =
      new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        previousRequest.asObservable(),
        of(companyBResults)
      );

    await selectCompany(3);

    await selectCompany(7);

    previousRequest.next(companyAResults);

    expect(component.results())
      .toEqual(companyBResults);

  });

  it('should clear results when the selected company is removed', async () => {

    await selectCompany(3);

    expect(component.results())
      .toEqual(companyAResults);

    await selectCompany(null);

    expect(component.results()).toBeNull();

    expect(
      component.state().status
    ).toBe('empty');

    expect(component.canOpenPlan()).toBeFalse();

  });

  // Estados de interfaz.

  it('should show a loading state while requesting results', async () => {

    const pendingRequest =
      new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult
      .and.returnValue(
        pendingRequest.asObservable()
      );

    await selectCompany(3);

    expect(
      component.state().status
    ).toBe('loading');

    expect(
      fixture.nativeElement.querySelector(
        '.feedback-skeleton'
      )
    ).not.toBeNull();

    pendingRequest.next(companyAResults);

    fixture.detectChanges();

    expect(
      component.state().status
    ).toBe('ready');

    expect(
      fixture.nativeElement.querySelector(
        '.feedback-skeleton'
      )
    ).toBeNull();

  });

  it('should show an empty state when no evaluation exists', async () => {

    evaluationService.getLastEvaluationResult
      .and.returnValue(
        throwError(() =>
          new HttpErrorResponse({
            status: 404,
            statusText: 'Not Found'
          })
        )
      );

    await selectCompany(3);

    expect(
      component.state().status
    ).toBe('empty');

    expect(component.results()).toBeNull();

    expect(
      fixture.nativeElement.textContent
    ).toContain(
      'Aún no hay recomendaciones disponibles'
    );

  });

  it('should show an error state when the request fails', async () => {

    spyOn(console, 'error');

    evaluationService.getLastEvaluationResult
      .and.returnValue(
        throwError(() =>
          new HttpErrorResponse({
            status: 500,
            statusText: 'Internal Server Error'
          })
        )
      );

    await selectCompany(3);

    expect(
      component.state().status
    ).toBe('error');

    expect(component.results()).toBeNull();

    expect(
      fixture.nativeElement.textContent
    ).toContain(
      'No pudimos cargar las recomendaciones'
    );

  });

  it('should retry after a failed request', async () => {

    spyOn(console, 'error');

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        throwError(() =>
          new HttpErrorResponse({
            status: 500
          })
        ),
        of(companyAResults)
      );

    await selectCompany(3);

    expect(
      component.state().status
    ).toBe('error');

    component.retry();

    fixture.detectChanges();

    await fixture.whenStable();

    fixture.detectChanges();

    expect(
      component.state().status
    ).toBe('ready');

    expect(component.results())
      .toEqual(companyAResults);

    expect(
      evaluationService.getLastEvaluationResult
    ).toHaveBeenCalledTimes(2);

  });

  it('should show an empty recommendation section when no ambits exist', async () => {

    await selectCompany(3);

    expect(
      component.state().status
    ).toBe('ready');

    expect(
      fixture.nativeElement.textContent
    ).toContain(
      'No hay recomendaciones por ámbito'
    );

  });

  // Navegación contextual.

  it('should navigate to the plan of the current evaluation', async () => {

    await selectCompany(3);

    expect(component.canOpenPlan()).toBeTrue();

    component.openPlan();

    expect(router.navigate)
      .toHaveBeenCalledWith([
        '/user/improvement/plan',
        10
      ]);

  });

  it('should not open a plan without results', async () => {

    await fixture.whenStable();

    expect(component.canOpenPlan()).toBeFalse();

    component.openPlan();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });

  it('should reject an invalid evaluation ID', async () => {

    evaluationService.getLastEvaluationResult
      .and.returnValue(
        of({
          ...companyAResults,
          evaluation_id: 0
        })
      );

    await selectCompany(3);

    expect(component.canOpenPlan()).toBeFalse();

    component.openPlan();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });

  it('should not open a plan belonging to the previous company', async () => {

    await selectCompany(3);

    selectedCompanyId.set(7);

    expect(component.canOpenPlan()).toBeFalse();

    component.openPlan();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });

  it('should navigate to the user home page', () => {

    component.goToHome();

    expect(router.navigate)
      .toHaveBeenCalledWith([
        '/user/home'
      ]);

  });

});
