import { jsPDF } from 'jspdf';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { SessionService } from '../../../shared/class/temporalStorage';
import { AmbitCardComponent } from '../../../shared/ambit-card/ambit-card.component';
import { BarChartComponent } from '../../../shared/bar-chart/bar-chart.component';
import html2canvas from 'html2canvas';
import { FeedbackComponent } from '../../../shared/feedback/feedback.component';
import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [
    AmbitCardComponent,
    BarChartComponent,
    FeedbackComponent
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

  loadingChart = false;
  constructor(
    private resultService: EvaluationService,
    private evidenceService: EvidenceService
  ) { }
  chart: any;
  ngOnInit(): void {
    this.loadResults();
  }


  loadEvidences(evaluationId: number): void {
    this.loadingEvidences = true;
    this.evidencesError = false;
    this.evidences = [];

    this.evidenceService.getEvidences(evaluationId).subscribe({
      next: (evidences) => {
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

    this.evidenceService.downloadEvidence(
      evaluationId,
      evidence.id
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


  async downloadPdf(): Promise<void> {
    const element = document.getElementById('pdf-content');

    if (!element) {
      return;
    }

    element.classList.add('pdf-mode');

    try {

      html2canvas(element, { scale: 2 }).then((canvas) => {

        const pdf = new jsPDF();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 211, 298);
        pdf.setFontSize(12);
        pdf.save('reporte.pdf');
        element.classList.remove('pdf-mode');
      })
    } catch (error) {
      console.error('Error al generar el PDF:', error);
    } finally {
      element.classList.remove('pdf-mode');
    }
  }

}
