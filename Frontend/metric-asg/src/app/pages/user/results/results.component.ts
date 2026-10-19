import  {jsPDF} from 'jspdf';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { SessionService } from '../../../shared/class/temporalStorage';
import { AmbitCardComponent } from '../../../shared/ambit-card/ambit-card.component';
import { BarChartComponent } from '../../../shared/bar-chart/bar-chart.component';
import html2canvas from 'html2canvas';
import { FeedbackComponent } from '../../../shared/feedback/feedback.component';

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
  name= SessionService.getSessionItem('company');
  mesActual = '';
  anioActual = '';
  mesAnterior = '';
  anioAnterior = '';

  results: ResultEvaluation | null = null;

  ambits: string[] = [];
  scores: number[] = [];
  colors: string[] = [];
  bordes: string[] = [];

  loadingChart = false;
  constructor(private resultService: EvaluationService) {

  }
  chart: any;
  ngOnInit(): void {
    this.loadResults();
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

  loadResults() {
    this.resultService.getLastEvaluationResult().subscribe({
      next: (data) => {
        this.results = data;
        this.getPeriodo(this.results.date);
        this.cargarGrafica();
      },
      error: (err) => {

      }
    })
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

  downloadPdf(){
    const elementToPrint: any = document.getElementById('pdf-content');
    elementToPrint.classList.add('pdf-mode');
    html2canvas(elementToPrint,{scale:2}).then((canvas)=>{
     
      const pdf = new jsPDF();
      pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0, 211, 298);
      pdf.setFontSize(12);
      pdf.save('reporte.pdf'); 
      elementToPrint.classList.remove('pdf-mode');
    })
  }
}
