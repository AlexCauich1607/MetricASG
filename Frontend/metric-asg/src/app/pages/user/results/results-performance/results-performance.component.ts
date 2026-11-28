
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy
} from '@angular/core';

import {
  ResultAmbit
} from '../../../../models/evaluation_result';

import {
  AmbitCardComponent
} from '../../../../shared/ambit-card/ambit-card.component';

import {
  BarChartComponent
} from '../../../../shared/bar-chart/bar-chart.component';

import {
  RadarChartComponent
} from '../../../../shared/radar-chart/radar-chart.component';

import {
  isValidAsgScore
} from '../../../../shared/utils/asg-score.utils';

@Component({
  selector: 'app-results-performance',
  standalone: true,

  imports: [
    AmbitCardComponent,
    BarChartComponent,
    RadarChartComponent
  ],

  templateUrl: './results-performance.component.html',

  styleUrl: './results-performance.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsPerformanceComponent implements OnChanges {

  @Input() globalScore: number | null = null;

  @Input() globalMaturity = '';

  @Input() globalMaturityColor = '';

  @Input() ambits: ResultAmbit[] = [];

  @Input() highestAmbits: ResultAmbit[] = [];

  @Input() lowestAmbits: ResultAmbit[] = [];

  barLabels: string[] = [];

  barScores: number[] = [];

  barColors: string[] = [];

  radarLabels: string[] = [];

  radarScores: (number | null)[] = [];

  radarColors: string[] = [];

  chartRevision = 0;

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['ambits']) {

      this.prepareChartData();

    }

  }


  private prepareChartData(): void {

    const validAmbits = this.ambits.filter(
      ambit => isValidAsgScore(ambit.score)
    );

    this.barLabels = validAmbits.map(
      ambit => ambit.ambit_name
    );

    this.barScores = validAmbits.map(
      ambit => ambit.score
    );

    this.barColors = validAmbits.map(
      ambit => ambit.color || '#00245d'
    );

    this.radarLabels = this.ambits.map(
      ambit => ambit.ambit_name
    );

    this.radarScores = this.ambits.map(

      ambit => isValidAsgScore(ambit.score)
        ? ambit.score
        : null

    );

    this.radarColors = this.ambits.map(
      ambit => ambit.color || '#00245d'
    );

    this.chartRevision++;

  }


  get hasChartData(): boolean {

    return this.barScores.length > 0;

  }

  get hasSummary(): boolean {

    return this.barScores.length >= 2 &&
      this.highestAmbits.length > 0 &&
      this.lowestAmbits.length > 0;

  }

  get isBalanced(): boolean {

    return this.hasSummary &&
      this.highestAmbits[0].score ===
      this.lowestAmbits[0].score;

  }

  getAmbitNames(ambits: ResultAmbit[]): string {

    return ambits
      .map(ambit => ambit.ambit_name)
      .join(', ');

  }

}
