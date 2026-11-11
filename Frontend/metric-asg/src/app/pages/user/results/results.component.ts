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
  afterNextRender
} from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { SessionService } from '../../../shared/class/temporalStorage';
import { AmbitCardComponent } from '../../../shared/ambit-card/ambit-card.component';
import { BarChartComponent } from '../../../shared/bar-chart/bar-chart.component';
import { FeedbackComponent } from '../../../shared/feedback/feedback.component';
import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';
import { Router } from '@angular/router';
import { AsgReport } from '../../../models/asg_report';
import { AsgReportService } from '../../../services/asg-report.service';
import { AsgReportPaginatorService } from '../../../services/asg-report-paginator.service';
import { AsgPdfService } from '../../../services/asg-pdf.service';
import { AsgReportTemplateComponent } from '../../../shared/asg-report-template/asg-report-template.component';
import { CompanyContextService } from '../../../services/company-context.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [
    AmbitCardComponent,
    BarChartComponent,
    FeedbackComponent,
    AsgReportTemplateComponent
  ],
  templateUrl: './results.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './results.component.scss'
})
export class ResultsComponent {
  id_user: number = SessionService.getSessionItem('id') ?? 0;
  name = SessionService.getSessionItem('company');
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

  ambits: string[] = [];
  scores: number[] = [];
  colors: string[] = [];
  bordes: string[] = [];

  asgReport: AsgReport | null = null;

  generatingAsgReport = false;

  asgReportError: string | null = null;

  loadingChart = false;
  private evidenceRequest?: Subscription;
  private evidenceDownloadRequest?: Subscription;

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

    toObservable(this.companyContext.selectedCompanyId)
      .pipe(
        tap(() => {
          this.evidenceRequest?.unsubscribe();
          this.evidenceDownloadRequest?.unsubscribe();

          this.clearResultsState();

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
        this.cargarGrafica();
        this.loadEvidences(data.evaluation_id);
      });

  }
  chart: any;


  openImprovementPlan(): void {
    const evaluationId = this.results?.evaluation_id;

    if (
      evaluationId === undefined ||
      !Number.isSafeInteger(evaluationId) ||
      evaluationId <= 0
    ) {
      return;
    }

    this.router.navigate([
      '/user/evaluations',
      evaluationId,
      'improvement-plan'
    ]);
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


  private cargarGrafica(): void {
    this.loadingChart = false;
    this.results?.ambits.forEach(a => {
      this.ambits.push(a.ambit_name)
      this.scores.push(parseFloat(a.score.toFixed(1)));
      this.colors.push(a.color);
      this.bordes.push(a.maturity_color);
    });
    this.loadingChart = true;

  }

  private clearResultsState(): void {
    this.results = null;

    // Periodos de evaluación
    this.mesActual = '';
    this.anioActual = '';
    this.mesAnterior = '';
    this.anioAnterior = '';

    // Datos de la gráfica
    this.ambits = [];
    this.scores = [];
    this.colors = [];
    this.bordes = [];
    this.loadingChart = false;

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
        this.cargarGrafica();

        this.loadEvidences(data.evaluation_id);
      },
      error: (err) => {
        this.evidences = [];
        this.loadingEvidences = false;
      }
    });
  }


  getEvidenceIndicatorIds(): number[] {
    return [
      ...new Set(
        this.evidences.map(evidence => evidence.indicator_id)
      )
    ].sort((a, b) => a - b);
  }


  getBorderColor(level: string): string {
    let color = "";
    if (level === "Básico") {
      color = "#ce4040ff";
    } else if (level === "Intermedio") {
      color = "#eac84fff";
    } else {
      color = "#15b91dff";
    }
    return color;
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

  async exportAsgReport(): Promise<void> {
    const reportElement = document.querySelector<HTMLElement>(
      '.asg-report-export [data-pdf-root]'
    );

    if (!reportElement || !this.asgReport) {
      throw new Error(
        'La plantilla del reporte ASG no está disponible.'
      );
    }

    const { workspace, pages } =
      this.asgReportPaginator.paginate(reportElement);

    try {
      await this.asgPdfService.generatePdf(
        pages,
        `reporte-asg-${this.asgReport.evaluation.evaluation_id}.pdf`
      );
    } finally {
      workspace.remove();
    }
  }

  private waitForReportRender(): Promise<void> {
    return new Promise<void>((resolve) => {
      afterNextRender(
        {
          read: () => resolve()
        },
        {
          injector: this.injector
        }
      );

      this.cdr.markForCheck();
    });
  }

  async downloadAsgReport(): Promise<void> {
    const evaluationId = this.results?.evaluation_id;
    const companyId = this.companyContext.selectedCompanyId();

    if (
      evaluationId === undefined ||
      companyId === null ||
      !Number.isSafeInteger(evaluationId) ||
      evaluationId <= 0 ||
      this.generatingAsgReport
    ) {
      return;
    }

    this.generatingAsgReport = true;
    this.asgReportError = null;
    this.asgReport = null;

    try {

      const report = await firstValueFrom(
        this.asgReportService.getReport(evaluationId)
      );

      // Verificar que seguimos en la misma empresa y evaluación.
      if (
        this.companyContext.selectedCompanyId() !== companyId ||
        this.results?.evaluation_id !== evaluationId
      ) {
        return;
      }

      this.asgReport = report;

      await this.waitForReportRender();

      // Verificar nuevamente antes de generar el PDF.
      if (
        this.companyContext.selectedCompanyId() !== companyId ||
        this.results?.evaluation_id !== evaluationId
      ) {
        return;
      }

      await this.exportAsgReport();


    } catch (error) {
      console.error('Error al generar el reporte ASG:', error);

      this.asgReportError =
        'No se pudo generar el reporte ASG. Inténtalo nuevamente.';

    } finally {
      this.asgReport = null;
      this.generatingAsgReport = false;
      this.cdr.markForCheck();
    }
  }

}
