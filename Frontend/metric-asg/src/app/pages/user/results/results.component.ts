import {
  EMPTY,
  firstValueFrom,
  switchMap,
  tap,
  catchError,
  Subscription
} from 'rxjs';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Injector,
  DestroyRef,
  afterNextRender,
  inject,
  ElementRef
} from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { SessionService } from '../../../shared/class/temporalStorage';

import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';
import { Router } from '@angular/router';
import { AsgReport } from '../../../models/asg_report';
import { AsgReportService } from '../../../services/asg-report.service';
import { AsgReportPaginatorService } from '../../../services/asg-report-paginator.service';
import { AsgPdfService } from '../../../services/asg-pdf.service';
import { AsgReportTemplateComponent } from '../../../shared/asg-report-template/asg-report-template.component';
import { CompanyContextService } from '../../../services/company-context.service';
import { ResultsAiComponent } from './results-ai/results-ai.component';
import {
  ResultsEvidencesComponent
} from './results-evidences/results-evidences.component';
import {
  ResultsPerformanceComponent
} from './results-performance/results-performance.component';

import {
  isValidAsgScore
} from '../../../shared/utils/asg-score.utils';

import { AsgReportAssetsService } from '../../../services/asg-report-assets.service';


@Component({
  selector: 'app-results',
  standalone: true,
  imports: [
    AsgReportTemplateComponent,
    ResultsAiComponent,
    ResultsEvidencesComponent,
    ResultsPerformanceComponent
  ],
  templateUrl: './results.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './results.component.scss'
})
export class ResultsComponent {
  id_user: number = SessionService.getSessionItem('id') ?? 0;
  name = '';
  mesActual = '';
  anioActual = '';
  mesAnterior = '';
  anioAnterior = '';

  results: ResultEvaluation | null = null;
  evidences: EvaluationEvidence[] = [];
  loadingEvidences = false;
  evidencesError = false;

  downloadingEvidenceId: number | null = null;
  evidenceDownloadError: string | null = null;

  asgReport: AsgReport | null = null;

  generatingAsgReport = false;

  asgReportError: string | null = null;

  private evidenceRequest?: Subscription;
  private evidenceDownloadRequest?: Subscription;


  aiExplanation: string | null = null;
  generatingAIExplanation = false;
  aiExplanationError: string | null = null;

  private aiExplanationRequest?: Subscription;

  private readonly asgReportAssets =
    inject(AsgReportAssetsService);

  private readonly hostElement =
    inject<ElementRef<HTMLElement>>(ElementRef);

  private reportContextVersion = 0;

  private componentDestroyed = false;

  get highestScoringAmbits() {

    const ambits = (this.results?.ambits ?? [])
      .filter(ambit => isValidAsgScore(ambit.score));

    if (!ambits.length) {
      return [];
    }

    const highestScore = Math.max(
      ...ambits.map(ambit => ambit.score)
    );

    return ambits.filter(
      ambit => ambit.score === highestScore
    );

  }

  get lowestScoringAmbits() {

    const ambits = (this.results?.ambits ?? [])
      .filter(ambit => isValidAsgScore(ambit.score));

    if (!ambits.length) {
      return [];
    }

    const lowestScore = Math.min(
      ...ambits.map(ambit => ambit.score)
    );

    return ambits.filter(
      ambit => ambit.score === lowestScore
    );

  }

  constructor(
    private resultService: EvaluationService,
    private evidenceService: EvidenceService,
    private router: Router,
    private asgReportService: AsgReportService,
    private asgReportPaginator: AsgReportPaginatorService,
    private asgPdfService: AsgPdfService,
    private cdr: ChangeDetectorRef,
    private injector: Injector,
    private companyContext: CompanyContextService,
    private destroyRef: DestroyRef
  ) {
    this.destroyRef.onDestroy(() => {
      this.componentDestroyed = true;
      this.reportContextVersion++;
    });
    toObservable(this.companyContext.selectedCompanyId)
      .pipe(
        tap(() => {
          // Invalidar exportaciones pertenecientes
          // al contexto empresarial anterior.
          this.reportContextVersion++;

          this.evidenceRequest?.unsubscribe();
          this.evidenceDownloadRequest?.unsubscribe();
          this.aiExplanationRequest?.unsubscribe();

          this.clearResultsState();

          this.aiExplanation = null;
          this.generatingAIExplanation = false;
          this.aiExplanationError = null;

          this.downloadingEvidenceId = null;

          this.name =
            this.companyContext.selectedMembership()?.company_name ?? '';
        }),
        switchMap(companyId => {
          if (companyId === null) {
            return EMPTY;
          }

          return this.resultService.getLastEvaluationResult().pipe(
            catchError(error => {
              console.error('Error al cargar resultados:', error);
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(data => {
        this.results = data;
        this.getPeriodo(data.date);
        this.loadEvidences(data.evaluation_id);
      });

  }

  openRecommendations(): void {

    if (
      !this.results ||
      this.companyContext.selectedCompanyId() === null
    ) {
      return;
    }

    void this.router.navigate([
      '/user/improvement/recommendations'
    ]);

  }


  openImprovementPlan(): void {
    const evaluationId = this.results?.evaluation_id;

    if (
      evaluationId === undefined ||
      !Number.isSafeInteger(evaluationId) ||
      evaluationId <= 0
    ) {
      return;
    }

    void this.router.navigate([
      '/user/improvement/plan',
      evaluationId
    ]);
  }


  generateAIExplanation(): void {
    const evaluationId = this.results?.evaluation_id;

    if (
      evaluationId === undefined ||
      !Number.isSafeInteger(evaluationId) ||
      evaluationId <= 0 ||
      this.generatingAIExplanation
    ) {
      return;
    }

    this.aiExplanationRequest?.unsubscribe();

    this.aiExplanation = null;
    this.aiExplanationError = null;
    this.generatingAIExplanation = true;

    this.aiExplanationRequest = this.resultService
      .generateAIExplanation(evaluationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          if (
            response.evaluation_id !== evaluationId ||
            response.generated_by_ai !== true ||
            !response.explanation.trim()
          ) {
            this.aiExplanationError =
              'No se recibió una explicación válida.';
          } else {
            this.aiExplanation = response.explanation;
          }

          this.generatingAIExplanation = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.aiExplanationError =
            'No fue posible generar la explicación. Inténtalo nuevamente.';
          this.generatingAIExplanation = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadEvidences(evaluationId: number): void {
    this.evidenceRequest?.unsubscribe();

    this.loadingEvidences = true;
    this.evidencesError = false;
    this.evidences = [];

    this.evidenceRequest = this.evidenceService
      .getEvidences(evaluationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: evidences => {
          this.evidences = evidences;
          this.loadingEvidences = false;
        },
        error: () => {
          this.evidencesError = true;
          this.loadingEvidences = false;
        }
      });
  }

  downloadEvidence(evidence: EvaluationEvidence): void {
    if (
      !this.results ||
      evidence.type !== 'FILE' ||
      this.downloadingEvidenceId !== null
    ) {
      return;
    }

    const evaluationId = this.results.evaluation_id;

    this.downloadingEvidenceId = evidence.id;
    this.evidenceDownloadError = null;

    this.evidenceDownloadRequest = this.evidenceService.downloadEvidence(
      evaluationId,
      evidence.id
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (blob) => {
        this.downloadingEvidenceId = null;

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = objectUrl;
        anchor.download =
          evidence.original_filename || 'evidencia';

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 1000);
      },
      error: () => {
        this.downloadingEvidenceId = null;
        this.evidenceDownloadError =
          'No se pudo descargar el archivo. Inténtalo nuevamente.';
      }
    });
  }



  private clearResultsState(): void {

    this.results = null;

    // Periodos de evaluación
    this.mesActual = '';
    this.anioActual = '';
    this.mesAnterior = '';
    this.anioAnterior = '';

    // Evidencias
    this.evidences = [];
    this.loadingEvidences = false;
    this.evidencesError = false;
    this.evidenceDownloadError = null;

    // Reporte ASG
    this.asgReport = null;
    this.asgReportError = null;

  }


  loadResults(): void {

    this.resultService.getLastEvaluationResult().subscribe({

      next: (data) => {

        this.results = data;

        this.getPeriodo(data.date);

        this.loadEvidences(data.evaluation_id);

      },

      error: (err) => {

        this.evidences = [];
        this.loadingEvidences = false;

      }

    });

  }


  capitalizar(texto: string): string {
    if (!texto) return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  getPeriodo(fecha: string) {
    const hoy = new Date(fecha);
    this.mesActual = hoy.toLocaleString('es-ES', { month: 'long' });
    this.mesActual = this.capitalizar(this.mesActual);
    this.anioActual = hoy.toLocaleString('es-ES', { year: 'numeric' });
    const futura = new Date(hoy);
    futura.setMonth(hoy.getMonth() - 6);
    this.mesAnterior = futura.toLocaleString('es-ES', { month: 'long' })
    this.mesAnterior = this.capitalizar(this.mesAnterior);
    this.anioAnterior = futura.toLocaleString('es-ES', { year: 'numeric' });

  }

  async exportAsgReport(
    shouldContinue: () => boolean = () =>
      !this.componentDestroyed
  ): Promise<void> {

    if (!shouldContinue()) {
      return;
    }

    const reportElement =
      this.hostElement.nativeElement
        .querySelector<HTMLElement>(
          '.asg-report-export [data-pdf-root]'
        );

    if (!reportElement || !this.asgReport) {
      throw new Error(
        'La plantilla del reporte ASG no está disponible.'
      );
    }

    const evaluationId =
      this.asgReport.evaluation.evaluation_id;

    await this.asgReportAssets.waitForAssets(
      reportElement
    );

    // El usuario pudo cambiar de empresa
    // mientras se preparaban los recursos.
    if (!shouldContinue()) {
      return;
    }

    const { workspace, pages } =
      this.asgReportPaginator.paginate(reportElement);

    try {

      if (!shouldContinue()) {
        return;
      }

      await this.asgPdfService.generatePdf(
        pages,
        `reporte-asg-${evaluationId}.pdf`,
        shouldContinue
      );

    } finally {
      workspace.remove();
    }
  }

  private waitForReportRender(
    timeoutMs = 10000
  ): Promise<void> {

    if (this.componentDestroyed) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {

      let settled = false;

      let renderRef:
        ReturnType<typeof afterNextRender> | undefined;

      let timeoutId:
        ReturnType<typeof setTimeout> | undefined;

      let unregisterDestroy:
        (() => void) | undefined;

      const cleanup = (): void => {

        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }

        renderRef?.destroy();

        unregisterDestroy?.();
      };

      const finish = (error?: Error): void => {

        if (settled) {
          return;
        }

        settled = true;

        cleanup();

        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };

      try {

        unregisterDestroy =
          this.destroyRef.onDestroy(() => {

            unregisterDestroy = undefined;

            finish();
          });

        timeoutId = setTimeout(() => {

          finish(
            new Error(
              'Se agotó el tiempo de renderización del reporte ASG.'
            )
          );

        }, timeoutMs);

        renderRef = afterNextRender(
          {
            read: () => finish()
          },
          {
            injector: this.injector
          }
        );

        this.cdr.markForCheck();

      } catch (error) {

        finish(
          error instanceof Error
            ? error
            : new Error(
              'No se pudo renderizar el reporte ASG.'
            )
        );
      }
    });
  }

  async downloadAsgReport(): Promise<void> {

    const evaluationId =
      this.results?.evaluation_id;

    const companyId =
      this.companyContext.selectedCompanyId();

    if (
      this.componentDestroyed ||
      evaluationId === undefined ||
      companyId === null ||
      !Number.isSafeInteger(evaluationId) ||
      evaluationId <= 0 ||
      this.generatingAsgReport
    ) {
      return;
    }

    const contextVersion =
      this.reportContextVersion;

    const shouldContinue = (): boolean => {
      return (
        !this.componentDestroyed &&
        this.reportContextVersion === contextVersion &&
        this.companyContext.selectedCompanyId() === companyId &&
        this.results?.evaluation_id === evaluationId
      );
    };

    this.generatingAsgReport = true;
    this.asgReportError = null;
    this.asgReport = null;

    try {

      const report = await firstValueFrom(
        this.asgReportService.getReport(evaluationId)
      );

      if (!shouldContinue()) {
        return;
      }

      this.asgReport = report;

      await this.waitForReportRender();

      if (!shouldContinue()) {
        return;
      }

      await this.exportAsgReport(shouldContinue);

    } catch (error) {

      // Una exportación invalidada no debe
      // mostrar errores en el nuevo contexto.
      if (shouldContinue()) {
        console.error(
          'Error al generar el reporte ASG:',
          error
        );

        this.asgReportError =
          'No se pudo generar el reporte ASG. Inténtalo nuevamente.';
      }

    } finally {

      this.asgReport = null;
      this.generatingAsgReport = false;

      if (!this.componentDestroyed) {
        this.cdr.markForCheck();
      }

    }
  }
}
