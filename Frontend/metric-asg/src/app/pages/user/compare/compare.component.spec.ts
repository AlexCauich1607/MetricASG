
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { CompareComponent } from './compare.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationComparison } from '../../../models/evaluation_comparison';

describe('CompareComponent', () => {
  let component: CompareComponent;
  let fixture: ComponentFixture<CompareComponent>;
  let evaluationService: jasmine.SpyObj<EvaluationService>;

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
});
