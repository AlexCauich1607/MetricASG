import { Component } from '@angular/core';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationHistory } from '../../../models/history_evaluations';
import { id } from '@swimlane/ngx-charts';
import { SwDates } from '../../../models/dates';
import { SessionService } from '../../../shared/class/temporalStorage';


export interface AmbitChart {
  name: string,
  data: string[],
  scores: number[],
  colors: string[]
}
@Component({
  selector: 'app-history',
  standalone: false,
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent {
  user_id: number = SessionService.getSessionItem('id') ?? 0;
  chartsLoading = 0;
  historial: EvaluationHistory | null = null;
  loadingChart = false;
  data: Map<number, AmbitChart> = new Map();
  blueColor= "#00245D"; 
  global: AmbitChart = {
    name: "Nivel ASG",
    data: [],
    scores: [],
    colors: [],
  }
  constructor(private historyService: EvaluationService) {

  }
  ngOnInit(): void {
    this.loadHistory();
  }
  getLetter(id: number): string {
    let result = "";
    this.historial?.averages.ambits.forEach(a => {
      if (a.ambit_id == id) {
        result = a.letter ?? "";

      }

    })
    return result;
  }
  getColor(id: number): string {
    let result = "";
    this.historial?.averages.ambits.forEach(a => {
      if (a.ambit_id == id) {
        result = a.ambit_color ?? "";

      }

    })
    return result;
  }
  loadHistory(): void {
    this.loadingChart = false;
    this.historyService.getEvaluationHistory(this.user_id).subscribe({
      next: (value) => {
        this.historial = value;
        this.historial.history.forEach(e => {
          this.global.scores.push(e.global_score);
          this.global.data.push(SwDates.formatDateDDMMYY(e.date));
          this.global.colors.push(this.blueColor)
          e.ambits.forEach(a => {
            let ambito = this.data.get(a.ambit_id);
            if (!ambito) {
              let newAmbit: AmbitChart = {
                name: "",
                data: [],
                scores: [],
                colors: [],
              }
              this.data.set(a.ambit_id, newAmbit);
              ambito = newAmbit;
              ambito.name = a.ambit_name;

            }

            if (ambito) {
              ambito.data.push(SwDates.formatDateDDMMYY(a.date??""));
              ambito.scores.push(a.score!);
              ambito.colors.push(a.ambit_color!);
              console.log(ambito)
            }

          })
          this.chartsLoading++;
        })

        this.loadingChart = true;



      },
      error: (err) => {

      }
    })
  }
}
