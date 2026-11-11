import { signal, computed } from '@angular/core';
import { CompanyContextService } from '../../../services/company-context.service';
import { CompanyRole, UserCompanyMembership } from '../../../models/company_membership';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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


  beforeEach(async () => {

    evaluationServiceSpy = jasmine.createSpyObj(
      'EvaluationService',
      ['getLastEvaluationResult']
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

  it('should paginate and export the ASG report', async () => {
    const reportElement = document.createElement('div');
    reportElement.setAttribute('data-pdf-root', '');

    const exportContainer = document.createElement('div');
    exportContainer.className = 'asg-report-export';
    exportContainer.appendChild(reportElement);
    document.body.appendChild(exportContainer);

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
          'reporte-asg-1.pdf'
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
    document.body.appendChild(exportContainer);

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
          'reporte-asg-1.pdf'
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

});