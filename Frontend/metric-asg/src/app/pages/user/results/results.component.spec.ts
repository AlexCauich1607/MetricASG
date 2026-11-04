import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';
import { ResultsComponent } from './results.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { Router } from '@angular/router';

describe('ResultsComponent', () => {
  let component: ResultsComponent;
  let fixture: ComponentFixture<ResultsComponent>;
  let evaluationServiceSpy: jasmine.SpyObj<EvaluationService>;
  let evidenceServiceSpy: jasmine.SpyObj<EvidenceService>;

  const mockResults: ResultEvaluation = {
    evaluation_id: 1,
    date: '2026-09-15T12:00:00',
    global_score: 8.5,
    global_maturity_level: 'Intermedio',
    ambits: [
      {
        ambit_id: 1,
        ambit_name: 'Ambiental',
        score: 9.5,
        letter: 'A',
        color: '#00AA00',
        maturity_level: 'Avanzado',
        maturity_color: '#15b91d',
        feedback: 'Buen desempeño ambiental'
      },
      {
        ambit_id: 2,
        ambit_name: 'Social',
        score: 7.5,
        letter: 'S',
        color: '#0000AA',
        maturity_level: 'Intermedio',
        maturity_color: '#eac84f',
        feedback: 'Se recomienda mejorar'
      }
    ]
  };


  const mockEvidences: EvaluationEvidence[] = [
    {
      id: 1,
      evaluation_id: 1,
      indicator_id: 5,
      type: 'COMMENT',
      content: 'Evidencia ambiental',
      original_filename: null,
      mime_type: null,
      file_size: null,
      created_at: '2026-10-23T12:00:00',
      updated_at: '2026-10-23T12:00:00'
    },
    {
      id: 2,
      evaluation_id: 1,
      indicator_id: 8,
      type: 'URL',
      content: 'https://example.com/evidence',
      original_filename: null,
      mime_type: null,
      file_size: null,
      created_at: '2026-10-23T12:00:00',
      updated_at: '2026-10-23T12:00:00'
    }
  ];


  beforeEach(async () => {

    evaluationServiceSpy = jasmine.createSpyObj(
      'EvaluationService',
      ['getLastEvaluationResult']
    );
    evidenceServiceSpy = jasmine.createSpyObj(
      'EvidenceService',
      ['getEvidences', 'downloadEvidence']
    );

    evidenceServiceSpy.getEvidences.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [
        ResultsComponent
      ],

      providers: [
        {
          provide: EvaluationService,
          useValue: evaluationServiceSpy
        },
        {
          provide: EvidenceService,
          useValue: evidenceServiceSpy
        }
      ]

    }).compileComponents();

    fixture = TestBed.createComponent(ResultsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the last evaluation result', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    component.loadResults();

    expect(
      evaluationServiceSpy.getLastEvaluationResult
    ).toHaveBeenCalledWith();

    expect(component.results).toEqual(mockResults);
  });

  it('should build chart data when results are loaded', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    component.loadResults();

    expect(component.ambits).toEqual([
      'Ambiental',
      'Social'
    ]);

    expect(component.scores).toEqual([
      9.5,
      7.5
    ]);

    expect(component.colors).toEqual([
      '#00AA00',
      '#0000AA'
    ]);

    expect(component.bordes).toEqual([
      '#15b91d',
      '#eac84f'
    ]);

    expect(component.loadingChart).toBeTrue();
  });

  it('should calculate the current and previous evaluation periods', () => {
    component.getPeriodo('2026-09-15T12:00:00');

    expect(component.mesActual).toBe('Septiembre');
    expect(component.anioActual).toBe('2026');

    expect(component.mesAnterior).toBe('Marzo');
    expect(component.anioAnterior).toBe('2026');
  });

  it('should capitalize the first letter of a text', () => {
    expect(component.capitalizar('septiembre')).toBe('Septiembre');
  });

  it('should return the same value when capitalizing an empty text', () => {
    expect(component.capitalizar('')).toBe('');
  });

  it('should return the correct border color for each maturity level', () => {
    expect(component.getBorderColor('Básico')).toBe('#ce4040ff');
    expect(component.getBorderColor('Intermedio')).toBe('#eac84fff');
    expect(component.getBorderColor('Avanzado')).toBe('#15b91dff');
  });

  it('should load evidences for the completed evaluation', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    component.loadResults();

    expect(evidenceServiceSpy.getEvidences).toHaveBeenCalledOnceWith(
      mockResults.evaluation_id
    );

    expect(component.evidences).toEqual([]);
    expect(component.loadingEvidences).toBeFalse();
    expect(component.evidencesError).toBeFalse();
  });

  it('should store evidences returned by the backend', () => {
    evidenceServiceSpy.getEvidences.and.returnValue(
      of(mockEvidences)
    );

    component.loadEvidences(1);

    expect(evidenceServiceSpy.getEvidences).toHaveBeenCalledWith(1);
    expect(component.evidences).toEqual(mockEvidences);
    expect(component.loadingEvidences).toBeFalse();
    expect(component.evidencesError).toBeFalse();
  });

  it('should handle an evaluation without evidences', () => {
    evidenceServiceSpy.getEvidences.and.returnValue(of([]));

    component.loadEvidences(1);

    expect(component.evidences).toEqual([]);
    expect(component.loadingEvidences).toBeFalse();
    expect(component.evidencesError).toBeFalse();
  });

  it('should handle an error when loading evidences', () => {
    evidenceServiceSpy.getEvidences.and.returnValue(
      throwError(() => new Error('Error al consultar evidencias'))
    );

    component.loadEvidences(1);

    expect(component.evidences).toEqual([]);
    expect(component.loadingEvidences).toBeFalse();
    expect(component.evidencesError).toBeTrue();
  });

  it('should keep loading state until evidences are received', () => {
    const pendingRequest = new Subject<EvaluationEvidence[]>();

    evidenceServiceSpy.getEvidences.and.returnValue(
      pendingRequest.asObservable()
    );

    component.loadEvidences(1);

    expect(component.loadingEvidences).toBeTrue();
    expect(component.evidences).toEqual([]);

    pendingRequest.next(mockEvidences);
    pendingRequest.complete();

    expect(component.loadingEvidences).toBeFalse();
    expect(component.evidences).toEqual(mockEvidences);
  });

  it('should return unique and sorted indicator IDs', () => {
    component.evidences = [
      {
        ...mockEvidences[1],
        id: 3,
        indicator_id: 8
      },
      {
        ...mockEvidences[0],
        id: 4,
        indicator_id: 3
      },
      {
        ...mockEvidences[0],
        id: 5,
        indicator_id: 5
      },
      {
        ...mockEvidences[1],
        id: 6,
        indicator_id: 8
      }
    ];

    expect(component.getEvidenceIndicatorIds()).toEqual([3, 5, 8]);
  });

  it('should recover evidences after retrying a failed request', () => {
    evidenceServiceSpy.getEvidences.and.returnValues(
      throwError(() => new Error('Error de conexión')),
      of(mockEvidences)
    );

    component.loadEvidences(1);

    expect(component.evidencesError).toBeTrue();
    expect(component.evidences).toEqual([]);

    component.loadEvidences(1);

    expect(evidenceServiceSpy.getEvidences).toHaveBeenCalledTimes(2);
    expect(component.evidencesError).toBeFalse();
    expect(component.evidences).toEqual(mockEvidences);
  });

  it('should display comment evidences in read-only mode', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    evidenceServiceSpy.getEvidences.and.returnValue(
      of(mockEvidences)
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain(
      'Evidencias registradas'
    );

    expect(element.textContent).toContain(
      'Indicador 5'
    );

    expect(element.textContent).toContain(
      'Evidencia ambiental'
    );

    expect(
      element.querySelector('textarea')
    ).toBeNull();

    expect(
      element.querySelector('button.btn-outline-danger')
    ).toBeNull();
  });

  it('should display URL evidences as external links', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    evidenceServiceSpy.getEvidences.and.returnValue(
      of(mockEvidences)
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const link = element.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/evidence"]'
    );

    expect(link).not.toBeNull();
    expect(link?.textContent).toContain(
      'https://example.com/evidence'
    );

    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
    expect(link?.rel).toContain('noreferrer');
  });

  it('should display file evidence with a download button in read-only mode', () => {
    const fileEvidence: EvaluationEvidence = {
      ...mockEvidences[0],
      id: 3,
      type: 'FILE',
      content: null,
      original_filename: 'reporte-ambiental.pdf',
      mime_type: 'application/pdf',
      file_size: 2048
    };

    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    evidenceServiceSpy.getEvidences.and.returnValue(
      of([fileEvidence])
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain(
      'Archivo adjunto'
    );

    expect(element.textContent).toContain(
      'reporte-ambiental.pdf'
    );

    const downloadButton = Array.from(
      element.querySelectorAll('button')
    ).find(button =>
      button.textContent?.includes('Descargar')
    );

    expect(downloadButton).toBeDefined();
    expect(downloadButton?.disabled).toBeFalse();

    expect(
      element.querySelector('button.btn-outline-danger')
    ).toBeNull();
  });

  it('should download file evidence with its original filename', () => {
    const fileEvidence: EvaluationEvidence = {
      ...mockEvidences[0],
      id: 3,
      type: 'FILE',
      content: null,
      original_filename: 'reporte-ambiental.pdf',
      mime_type: 'application/pdf',
      file_size: 2048
    };

    const fileContent = new Blob(
      ['PDF content'],
      { type: 'application/pdf' }
    );

    component.results = mockResults;

    evidenceServiceSpy.downloadEvidence.and.returnValue(
      of(fileContent)
    );

    const objectUrlSpy = spyOn(
      URL,
      'createObjectURL'
    ).and.returnValue('blob:mock-evidence');

    const revokeUrlSpy = spyOn(
      URL,
      'revokeObjectURL'
    );

    const clickSpy = spyOn(
      HTMLAnchorElement.prototype,
      'click'
    );

    jasmine.clock().install();

    try {
      component.downloadEvidence(fileEvidence);

      expect(
        evidenceServiceSpy.downloadEvidence
      ).toHaveBeenCalledWith(1, 3);

      expect(objectUrlSpy).toHaveBeenCalledWith(fileContent);
      expect(clickSpy).toHaveBeenCalled();

      expect(component.downloadingEvidenceId).toBeNull();
      expect(component.evidenceDownloadError).toBeNull();

      jasmine.clock().tick(1000);

      expect(revokeUrlSpy).toHaveBeenCalledWith(
        'blob:mock-evidence'
      );
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('should display an error when file download fails', () => {
    const fileEvidence: EvaluationEvidence = {
      ...mockEvidences[0],
      id: 3,
      type: 'FILE',
      content: null,
      original_filename: 'reporte-ambiental.pdf',
      mime_type: 'application/pdf',
      file_size: 2048
    };

    component.results = mockResults;

    evidenceServiceSpy.downloadEvidence.and.returnValue(
      throwError(() => new Error('Download failed'))
    );

    component.downloadEvidence(fileEvidence);

    expect(
      evidenceServiceSpy.downloadEvidence
    ).toHaveBeenCalledWith(1, 3);

    expect(component.downloadingEvidenceId).toBeNull();

    expect(component.evidenceDownloadError).toBe(
      'No se pudo descargar el archivo. Inténtalo nuevamente.'
    );
  });

  it('should prevent concurrent file downloads', () => {
    const fileEvidence: EvaluationEvidence = {
      ...mockEvidences[0],
      id: 3,
      type: 'FILE',
      content: null,
      original_filename: 'reporte-ambiental.pdf',
      mime_type: 'application/pdf',
      file_size: 2048
    };

    const pendingDownload = new Subject<Blob>();

    component.results = mockResults;

    evidenceServiceSpy.downloadEvidence.and.returnValue(
      pendingDownload.asObservable()
    );

    component.downloadEvidence(fileEvidence);

    expect(component.downloadingEvidenceId).toBe(3);

    component.downloadEvidence(fileEvidence);

    expect(
      evidenceServiceSpy.downloadEvidence
    ).toHaveBeenCalledTimes(1);

    pendingDownload.error(new Error('Download cancelled'));

    expect(component.downloadingEvidenceId).toBeNull();
  });

  it('should navigate to the improvement plan for the loaded evaluation', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    component.results = mockResults;

    component.openImprovementPlan();

    expect(navigateSpy).toHaveBeenCalledOnceWith([
      '/user/evaluations',
      1,
      'improvement-plan'
    ]);
  });

  it('should not navigate to the improvement plan without a valid evaluation ID', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    // No existe una evaluación cargada.
    component.results = null;
    component.openImprovementPlan();

    // El identificador es inválido.
    component.results = {
      ...mockResults,
      evaluation_id: 0
    };
    component.openImprovementPlan();

    component.results = {
      ...mockResults,
      evaluation_id: -1
    };
    component.openImprovementPlan();

    component.results = {
      ...mockResults,
      evaluation_id: Number.NaN
    };
    component.openImprovementPlan();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

});