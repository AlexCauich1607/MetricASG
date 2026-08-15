import { Component, Input } from '@angular/core';
import { ResultEvaluation } from '../../models/evaluation_result';

@Component({
  selector: 'app-pdf-template',
  standalone: false,
  templateUrl: './pdf-template.component.html',
  styleUrl: './pdf-template.component.scss'
})
export class PdfReportTemplateComponent {

  @Input() name= "";
  @Input() results: ResultEvaluation | null = null;
  mesActual = '';
  anioActual = '';
  mesAnterior = '';
  anioAnterior = '';
  
  
  
  ambits: string[] = [];
  scores: number[] = [];
  colors: string[] = [];
  bordes: string[] = [];
  
  loadingChart = false;

  constructor() {
  }

  chart: any;
  ngOnInit(): void {
      this.cargarGrafica();
      this.getPeriodo(this.results?.date?? '');
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
}
