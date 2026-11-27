import { signal, computed } from '@angular/core';
import { CompanyContextService } from '../../../services/company-context.service';
import { CompanyRole, UserCompanyMembership } from '../../../models/company_membership';
import { of, Subject, throwError } from 'rxjs';
import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';
import { ResultsComponent } from './results.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { Router } from '@angular/router';
import { AsgReportService } from '../../../services/asg-report.service';
import { AsgReport } from '../../../models/asg_report';
import { AsgReportPaginatorService } from '../../../services/asg-report-paginator.service';
import { AsgPdfService } from '../../../services/asg-pdf.service';
import { AsgReportAssetsService } from '../../../services/asg-report-assets.service';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';

describe('ResultsComponent', () => {
  let component: ResultsComponent;
  let fixture: ComponentFixture<ResultsComponent>;
  let evaluationServiceSpy: jasmine.SpyObj<EvaluationService>;
  let evidenceServiceSpy: jasmine.SpyObj<EvidenceService>;
  let asgReportServiceSpy: jasmine.SpyObj<AsgReportService>;
  let asgReportPaginatorSpy: jasmine.SpyObj<AsgReportPaginatorService>;
  let asgPdfServiceSpy: jasmine.SpyObj<AsgPdfService>;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;
  let companyContextMock: {
    selectedCompanyId: typeof selectedCompanyId;
    selectedMembership: () => UserCompanyMembership | null;
  };

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

  function createTemporaryReportDom(): HTMLElement {

    const exportContainer =
      document.createElement('div');

    exportContainer.className =
      'asg-report-export';

    exportContainer.setAttribute(
      'aria-hidden',
      'true'
    );

    exportContainer.setAttribute(
      'inert',
      ''
    );

    const reportElement =
      document.createElement('div');

    reportElement.setAttribute(
      'data-pdf-root',
      ''
    );

    exportContainer.appendChild(reportElement);

    const host =
      fixture.nativeElement as HTMLElement;

    host.appendChild(exportContainer);

    return exportContainer;
  }

  beforeEach(async () => {
    evaluationServiceSpy = jasmine.createSpyObj(
      'EvaluationService',
      [
        'getLastEvaluationResult',
        'generateAIExplanation'
      ]
    );

    evidenceServiceSpy = jasmine.createSpyObj(
      'EvidenceService',
      ['getEvidences', 'downloadEvidence']
    );
    asgReportServiceSpy = jasmine.createSpyObj(
      'AsgReportService',
      ['getReport']
    );
    asgReportPaginatorSpy = jasmine.createSpyObj(
      'AsgReportPaginatorService',
      ['paginate']
    );

    asgPdfServiceSpy = jasmine.createSpyObj(
      'AsgPdfService',
      ['generatePdf']
    );
    evidenceServiceSpy.getEvidences.and.returnValue(of([]));
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    evaluationServiceSpy.generateAIExplanation.and.returnValue(
      of({
        evaluation_id: 1,
        explanation: 'Explicación de prueba generada por IA.',
        generated_by_ai: true
      })
    );


    selectedCompanyId = signal<number | null>(3);

    const membership: UserCompanyMembership = {
      membership_id: 1,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    companyContextMock = {
      selectedCompanyId,
      selectedMembership: computed(() =>
        selectedCompanyId() === membership.company_id
          ? membership
          : null
      )
    };


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
        },
        {
          provide: AsgReportService,
          useValue: asgReportServiceSpy
        },
        {
          provide: AsgReportPaginatorService,
          useValue: asgReportPaginatorSpy
        },
        {
          provide: AsgPdfService,
          useValue: asgPdfServiceSpy
        },
        {
          provide: CompanyContextService,
          useValue: companyContextMock
        },
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


  it('should preserve evaluation results for the performance component', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    component.loadResults();

    expect(component.results).toEqual(mockResults);

    expect(component.results?.ambits)
      .toEqual(mockResults.ambits);
  });

  it('should calculate the current and previous evaluation periods', () => {
    component.getPeriodo('2026-09-15T12:00:00');

    expect(component.mesActual).toBe('Septiembre');
    expect(component.anioActual).toBe('2026');

    expect(component.mesAnterior).toBe('Marzo');
    expect(component.anioAnterior).toBe('2026');
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

    TestBed.flushEffects();
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

    TestBed.flushEffects();
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

    TestBed.flushEffects();
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
      '/user/improvement/plan',
      1
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

  it('should paginate and export the ASG report', async () => {
    const reportElement = document.createElement('div');
    reportElement.setAttribute('data-pdf-root', '');

    const exportContainer = document.createElement('div');
    exportContainer.className = 'asg-report-export';
    exportContainer.appendChild(reportElement);
    (fixture.nativeElement as HTMLElement)
      .appendChild(exportContainer);

    const workspace = document.createElement('div');
    document.body.appendChild(workspace);

    const page = document.createElement('section');

    const report = {
      evaluation: mockResults
    } as AsgReport;

    component.asgReport = report;

    asgReportPaginatorSpy.paginate.and.returnValue({
      workspace,
      pages: [page]
    });

    asgPdfServiceSpy.generatePdf.and.resolveTo();

    try {
      await component.exportAsgReport();

      expect(asgReportPaginatorSpy.paginate)
        .toHaveBeenCalledOnceWith(reportElement);

      expect(asgPdfServiceSpy.generatePdf)
        .toHaveBeenCalledOnceWith(
          [page],
          'reporte-asg-1.pdf',
          jasmine.any(Function)
        );

      expect(workspace.isConnected).toBeFalse();
    } finally {
      exportContainer.remove();
      workspace.remove();
    }
  });

  it('should clean up the workspace when PDF generation fails', async () => {
    const reportElement = document.createElement('div');
    reportElement.setAttribute('data-pdf-root', '');

    const exportContainer = document.createElement('div');
    exportContainer.className = 'asg-report-export';
    exportContainer.appendChild(reportElement);
    (fixture.nativeElement as HTMLElement)
      .appendChild(exportContainer);

    const workspace = document.createElement('div');
    document.body.appendChild(workspace);

    const page = document.createElement('section');

    component.asgReport = {
      evaluation: mockResults
    } as AsgReport;

    asgReportPaginatorSpy.paginate.and.returnValue({
      workspace,
      pages: [page]
    });

    asgPdfServiceSpy.generatePdf.and.rejectWith(
      new Error('No se pudo generar el PDF')
    );

    try {
      await expectAsync(
        component.exportAsgReport()
      ).toBeRejectedWithError(
        'No se pudo generar el PDF'
      );

      expect(asgReportPaginatorSpy.paginate)
        .toHaveBeenCalledOnceWith(reportElement);

      expect(asgPdfServiceSpy.generatePdf)
        .toHaveBeenCalledOnceWith(
          [page],
          'reporte-asg-1.pdf',
          jasmine.any(Function)
        );

      expect(workspace.isConnected).toBeFalse();
    } finally {
      exportContainer.remove();
      workspace.remove();
    }
  });

  it('should download the ASG report for the current evaluation', async () => {
    const report = {
      evaluation: mockResults
    } as AsgReport;

    component.results = mockResults;

    asgReportServiceSpy.getReport.and.returnValue(of(report));

    const renderSpy = spyOn(
      component as any,
      'waitForReportRender'
    ).and.resolveTo();

    const exportSpy = spyOn(
      component,
      'exportAsgReport'
    ).and.resolveTo();

    await component.downloadAsgReport();

    expect(asgReportServiceSpy.getReport)
      .toHaveBeenCalledOnceWith(1);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledTimes(1);

    expect(renderSpy)
      .toHaveBeenCalledBefore(exportSpy);

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();
    expect(component.asgReportError).toBeNull();
  });

  it('should handle errors when fetching data for ASG PDF', async () => {
    component.results = mockResults;

    asgReportServiceSpy.getReport.and.returnValue(
      throwError(() => new Error('Error de conexión'))
    );

    const exportSpy = spyOn(
      component,
      'exportAsgReport'
    ).and.resolveTo();

    spyOn(console, 'error');

    await component.downloadAsgReport();

    expect(asgReportServiceSpy.getReport)
      .toHaveBeenCalledOnceWith(1);

    expect(exportSpy).not.toHaveBeenCalled();

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();

    expect(component.asgReportError).toBe(
      'No se pudo generar el reporte ASG. Inténtalo nuevamente.'
    );
  });

  it('should handle errors during ASG PDF export', async () => {
    const report = {
      evaluation: mockResults
    } as AsgReport;

    component.results = mockResults;

    asgReportServiceSpy.getReport.and.returnValue(of(report));

    const renderSpy = spyOn(
      component as any,
      'waitForReportRender'
    ).and.resolveTo();

    const exportSpy = spyOn(
      component,
      'exportAsgReport'
    ).and.rejectWith(
      new Error('Error durante la exportación')
    );

    spyOn(console, 'error');

    await component.downloadAsgReport();

    expect(asgReportServiceSpy.getReport)
      .toHaveBeenCalledOnceWith(1);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(exportSpy).toHaveBeenCalledTimes(1);

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();

    expect(component.asgReportError).toBe(
      'No se pudo generar el reporte ASG. Inténtalo nuevamente.'
    );
  });

  it('should ignore pending evidence from the previous company', () => {
    const pendingEvidence = new Subject<EvaluationEvidence[]>();

    const companyBResults: ResultEvaluation = {
      ...mockResults,
      evaluation_id: 2,
      date: '2026-10-20T12:00:00'
    };

    const companyBEvidences: EvaluationEvidence[] = [
      {
        ...mockEvidences[0],
        id: 10,
        evaluation_id: 2,
        content: 'Evidencia de Empresa B'
      }
    ];

    evaluationServiceSpy.getLastEvaluationResult.and.returnValues(
      of(mockResults),
      of(companyBResults)
    );

    evidenceServiceSpy.getEvidences.and.returnValues(
      pendingEvidence.asObservable(),
      of(companyBEvidences)
    );

    // Empresa A
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.results?.evaluation_id).toBe(1);
    expect(component.loadingEvidences).toBeTrue();

    // Cambiar a Empresa B
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.results?.evaluation_id).toBe(2);
    expect(component.evidences).toEqual(companyBEvidences);

    // Simular una respuesta tardía de Empresa A
    pendingEvidence.next(mockEvidences);

    expect(component.evidences).toEqual(companyBEvidences);
    expect(component.loadingEvidences).toBeFalse();

    expect(
      evidenceServiceSpy.getEvidences
    ).toHaveBeenCalledTimes(2);
  });

  it('should cancel a pending evidence download when switching companies', () => {
    const pendingDownload = new Subject<Blob>();

    const fileEvidence: EvaluationEvidence = {
      ...mockEvidences[0],
      id: 3,
      type: 'FILE',
      content: null,
      original_filename: 'evidencia.pdf',
      mime_type: 'application/pdf',
      file_size: 2048
    };

    evidenceServiceSpy.downloadEvidence.and.returnValue(
      pendingDownload.asObservable()
    );

    component.results = mockResults;

    component.downloadEvidence(fileEvidence);

    expect(component.downloadingEvidenceId).toBe(3);
    expect(pendingDownload.observed).toBeTrue();

    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(pendingDownload.observed).toBeFalse();
    expect(component.downloadingEvidenceId).toBeNull();
  });

  it('should not export an ASG report after switching companies', async () => {
    const pendingReport = new Subject<AsgReport>();

    asgReportServiceSpy.getReport.and.returnValue(
      pendingReport.asObservable()
    );

    component.results = mockResults;

    // Comenzar la generación del reporte en Empresa A.
    const downloadPromise = component.downloadAsgReport();

    expect(asgReportServiceSpy.getReport).toHaveBeenCalledWith(
      mockResults.evaluation_id
    );

    expect(component.generatingAsgReport).toBeTrue();

    // Cambiar a Empresa B mientras el reporte está pendiente.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // El backend responde con el reporte de Empresa A.
    pendingReport.next({} as AsgReport);
    pendingReport.complete();

    await downloadPromise;

    // No debe iniciar la exportación del reporte anterior.
    expect(asgReportPaginatorSpy.paginate).not.toHaveBeenCalled();
    expect(asgPdfServiceSpy.generatePdf).not.toHaveBeenCalled();

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();
  });

  it('should generate an AI explanation for the current evaluation', () => {
    component.results = mockResults;

    component.generateAIExplanation();

    expect(
      evaluationServiceSpy.generateAIExplanation
    ).toHaveBeenCalledOnceWith(1);

    expect(component.aiExplanation).toBe(
      'Explicación de prueba generada por IA.'
    );

    expect(component.generatingAIExplanation).toBeFalse();
    expect(component.aiExplanationError).toBeNull();
  });

  it('should handle AI explanation errors and allow retry', () => {
    component.results = mockResults;

    evaluationServiceSpy.generateAIExplanation.and.returnValue(
      throwError(() => new Error('AI service unavailable'))
    );

    component.generateAIExplanation();

    expect(component.aiExplanation).toBeNull();
    expect(component.generatingAIExplanation).toBeFalse();
    expect(component.aiExplanationError).toBe(
      'No fue posible generar la explicación. Inténtalo nuevamente.'
    );

    evaluationServiceSpy.generateAIExplanation.and.returnValue(
      of({
        evaluation_id: 1,
        explanation: 'Explicación generada correctamente.',
        generated_by_ai: true
      })
    );

    component.generateAIExplanation();

    expect(
      evaluationServiceSpy.generateAIExplanation
    ).toHaveBeenCalledTimes(2);

    expect(component.aiExplanation).toBe(
      'Explicación generada correctamente.'
    );
    expect(component.aiExplanationError).toBeNull();
    expect(component.generatingAIExplanation).toBeFalse();
  });

  it('should prevent duplicate AI explanation requests', () => {
    component.results = mockResults;

    const pendingResponse = new Subject<{
      evaluation_id: number;
      explanation: string;
      generated_by_ai: boolean;
    }>();

    evaluationServiceSpy.generateAIExplanation.and.returnValue(
      pendingResponse.asObservable()
    );

    component.generateAIExplanation();
    component.generateAIExplanation();

    expect(
      evaluationServiceSpy.generateAIExplanation
    ).toHaveBeenCalledTimes(1);

    expect(component.generatingAIExplanation).toBeTrue();

    pendingResponse.next({
      evaluation_id: 1,
      explanation: 'Explicación generada correctamente.',
      generated_by_ai: true
    });
    pendingResponse.complete();

    expect(component.generatingAIExplanation).toBeFalse();
    expect(component.aiExplanation).toBe(
      'Explicación generada correctamente.'
    );
  });

  it('should cancel AI explanation when company changes', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.results = mockResults;

    const pendingResponse = new Subject<{
      evaluation_id: number;
      explanation: string;
      generated_by_ai: boolean;
    }>();

    evaluationServiceSpy.generateAIExplanation.and.returnValue(
      pendingResponse.asObservable()
    );

    component.generateAIExplanation();

    expect(component.generatingAIExplanation).toBeTrue();
    expect(pendingResponse.observed).toBeTrue();

    selectedCompanyId.set(null);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(pendingResponse.observed).toBeFalse();
    expect(component.aiExplanation).toBeNull();
    expect(component.aiExplanationError).toBeNull();
    expect(component.generatingAIExplanation).toBeFalse();
    expect(component.results).toBeNull();

    pendingResponse.next({
      evaluation_id: 1,
      explanation: 'Explicación de la empresa anterior.',
      generated_by_ai: true
    });
    pendingResponse.complete();

    expect(component.aiExplanation).toBeNull();
  });

  it('should reject AI explanation for a different evaluation', () => {
    component.results = mockResults;

    evaluationServiceSpy.generateAIExplanation.and.returnValue(
      of({
        evaluation_id: 999,
        explanation: 'Explicación de otra evaluación.',
        generated_by_ai: true
      })
    );

    component.generateAIExplanation();

    expect(
      evaluationServiceSpy.generateAIExplanation
    ).toHaveBeenCalledOnceWith(1);

    expect(component.aiExplanation).toBeNull();
    expect(component.aiExplanationError).toBe(
      'No se recibió una explicación válida.'
    );
    expect(component.generatingAIExplanation).toBeFalse();

    expect(component.results?.global_score).toBe(8.5);
  });

  [
    {
      name: 'empty explanation',
      explanation: '   ',
      generated_by_ai: true
    },
    {
      name: 'missing AI indicator',
      explanation: 'Explicación de prueba.',
      generated_by_ai: false
    }
  ].forEach(testCase => {
    it(`should reject AI response with ${testCase.name}`, () => {
      component.results = mockResults;

      evaluationServiceSpy.generateAIExplanation.and.returnValue(
        of({
          evaluation_id: 1,
          explanation: testCase.explanation,
          generated_by_ai: testCase.generated_by_ai
        })
      );

      component.generateAIExplanation();

      expect(component.aiExplanation).toBeNull();
      expect(component.aiExplanationError).toBe(
        'No se recibió una explicación válida.'
      );
      expect(component.generatingAIExplanation).toBeFalse();

      expect(component.results?.global_score).toBe(8.5);
    });
  });

  it('should identify the highest and lowest scoring ambits', () => {

    const baseAmbit = mockResults.ambits[0];

    component.results = {
      ...mockResults,
      ambits: [
        {
          ...baseAmbit,
          ambit_id: 1,
          score: 9.8
        },
        {
          ...baseAmbit,
          ambit_id: 2,
          score: 9.6
        },
        {
          ...baseAmbit,
          ambit_id: 3,
          score: 9.0
        }
      ]
    };

    expect(
      component.highestScoringAmbits.map(
        ambit => ambit.ambit_id
      )
    ).toEqual([1]);

    expect(
      component.lowestScoringAmbits.map(
        ambit => ambit.ambit_id
      )
    ).toEqual([3]);

  });

  it('should preserve all ambits tied for the highest score', () => {

    const baseAmbit = mockResults.ambits[0];

    component.results = {
      ...mockResults,
      ambits: [
        {
          ...baseAmbit,
          ambit_id: 1,
          score: 9.8
        },
        {
          ...baseAmbit,
          ambit_id: 2,
          score: 9.8
        },
        {
          ...baseAmbit,
          ambit_id: 3,
          score: 9.0
        }
      ]
    };

    expect(
      component.highestScoringAmbits.map(
        ambit => ambit.ambit_id
      )
    ).toEqual([1, 2]);

  });

  it('should preserve all ambits tied for the lowest score', () => {

    const baseAmbit = mockResults.ambits[0];

    component.results = {
      ...mockResults,
      ambits: [
        {
          ...baseAmbit,
          ambit_id: 1,
          score: 9.8
        },
        {
          ...baseAmbit,
          ambit_id: 2,
          score: 9.0
        },
        {
          ...baseAmbit,
          ambit_id: 3,
          score: 9.0
        }
      ]
    };

    expect(
      component.lowestScoringAmbits.map(
        ambit => ambit.ambit_id
      )
    ).toEqual([2, 3]);

  });

  it('should handle an empty collection of ambits', () => {

    component.results = {
      ...mockResults,
      ambits: []
    };

    expect(component.highestScoringAmbits)
      .toEqual([]);

    expect(component.lowestScoringAmbits)
      .toEqual([]);

  });

  it('should ignore non-finite scores in performance insights', () => {

    const baseAmbit = mockResults.ambits[0];

    component.results = {
      ...mockResults,
      ambits: [
        {
          ...baseAmbit,
          ambit_id: 1,
          score: Number.NaN
        },
        {
          ...baseAmbit,
          ambit_id: 2,
          score: Number.POSITIVE_INFINITY
        },
        {
          ...baseAmbit,
          ambit_id: 3,
          score: 8.5
        }
      ]
    };

    expect(
      component.highestScoringAmbits.map(
        ambit => ambit.ambit_id
      )
    ).toEqual([3]);

    expect(
      component.lowestScoringAmbits.map(
        ambit => ambit.ambit_id
      )
    ).toEqual([3]);

  });
  it('should navigate to the recommendations page', () => {

    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    const companyContext =
      TestBed.inject(CompanyContextService);

    companyContext.selectedCompanyId.set(1);

    component.results = mockResults;

    component.openRecommendations();

    expect(navigateSpy).toHaveBeenCalledOnceWith([
      '/user/improvement/recommendations'
    ]);

  });

  it('should not navigate to recommendations without results', () => {

    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    const companyContext =
      TestBed.inject(CompanyContextService);

    companyContext.selectedCompanyId.set(1);

    component.results = null;

    component.openRecommendations();

    expect(navigateSpy).not.toHaveBeenCalled();

  });

  it('should not navigate to recommendations without a selected company', () => {

    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    const companyContext =
      TestBed.inject(CompanyContextService);

    companyContext.selectedCompanyId.set(null);

    component.results = mockResults;

    component.openRecommendations();

    expect(navigateSpy).not.toHaveBeenCalled();

  });


  it('should render contextual actions without detailed recommendations', () => {

    component.results = mockResults;

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    // Evitar duplicación de recomendaciones detalladas.
    expect(
      element.querySelector('feedback-component')
    ).toBeNull();

    // Verificar la nueva sección de acciones contextuales.
    const nextSteps = element.querySelector(
      '.results-next-steps'
    );

    expect(nextSteps).not.toBeNull();

    // Verificar que existen exactamente dos tarjetas.
    const cards = nextSteps?.querySelectorAll(
      '.results-next-card'
    );

    expect(cards?.length).toBe(2);

    // Verificar el contenido de ambas tarjetas.
    expect(cards?.[0]?.textContent)
      .toContain('Recomendaciones ASG');

    expect(cards?.[1]?.textContent)
      .toContain('Plan de mejora');

  });
  it('should not render the temporary PDF container without a report', () => {
    component.asgReport = null;

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('.asg-report-export')
    ).toBeNull();

    expect(
      element.querySelector('[data-pdf-root]')
    ).toBeNull();
  });
  it('should isolate the temporary PDF container and remove it when the report is cleared', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const report: AsgReport = {
      company: {
        id: 3,
        name: 'Empresa A'
      },
      evaluation: mockResults,
      comparison: null,
      improvement_actions: [],
      improvement_progress: {
        evaluation_id: 1,
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        progress_percentage: 0
      }
    };

    component.asgReport = report;
    component.generatingAsgReport = true;

    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    const exportContainer =
      element.querySelector<HTMLElement>(
        '.asg-report-export'
      );

    expect(exportContainer).not.toBeNull();

    expect(
      exportContainer?.getAttribute('aria-hidden')
    ).toBe('true');

    expect(
      exportContainer?.hasAttribute('inert')
    ).toBeTrue();

    expect(exportContainer?.inert).toBeTrue();

    const reportRoot =
      exportContainer?.querySelector<HTMLElement>(
        '[data-pdf-root]'
      );

    expect(reportRoot).toBeTruthy();

    if (exportContainer && reportRoot) {
      const styles = getComputedStyle(exportContainer);
      const bounds = reportRoot.getBoundingClientRect();

      expect(styles.display).not.toBe('none');
      expect(styles.visibility).not.toBe('hidden');
      expect(styles.opacity).not.toBe('0');

      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
    }

    component.asgReport = null;
    component.generatingAsgReport = false;

    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(
      element.querySelector('.asg-report-export')
    ).toBeNull();

    expect(
      element.querySelector('[data-pdf-root]')
    ).toBeNull();
  });
  it('should remove the temporary PDF container when export fails', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const report: AsgReport = {
      company: {
        id: 3,
        name: 'Empresa A'
      },
      evaluation: mockResults,
      comparison: null,
      improvement_actions: [],
      improvement_progress: {
        evaluation_id: 1,
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        progress_percentage: 0
      }
    };

    component.results = mockResults;

    asgReportServiceSpy.getReport.and.returnValue(
      of(report)
    );

    spyOn(
      component as any,
      'waitForReportRender'
    ).and.callFake(async () => {
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
    });

    const element = fixture.nativeElement as HTMLElement;

    const exportSpy = spyOn(
      component,
      'exportAsgReport'
    ).and.callFake(async () => {
      expect(
        element.querySelector('.asg-report-export')
      ).not.toBeNull();

      throw new Error('Error simulado de exportación');
    });

    spyOn(console, 'error');

    await component.downloadAsgReport();

    fixture.detectChanges();

    expect(exportSpy).toHaveBeenCalledTimes(1);

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();

    expect(component.asgReportError).toBe(
      'No se pudo generar el reporte ASG. Inténtalo nuevamente.'
    );

    expect(
      element.querySelector('.asg-report-export')
    ).toBeNull();

    expect(
      element.querySelector('[data-pdf-root]')
    ).toBeNull();
  });

  it('should not paginate a report cancelled during asset preparation', async () => {
    const assetsService = TestBed.inject(
      AsgReportAssetsService
    );

    const exportContainer = createTemporaryReportDom();

    try {
      component.asgReport = {
        company: {
          id: 3,
          name: 'Empresa A'
        },
        evaluation: mockResults,
        comparison: null,
        improvement_actions: [],
        improvement_progress: {
          evaluation_id: 1,
          total: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
          progress_percentage: 0
        }
      };

      component.generatingAsgReport = true;

      let active = true;

      let resolveAssets!: () => void;

      const assetsReady = new Promise<void>(
        resolve => {
          resolveAssets = resolve;
        }
      );

      const assetsSpy = spyOn(
        assetsService,
        'waitForAssets'
      ).and.returnValue(assetsReady);

      const exportPromise = component.exportAsgReport(
        () => active
      );

      expect(assetsSpy).toHaveBeenCalledTimes(1);

      // Invalidar la exportación durante
      // la preparación de recursos.
      active = false;

      resolveAssets();

      await exportPromise;

      expect(
        asgReportPaginatorSpy.paginate
      ).not.toHaveBeenCalled();

      expect(
        asgPdfServiceSpy.generatePdf
      ).not.toHaveBeenCalled();

    } finally {
      exportContainer.remove();

      component.asgReport = null;
      component.generatingAsgReport = false;
    }
  });
  it('should remove the PDF workspace after a cancelled export', async () => {
    const assetsService = TestBed.inject(
      AsgReportAssetsService
    );

    spyOn(
      assetsService,
      'waitForAssets'
    ).and.resolveTo();

    const exportContainer = createTemporaryReportDom();

    const workspace = document.createElement('div');

    workspace.setAttribute(
      'data-pdf-workspace',
      ''
    );

    const page = document.createElement('div');

    workspace.appendChild(page);

    exportContainer.appendChild(workspace);

    try {
      component.asgReport = {
        company: {
          id: 3,
          name: 'Empresa A'
        },
        evaluation: mockResults,
        comparison: null,
        improvement_actions: [],
        improvement_progress: {
          evaluation_id: 1,
          total: 0,
          pending: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
          progress_percentage: 0
        }
      };

      component.generatingAsgReport = true;

      let active = true;

      asgReportPaginatorSpy.paginate.and.returnValue({
        workspace,
        pages: [page]
      });

      asgPdfServiceSpy.generatePdf.and.callFake(
        async (_pages, _filename, shouldContinue) => {

          expect(workspace.isConnected).toBeTrue();

          expect(shouldContinue?.()).toBeTrue();

          // Invalidar la exportación durante
          // la generación del PDF.
          active = false;

          expect(shouldContinue?.()).toBeFalse();
        }
      );

      await component.exportAsgReport(
        () => active
      );

      expect(
        asgReportPaginatorSpy.paginate
      ).toHaveBeenCalledTimes(1);

      expect(
        asgPdfServiceSpy.generatePdf
      ).toHaveBeenCalledTimes(1);

      expect(workspace.isConnected).toBeFalse();

      expect(
        exportContainer.querySelector(
          '[data-pdf-workspace]'
        )
      ).toBeNull();

    } finally {
      workspace.remove();
      exportContainer.remove();

      component.asgReport = null;
      component.generatingAsgReport = false;
    }
  });
  it('should invalidate a pending ASG report after switching companies and returning to the original company', async () => {
    const pendingReport = new Subject<AsgReport>();

    const companyBResults: ResultEvaluation = {
      ...mockResults,
      evaluation_id: 2
    };

    evaluationServiceSpy.getLastEvaluationResult.and.returnValues(
      of(mockResults),
      of(companyBResults),
      of(mockResults)
    );

    asgReportServiceSpy.getReport.and.returnValue(
      pendingReport.asObservable()
    );

    const renderSpy = spyOn(
      component as any,
      'waitForReportRender'
    ).and.resolveTo();

    const exportSpy = spyOn(
      component,
      'exportAsgReport'
    ).and.resolveTo();

    // Inicializar el contexto de Empresa A.
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(selectedCompanyId()).toBe(3);
    expect(component.results?.evaluation_id).toBe(1);

    // Iniciar la descarga en Empresa A.
    const downloadPromise = component.downloadAsgReport();

    expect(component.generatingAsgReport).toBeTrue();

    expect(asgReportServiceSpy.getReport)
      .toHaveBeenCalledOnceWith(1);

    // Cambiar a Empresa B.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(selectedCompanyId()).toBe(7);
    expect(component.results?.evaluation_id).toBe(2);

    // Regresar a Empresa A.
    selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(selectedCompanyId()).toBe(3);
    expect(component.results?.evaluation_id).toBe(1);

    // Recibir tardíamente el reporte original.
    pendingReport.next({
      evaluation: mockResults
    } as AsgReport);

    pendingReport.complete();

    await downloadPromise;

    expect(renderSpy).not.toHaveBeenCalled();
    expect(exportSpy).not.toHaveBeenCalled();

    expect(
      asgReportPaginatorSpy.paginate
    ).not.toHaveBeenCalled();

    expect(
      asgPdfServiceSpy.generatePdf
    ).not.toHaveBeenCalled();

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();
    expect(component.asgReportError).toBeNull();
  });
  it('should invalidate a pending ASG report when the component is destroyed', async () => {
    const pendingReport = new Subject<AsgReport>();

    asgReportServiceSpy.getReport.and.returnValue(
      pendingReport.asObservable()
    );

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.results?.evaluation_id).toBe(1);

    const renderSpy = spyOn(
      component as any,
      'waitForReportRender'
    ).and.resolveTo();

    const exportSpy = spyOn(
      component,
      'exportAsgReport'
    ).and.resolveTo();

    const consoleErrorSpy = spyOn(
      console,
      'error'
    );

    const downloadPromise = component.downloadAsgReport();

    expect(component.generatingAsgReport).toBeTrue();

    expect(asgReportServiceSpy.getReport)
      .toHaveBeenCalledOnceWith(1);

    // Simular la destrucción del componente
    // mientras se espera la respuesta del reporte.
    fixture.destroy();

    pendingReport.next({
      evaluation: mockResults
    } as AsgReport);

    pendingReport.complete();

    await downloadPromise;

    expect(renderSpy).not.toHaveBeenCalled();
    expect(exportSpy).not.toHaveBeenCalled();

    expect(
      asgReportPaginatorSpy.paginate
    ).not.toHaveBeenCalled();

    expect(
      asgPdfServiceSpy.generatePdf
    ).not.toHaveBeenCalled();

    expect(consoleErrorSpy).not.toHaveBeenCalled();

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();
    expect(component.asgReportError).toBeNull();
  });
  it('should suppress ASG export errors after switching companies', async () => {
    const companyBResults: ResultEvaluation = {
      ...mockResults,
      evaluation_id: 2
    };

    evaluationServiceSpy.getLastEvaluationResult.and.returnValues(
      of(mockResults),
      of(companyBResults)
    );

    const report = {
      evaluation: mockResults
    } as AsgReport;

    asgReportServiceSpy.getReport.and.returnValue(
      of(report)
    );

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.results?.evaluation_id).toBe(1);

    spyOn(
      component as any,
      'waitForReportRender'
    ).and.resolveTo();

    const consoleErrorSpy = spyOn(
      console,
      'error'
    );

    let rejectExport!: (reason: Error) => void;

    const pendingExport = new Promise<void>(
      (_, reject) => {
        rejectExport = reject;
      }
    );

    let notifyExportStarted!: () => void;

    const exportStarted = new Promise<void>(
      resolve => {
        notifyExportStarted = resolve;
      }
    );

    let exportGuard: (() => boolean) | undefined;

    const exportSpy = spyOn(
      component,
      'exportAsgReport'
    ).and.callFake((shouldContinue) => {
      exportGuard = shouldContinue;

      notifyExportStarted();

      return pendingExport;
    });

    const downloadPromise = component.downloadAsgReport();

    // Esperar explícitamente el inicio de la exportación.
    await exportStarted;

    expect(exportSpy).toHaveBeenCalledTimes(1);
    expect(exportGuard?.()).toBeTrue();

    // Cambiar a Empresa B durante la exportación.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.results?.evaluation_id).toBe(2);
    expect(exportGuard?.()).toBeFalse();

    // Simular un error tardío de la exportación anterior.
    rejectExport(
      new Error('Error de exportación de Empresa A')
    );

    await downloadPromise;

    expect(component.asgReportError).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    expect(component.asgReport).toBeNull();
    expect(component.generatingAsgReport).toBeFalse();

    // Los resultados de Empresa B deben conservarse.
    expect(component.results?.evaluation_id).toBe(2);
    expect(selectedCompanyId()).toBe(7);
  });
  it('should ignore PDF templates outside the component host', async () => {

    const externalContainer = document.createElement('div');

    externalContainer.className = 'asg-report-export';

    const externalReport = document.createElement('div');

    externalReport.setAttribute('data-pdf-root', '');

    externalContainer.appendChild(externalReport);

    document.body.appendChild(externalContainer);

    const assetsService = TestBed.inject(
      AsgReportAssetsService
    );

    const assetsSpy = spyOn(
      assetsService,
      'waitForAssets'
    ).and.resolveTo();

    try {

      component.asgReport = {
        evaluation: mockResults
      } as AsgReport;

      await expectAsync(
        component.exportAsgReport()
      ).toBeRejectedWithError(
        'La plantilla del reporte ASG no está disponible.'
      );

      expect(assetsSpy).not.toHaveBeenCalled();

      expect(
        asgReportPaginatorSpy.paginate
      ).not.toHaveBeenCalled();

      expect(
        asgPdfServiceSpy.generatePdf
      ).not.toHaveBeenCalled();

    } finally {

      externalContainer.remove();

      component.asgReport = null;
    }
  });
  it('should select only the PDF template belonging to the component host', async () => {

    const externalContainer = document.createElement('div');

    externalContainer.className = 'asg-report-export';

    const externalReport = document.createElement('div');

    externalReport.setAttribute('data-pdf-root', '');

    externalContainer.appendChild(externalReport);

    document.body.prepend(externalContainer);

    const exportContainer = createTemporaryReportDom();

    const ownReport =
      exportContainer.querySelector<HTMLElement>(
        '[data-pdf-root]'
      )!;

    const workspace = document.createElement('div');

    workspace.setAttribute('data-pdf-workspace', '');

    const page = document.createElement('div');

    workspace.appendChild(page);

    exportContainer.appendChild(workspace);

    const assetsService = TestBed.inject(
      AsgReportAssetsService
    );

    const assetsSpy = spyOn(
      assetsService,
      'waitForAssets'
    ).and.resolveTo();

    asgReportPaginatorSpy.paginate.and.returnValue({
      workspace,
      pages: [page]
    });

    asgPdfServiceSpy.generatePdf.and.resolveTo();

    try {

      component.asgReport = {
        evaluation: mockResults
      } as AsgReport;

      await component.exportAsgReport();

      expect(assetsSpy)
  .toHaveBeenCalledTimes(1);

expect(asgReportPaginatorSpy.paginate)
  .toHaveBeenCalledTimes(1);

const preparedReport =
  assetsSpy.calls.mostRecent().args[0];

const paginatedReport =
  asgReportPaginatorSpy.paginate
    .calls.mostRecent().args[0];

// Comprobar identidad de referencia.
expect(preparedReport).toBe(ownReport);
expect(paginatedReport).toBe(ownReport);

// Confirmar que no se utilizó la plantilla externa.
expect(preparedReport).not.toBe(externalReport);
expect(paginatedReport).not.toBe(externalReport);

      expect(asgPdfServiceSpy.generatePdf)
        .toHaveBeenCalledOnceWith(
          [page],
          'reporte-asg-1.pdf',
          jasmine.any(Function)
        );

      expect(workspace.isConnected).toBeFalse();

      expect(externalContainer.isConnected).toBeTrue();

    } finally {

      workspace.remove();

      exportContainer.remove();

      externalContainer.remove();

      component.asgReport = null;
    }
  });
  it('should reject when report rendering exceeds the timeout', fakeAsync(() => {

    let capturedError: Error | undefined;

    let resolved = false;

    const rendering: Promise<void> =
      (component as any).waitForReportRender(100);

    rendering.then(
      () => {
        resolved = true;
      },
      (error: Error) => {
        capturedError = error;
      }
    );

    // No ejecutar fixture.detectChanges(),
    // para mantener pendiente la renderización.

    tick(100, {
      processNewMacroTasksSynchronously: false
    });

    expect(resolved).toBeFalse();

    expect(capturedError?.message).toBe(
      'Se agotó el tiempo de renderización del reporte ASG.'
    );

  }));
  it('should release pending report rendering when the component is destroyed', fakeAsync(() => {

    let resolved = false;

    let capturedError: Error | undefined;

    const rendering: Promise<void> =
      (component as any).waitForReportRender(10000);

    rendering.then(
      () => {
        resolved = true;
      },
      (error: Error) => {
        capturedError = error;
      }
    );

    // Destruir el componente antes de renderizar.
    fixture.destroy();

    tick(0);

    expect(resolved).toBeTrue();

    expect(capturedError).toBeUndefined();

  }));
});