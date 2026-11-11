
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { CompanyContextService } from '../../../services/company-context.service';
import { CompareComponent } from './compare.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationComparison } from '../../../models/evaluation_comparison';

describe('CompareComponent', () => {
  let component: CompareComponent;
  let fixture: ComponentFixture<CompareComponent>;
  let evaluationService: jasmine.SpyObj<EvaluationService>;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;

  const mockComparison: EvaluationComparison = {
    comparable: true,
    warning: null,
    evaluations: [
      {
        evaluation_id: 12,
        date: '2026-09-10T12:00:00',
        methodology_id: 1,
        methodology_version: '1.0',
        global_score: 7.5,
        ambits: [
          { ambit_id: 1, ambit_name: 'Ambiental', score: 7 }
        ]
      },
      {
        evaluation_id: 15,
        date: '2026-10-20T12:00:00',
        methodology_id: 1,
        methodology_version: '1.0',
        global_score: 8.5,
        ambits: [
          { ambit_id: 1, ambit_name: 'Ambiental', score: 8 }
        ]
      }
    ],
    differences: {
      global_score: 1,
      ambits: [
        { ambit_id: 1, ambit_name: 'Ambiental', delta: 1 }
      ]
    }
  };


  async function createComponent(
    evaluationId1: string | null = '12',
    evaluationId2: string | null = '15',
    response$ = of(mockComparison)
  ): Promise<void> {
    TestBed.resetTestingModule();
    selectedCompanyId = signal<number | null>(3);
    evaluationService = jasmine.createSpyObj<EvaluationService>(
      'EvaluationService',
      ['getEvaluationComparison']
    );

    evaluationService.getEvaluationComparison.and.returnValue(response$);

    await TestBed.configureTestingModule({
      imports: [CompareComponent],
      providers: [
        {
          provide: EvaluationService,
          useValue: evaluationService
        },
        {
          provide: CompanyContextService,
          useValue: { selectedCompanyId }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                ...(evaluationId1 !== null
                  ? { evaluation_id_1: evaluationId1 }
                  : {}),
                ...(evaluationId2 !== null
                  ? { evaluation_id_2: evaluationId2 }
                  : {})
              })
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CompareComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
  }


  it('should create', async () => {
    await createComponent();

    expect(component).toBeTruthy();
  });

  it('should request the selected evaluations', async () => {
    await createComponent();

    expect(
      evaluationService.getEvaluationComparison
    ).toHaveBeenCalledOnceWith(12, 15);
  });

  it('should reject identical evaluation IDs', async () => {
    await createComponent('12', '12');

    expect(component.error).toBeTruthy();
    expect(
      evaluationService.getEvaluationComparison
    ).not.toHaveBeenCalled();
  });

  it('should reject missing or invalid evaluation IDs', async () => {
    await createComponent(null, '15');

    expect(component.error).toBeTruthy();
    expect(
      evaluationService.getEvaluationComparison
    ).not.toHaveBeenCalled();
  });

  it('should display the comparison results', async () => {
    await createComponent();

    expect(component.loading).toBeFalse();
    expect(component.comparison).toEqual(mockComparison);
    expect(component.getAmbitScore(0, 1)).toBe(7);
    expect(component.getAmbitScore(1, 1)).toBe(8);

    expect(fixture.nativeElement.textContent)
      .toContain('Diferencias por ámbito');
  });

  it('should clear loading after an HTTP error', async () => {
    await createComponent();

    evaluationService.getEvaluationComparison.and.returnValue(
      throwError(() => new Error('HTTP error'))
    );

    component.loadComparison(12, 15);

    expect(component.loading).toBeFalse();
    expect(component.error).toBeTruthy();
    expect(component.comparison).toBeNull();

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('No fue posible obtener');
  });


  it('should display loading while the request is pending', async () => {
    const pendingResponse = new Subject<EvaluationComparison>();

    await createComponent(
      '12',
      '15',
      pendingResponse.asObservable()
    );

    expect(component.loading).toBeTrue();
    expect(fixture.nativeElement.textContent)
      .toContain('Cargando comparación');

    pendingResponse.next(mockComparison);
    pendingResponse.complete();

    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.comparison).toEqual(mockComparison);

    expect(fixture.nativeElement.textContent)
      .toContain('Diferencias por ámbito');
  });


  it('should show a warning for incompatible methodologies', async () => {
    await createComponent();

    const incompatibleComparison: EvaluationComparison = {
      ...mockComparison,
      comparable: false,
      warning: 'Las metodologías no son comparables.',
      differences: null
    };

    evaluationService.getEvaluationComparison.and.returnValue(
      of(incompatibleComparison)
    );

    component.loadComparison(12, 15);
    fixture.detectChanges();

    expect(component.comparison?.comparable).toBeFalse();
    expect(component.comparison?.differences).toBeNull();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Las metodologías no son comparables.');
    expect(text).not.toContain('Diferencias por ámbito');
  });

  it('should permanently invalidate comparison after switching companies', async () => {
    await createComponent();

    // Iniciar una comparación en Empresa A.
    // createComponent() ya inicializa la empresa con ID 3.
    // La consulta inicial ya fue ejecutada por el componente.
    const initialCalls =
      evaluationService.getEvaluationComparison.calls.count();

    expect(initialCalls).toBe(1);

    // Cambiar de Empresa A a Empresa B.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.comparison).toBeNull();
    expect(component.loading).toBeFalse();
    expect(component.error).toContain(
      'La empresa seleccionada cambió'
    );

    // Regresar a Empresa A.
    selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // No debe reutilizar los identificadores anteriores.
    expect(
      evaluationService.getEvaluationComparison
    ).toHaveBeenCalledTimes(initialCalls);

    expect(component.comparison).toBeNull();
  });

  it('should cancel a pending comparison when switching companies', async () => {
    const pendingComparison = new Subject<EvaluationComparison>();

    await createComponent(
      '12',
      '15',
      pendingComparison.asObservable()
    );

    // La comparación de Empresa A está pendiente.
    expect(component.loading).toBeTrue();
    expect(pendingComparison.observed).toBeTrue();

    // Cambiar a Empresa B.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La suscripción anterior debe cancelarse.
    expect(pendingComparison.observed).toBeFalse();

    expect(component.loading).toBeFalse();
    expect(component.comparison).toBeNull();

    expect(component.error).toContain(
      'La empresa seleccionada cambió'
    );

    // Una respuesta tardía no debe modificar la comparación.
    pendingComparison.next(mockComparison);

    expect(component.comparison).toBeNull();

    // No debe consultar automáticamente las mismas evaluaciones.
    expect(
      evaluationService.getEvaluationComparison
    ).toHaveBeenCalledOnceWith(12, 15);
  });

});
