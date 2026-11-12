import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { BenchmarkComponent } from './benchmark.component';
import { BenchmarkService } from '../../../services/benchmark.service';
import { EvaluationService } from '../../../services/evaluation.service';
import { CompanyContextService } from '../../../services/company-context.service';
import { EvaluationDashboard } from '../../../models/evaluation_dashboard';
import { BenchmarkResult } from '../../../models/benchmark';

describe('BenchmarkComponent', () => {
  let component: BenchmarkComponent;
  let fixture: ComponentFixture<BenchmarkComponent>;
  let benchmarkService: jasmine.SpyObj<BenchmarkService>;
  let evaluationService: jasmine.SpyObj<EvaluationService>;
  let companyContext: CompanyContextService;

  const dashboard: EvaluationDashboard = {
    history: [
      {
        evaluation_id: 10,
        date: '2026-01-01',
        methodology_id: 1,
        methodology_version: '1.0',
        global_score: 6,
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
        evaluation_id: 20,
        date: '2026-02-01',
        methodology_id: 2,
        methodology_version: '2.0',
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
      }
    ]
  };

  const benchmark: BenchmarkResult = {
    available: true,
    methodology_id: 2,
    global_average: 7,
    ambits: [
      {
        ambit_id: 1,
        name: 'Ambiental',
        letter: 'A',
        average: 6
      }
    ]
  };

  beforeEach(async () => {
    benchmarkService = jasmine.createSpyObj<BenchmarkService>(
      'BenchmarkService',
      ['getBenchmark']
    );

    evaluationService = jasmine.createSpyObj<EvaluationService>(
      'EvaluationService',
      ['getHistoricalDashboard']
    );

    benchmarkService.getBenchmark.and.returnValue(of(benchmark));
    evaluationService.getHistoricalDashboard.and.returnValue(of(dashboard));

    await TestBed.configureTestingModule({
      imports: [BenchmarkComponent],
      providers: [
        {
          provide: BenchmarkService,
          useValue: benchmarkService
        },
        {
          provide: EvaluationService,
          useValue: evaluationService
        }
      ]
    }).compileComponents();

    companyContext = TestBed.inject(CompanyContextService);
    companyContext.selectedCompanyId.set(10);

    fixture = TestBed.createComponent(BenchmarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load benchmarking for the latest valid evaluation', () => {
    expect(evaluationService.getHistoricalDashboard)
      .toHaveBeenCalled();

    expect(benchmarkService.getBenchmark)
      .toHaveBeenCalledWith(2);

    expect(component.state().available).toBeTrue();
    expect(component.state().companyScore).toBe(8);
    expect(component.state().benchmarkAverage).toBe(7);
    expect(component.state().globalDifference).toBe(1);
    expect(component.state().methodologyVersion).toBe('2.0');
  });

  it('should calculate ambit differences', () => {
    expect(component.state().comparisons).toEqual([
      {
        ambit_id: 1,
        name: 'Ambiental',
        letter: 'A',
        companyScore: 7,
        benchmarkAverage: 6,
        difference: 1
      }
    ]);
  });

  it('should render global scores and ambit name', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Benchmarking ASG');
    expect(text).toContain('Mi empresa');
    expect(text).toContain('Grupo comparable');
    expect(text).toContain('Ambiental');
  });


  it('should show unavailable state when peer group is insufficient', () => {
    benchmarkService.getBenchmark.and.returnValue(of({
      available: false,
      methodology_id: 2,
      global_average: null,
      ambits: []
    }));

    fixture.destroy();
    fixture = TestBed.createComponent(BenchmarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.state().available).toBeFalse();
    expect(component.state().error).toBeNull();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Comparación no disponible');
    expect(text).toContain('No hay suficientes empresas comparables');
  });

  it('should show an error when historical dashboard fails', () => {
    evaluationService.getHistoricalDashboard.and.returnValue(
      throwError(() => new Error('Network error'))
    );

    fixture.destroy();
    fixture = TestBed.createComponent(BenchmarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.state().loading).toBeFalse();
    expect(component.state().available).toBeFalse();
    expect(component.state().error)
      .toBe('No se pudo cargar el benchmarking.');

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('No se pudo cargar el benchmarking.');
  });

  it('should not request benchmark without a valid evaluation', () => {
    evaluationService.getHistoricalDashboard.and.returnValue(of({
      history: []
    }));

    benchmarkService.getBenchmark.calls.reset();

    fixture.destroy();
    fixture = TestBed.createComponent(BenchmarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(benchmarkService.getBenchmark).not.toHaveBeenCalled();
    expect(component.state().available).toBeFalse();
    expect(component.state().error)
      .toBe('No hay evaluaciones finalizadas disponibles.');
  });

  it('should discard pending responses when selected company changes', () => {
    const firstDashboard = new Subject<EvaluationDashboard>();
    const secondDashboard = new Subject<EvaluationDashboard>();

    evaluationService.getHistoricalDashboard.and.returnValues(
      firstDashboard.asObservable(),
      secondDashboard.asObservable()
    );

    benchmarkService.getBenchmark.calls.reset();

    // Crear un componente nuevo con la primera empresa seleccionada.
    fixture.destroy();
    companyContext.selectedCompanyId.set(10);

    fixture = TestBed.createComponent(BenchmarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.state().loading).toBeTrue();

    // Cambiar a otra empresa antes de recibir la primera respuesta.
    companyContext.selectedCompanyId.set(20);
    fixture.detectChanges();

    expect(component.state().loading).toBeTrue();
    expect(component.state().companyScore).toBeNull();

    // La respuesta anterior no debe desencadenar consultas.
    firstDashboard.next(dashboard);
    firstDashboard.complete();

    expect(benchmarkService.getBenchmark).not.toHaveBeenCalled();

    // Solo se utiliza la respuesta de la empresa actualmente seleccionada.
    secondDashboard.next(dashboard);
    secondDashboard.complete();
    fixture.detectChanges();

    expect(benchmarkService.getBenchmark)
      .toHaveBeenCalledOnceWith(2);

    expect(component.state().available).toBeTrue();
    expect(component.state().companyScore).toBe(8);
  });

  it('should cancel pending benchmark requests when company changes', () => {
    const pendingBenchmark = new Subject<BenchmarkResult>();

    benchmarkService.getBenchmark.and.returnValues(
      pendingBenchmark.asObservable(),
      of(benchmark)
    );

    fixture.destroy();

    // Excluir la consulta realizada por el componente del beforeEach.
    benchmarkService.getBenchmark.calls.reset();

    companyContext.selectedCompanyId.set(10);

    fixture = TestBed.createComponent(BenchmarkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.state().loading).toBeTrue();
    expect(component.state().available).toBeFalse();

    // Cambiar de empresa mientras el benchmark anterior está pendiente.
    companyContext.selectedCompanyId.set(20);
    fixture.detectChanges();

    // La segunda empresa ya dispone de resultados.
    expect(component.state().available).toBeTrue();
    expect(component.state().companyScore).toBe(8);
    expect(component.state().benchmarkAverage).toBe(7);

    // Una respuesta tardía de la primera empresa no debe modificar el estado.
    pendingBenchmark.next({
      available: true,
      methodology_id: 2,
      global_average: 2,
      ambits: []
    });

    pendingBenchmark.complete();
    fixture.detectChanges();

    expect(component.state().available).toBeTrue();
    expect(component.state().benchmarkAverage).toBe(7);
    expect(component.state().globalDifference).toBe(1);
    expect(benchmarkService.getBenchmark).toHaveBeenCalledTimes(2);
  });

});
