import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationDashboard } from '../../../models/evaluation_dashboard';
import { HistoryComponent } from './history.component';
import { EvaluationHistory } from '../../../models/history_evaluations';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { CompanyContextService } from '../../../services/company-context.service';

describe('HistoryComponent', () => {
  let component: HistoryComponent;
  let fixture: ComponentFixture<HistoryComponent>;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;

  beforeEach(async () => {
    selectedCompanyId = signal<number | null>(3);
    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [
        provideHttpClient(withXhr()),
        {
          provide: CompanyContextService,
          useValue: { selectedCompanyId }
        }
      ]
    }).compileComponents();

    const service = TestBed.inject(EvaluationService);

    spyOn(service, 'getEvaluationHistory').and.returnValue(
      of({
        history: [],
        averages: {
          global_score: null,
          ambits: []
        }
      } as unknown as EvaluationHistory)
    );

    spyOn(service, 'getHistoricalDashboard').and.returnValue(
      of({ history: [] })
    );

    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });


  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load historical dashboard and build trend charts', () => {
    const dashboard: EvaluationDashboard = {
      history: [
        {
          evaluation_id: 1,
          date: '2026-01-15T10:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 7,
          global_delta: null,
          ambits: [
            {
              ambit_id: 1,
              ambit_name: 'Ambiental',
              score: 6,
              delta: null
            }
          ]
        },
        {
          evaluation_id: 2,
          date: '2026-02-15T10:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 8,
          global_delta: 1,
          ambits: [
            {
              ambit_id: 1,
              ambit_name: 'Ambiental',
              score: 7,
              delta: 1
            }
          ]
        }
      ]
    };

    const service = TestBed.inject(EvaluationService);

    (service.getHistoricalDashboard as jasmine.Spy).and.returnValue(
      of(dashboard)
    );

    component.loadHistoricalDashboard();

    expect(component.dashboard).toEqual(dashboard);
    expect(component.latestEvaluation?.evaluation_id).toBe(2);
    expect(component.latestEvaluation?.global_delta).toBe(1);

    expect(component.globalTrend.datasets.length).toBe(1);
    expect(component.globalTrend.datasets[0].data.map(point => point.y))
      .toEqual([7, 8]);

    expect(component.ambitTrends.length).toBe(1);
    expect(component.ambitTrends[0].name).toBe('Ambiental');
    expect(component.ambitTrends[0].chart.datasets[0].data.map(point => point.y))
      .toEqual([6, 7]);
  });
  it('should show an empty state when there are no completed evaluations', () => {
    const service = TestBed.inject(EvaluationService);

    (service.getHistoricalDashboard as jasmine.Spy).and.returnValue(
      of({ history: [] })
    );

    component.loadHistoricalDashboard();
    fixture.detectChanges();

    expect(component.dashboard?.history).toEqual([]);
    expect(component.latestEvaluation).toBeNull();
    expect(component.hasComparableTrend).toBeFalse();

    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('Aún no tienes evaluaciones finalizadas');
  });

  it('should show scores but no trend charts with one evaluation', () => {
    const dashboard: EvaluationDashboard = {
      history: [
        {
          evaluation_id: 1,
          date: '2026-01-15T10:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 7.5,
          global_delta: null,
          ambits: [
            {
              ambit_id: 1,
              ambit_name: 'Ambiental',
              score: 8,
              delta: null
            }
          ]
        }
      ]
    };

    const service = TestBed.inject(EvaluationService);

    (service.getHistoricalDashboard as jasmine.Spy).and.returnValue(
      of(dashboard)
    );

    component.loadHistoricalDashboard();
    fixture.detectChanges();

    expect(component.latestEvaluation?.global_score).toBe(7.5);
    expect(component.hasComparableTrend).toBeFalse();

    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('7.5');
    expect(content).toContain('Aún no hay suficientes evaluaciones comparables');

    const charts = fixture.nativeElement.querySelectorAll(
      'app-historical-trend-chart'
    );

    expect(charts.length).toBe(0);
  });

  it('should not show trend charts for different methodologies', () => {
    const dashboard: EvaluationDashboard = {
      history: [
        {
          evaluation_id: 1,
          date: '2026-01-15T10:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 7,
          global_delta: null,
          ambits: []
        },
        {
          evaluation_id: 2,
          date: '2026-02-15T10:00:00',
          methodology_id: 2,
          methodology_version: '2.0',
          global_score: 8,
          global_delta: null,
          ambits: []
        }
      ]
    };

    const service = TestBed.inject(EvaluationService);

    (service.getHistoricalDashboard as jasmine.Spy).and.returnValue(
      of(dashboard)
    );

    component.loadHistoricalDashboard();
    fixture.detectChanges();

    expect(component.hasComparableTrend).toBeFalse();
    expect(component.latestEvaluation?.evaluation_id).toBe(2);

    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain(
      'Aún no hay suficientes evaluaciones comparables'
    );

    expect(
      fixture.nativeElement.querySelectorAll(
        'app-historical-trend-chart'
      ).length
    ).toBe(0);
  });

  it('should show trend charts when comparable evaluations have zero delta', () => {
    const dashboard: EvaluationDashboard = {
      history: [
        {
          evaluation_id: 1,
          date: '2026-01-15T10:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 8,
          global_delta: null,
          ambits: [
            {
              ambit_id: 1,
              ambit_name: 'Ambiental',
              score: 7,
              delta: null
            }
          ]
        },
        {
          evaluation_id: 2,
          date: '2026-02-15T10:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 8,
          global_delta: 0,
          ambits: [
            {
              ambit_id: 1,
              ambit_name: 'Ambiental',
              score: 7,
              delta: 0
            }
          ]
        }
      ]
    };

    const service = TestBed.inject(EvaluationService);

    (service.getHistoricalDashboard as jasmine.Spy).and.returnValue(
      of(dashboard)
    );

    component.loadHistoricalDashboard();
    fixture.detectChanges();

    expect(component.hasComparableTrend).toBeTrue();
    expect(component.latestEvaluation?.global_delta).toBe(0);

    const charts = fixture.nativeElement.querySelectorAll(
      'app-historical-trend-chart'
    );

    expect(charts.length).toBe(2);

    const content = fixture.nativeElement.textContent as string;

    expect(content).not.toContain(
      'Aún no hay suficientes evaluaciones comparables'
    );
  });

  it('should navigate to the improvement plan for a valid evaluation', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    component.openImprovementPlan(10);

    expect(navigateSpy).toHaveBeenCalledOnceWith([
      '/user/evaluations',
      10,
      'improvement-plan'
    ]);
  });

  it('should reject invalid evaluation IDs when opening the improvement plan', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    const invalidIds = [0, -1, 1.5, Number.NaN];

    invalidIds.forEach(evaluationId => {
      component.openImprovementPlan(evaluationId);
    });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should cancel pending requests and reset state when switching companies', () => {
    const pendingHistory = new Subject<EvaluationHistory>();
    const pendingDashboard = new Subject<EvaluationDashboard>();

    const service = TestBed.inject(EvaluationService);

    const historySpy = service.getEvaluationHistory as jasmine.Spy;
    const dashboardSpy = service.getHistoricalDashboard as jasmine.Spy;

    historySpy.and.returnValue(pendingHistory.asObservable());
    dashboardSpy.and.returnValue(pendingDashboard.asObservable());
    historySpy.calls.reset();
    dashboardSpy.calls.reset();

    // Simular una consulta pendiente para Empresa A.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(pendingHistory.observed).toBeTrue();
    expect(pendingDashboard.observed).toBeTrue();

    // Seleccionar evaluaciones de Empresa A.
    component.evaluationId1 = 10;
    component.evaluationId2 = 11;
    component.improvementEvaluationId = 10;

    // Preparar las respuestas de Empresa B.
    historySpy.and.returnValue(of({
      history: [],
      averages: {
        global_score: null,
        ambits: []
      }
    } as unknown as EvaluationHistory));

    dashboardSpy.and.returnValue(of({
      history: []
    } as EvaluationDashboard));

    // Cambiar a Empresa B.
    selectedCompanyId.set(9);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // Las solicitudes anteriores deben estar canceladas.
    expect(pendingHistory.observed).toBeFalse();
    expect(pendingDashboard.observed).toBeFalse();

    // Las selecciones anteriores deben desaparecer.
    expect(component.evaluationId1).toBeNull();
    expect(component.evaluationId2).toBeNull();
    expect(component.improvementEvaluationId).toBeNull();

    // El nuevo dashboard debe corresponder a la segunda consulta.
    expect(component.dashboard?.history).toEqual([]);
    expect(component.latestEvaluation).toBeNull();
    expect(component.ambitTrends).toEqual([]);
    expect(component.globalTrend.datasets).toEqual([]);

    expect(historySpy).toHaveBeenCalledTimes(2);
    expect(dashboardSpy).toHaveBeenCalledTimes(2);
  });

});
