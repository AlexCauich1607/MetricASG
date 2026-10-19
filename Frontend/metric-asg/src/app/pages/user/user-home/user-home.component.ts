import { Component, ComponentRef, ViewContainerRef, ChangeDetectionStrategy } from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models/user';
import { Router } from '@angular/router';
import { SessionService } from '../../../shared/class/temporalStorage';
import { MatDialog } from '@angular/material/dialog';
import { AmbitCardComponent } from '../../../shared/ambit-card/ambit-card.component';
import { BarChartComponent } from '../../../shared/bar-chart/bar-chart.component';


Chart.register(...registerables);


@Component({
  selector: 'app-user-home',
  standalone: true,
  imports: [
    AmbitCardComponent,
    BarChartComponent
  ],
  templateUrl: './user-home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-home.component.scss'
})
export class UserHomeComponent {
  id_user: number = SessionService.getSessionItem('id') ?? 0;
  mesActual = '';
  anioActual = '';
  mesAnterior = '';
  anioAnterior = '';
  evaluationDate = '';

  results: ResultEvaluation | null = null;

  ambits: string[] = [];
  scores: number[] = [];
  colors: string[] = [];
  bordes: string[] = [];

  user: User | null = null;

  loadingChart = false;
  constructor(private resultService: EvaluationService, private userService: UserService, private router: Router, private dialog: MatDialog, private vcr: ViewContainerRef) {

  }
  chart: any;
  ngOnInit(): void {
    this.loadUser();
  }

  loadUser() {
    this.userService.getMe().subscribe({
      next: (value) => {
        this.user = value;
        if (this.formatDateDDMMYYString(this.user.joined) == this.formatDateDDMMYYString(this.user.next_evaluation)) {
          SessionService.setSessionItem('first-time', true);
        } else {
          SessionService.setSessionItem('first-time', false);
        }
        console.log(this.user.joined);
        console.log(this.user.next_evaluation);
        this.loadResults();
        this.getNextEvaluation();
      }, error: (err) => {
        console.log(err)
      }
    });
  }
  cargarGrafica(): void {
    this.loadingChart = false;
    this.results?.ambits.forEach(a => {
      this.ambits.push(a.ambit_name)
      this.scores.push(parseFloat(a.score.toFixed(1)));
      this.colors.push(a.color);
      this.bordes.push(a.maturity_color);
    });
    this.loadingChart = true;

  }


  onSelect(event: any): void {
    console.log('Barra seleccionada:', event);

  }



  yAxisTickFormatting(value: number): string {
    return `${value}/10`;
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
    const before = new Date(hoy);
    before.setMonth(hoy.getMonth() - 5);
    this.mesAnterior = before.toLocaleString('es-ES', { month: 'long' })
    this.mesAnterior = this.capitalizar(this.mesAnterior);
    this.anioAnterior = before.toLocaleString('es-ES', { year: 'numeric' });
  }

  getNextEvaluation() {
    const future = new Date(this.user?.next_evaluation ?? '');
    this.evaluationDate = this.formatDateDDMMYY(future);
  }
  formatDateDDMMYY(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();

    return `${day}/${month}/${year}`;
  }
  formatDateDDMMYYString(fecha: string): string {
    const date = new Date(fecha);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();

    return `${day}/${month}/${year}`;
  }
  goEvaluation() {
    if (!this.user?.biannual_evaluation) {
      this.router.navigate(['/user/evaluation']);
    }
  }

  downloadPdf() {
    this.router.navigate(['/user/results']);
  }
}
