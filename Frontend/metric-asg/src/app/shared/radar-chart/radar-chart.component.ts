
import {
  Component,
  Input,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy
} from '@angular/core';

import {
  Chart,
  ChartConfiguration,
  registerables
} from 'chart.js';

import {
  isValidAsgScore
} from '../utils/asg-score.utils';

Chart.register(...registerables);

@Component({
  selector: 'app-radar-chart',
  standalone: true,
  imports: [],
  templateUrl: './radar-chart.component.html',
  styleUrl: './radar-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RadarChartComponent
  implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('chartCanvas')
  chartCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() data: string[] = [];
  @Input() scores: (number | null)[] = [];
  @Input() colors: string[] = [];

  @Input() label = 'Evaluación actual';

  chart: Chart<'radar', (number | null)[], string> | null = null;

  private viewInitialized = false;

  private initializationTimer:
    ReturnType<typeof setTimeout> | null = null;

  get validScores(): (number | null)[] {

    return this.data.map((_, index) => {

      const score = this.scores[index];

      return isValidAsgScore(score)
        ? score
        : null;

    });

  }

  get accessibleDescription(): string {

    const values = this.validScores;

    const description = this.data.map((name, index) => {

      const score = values[index];

      return `${name}: ${score === null
        ? 'No disponible'
        : `${score.toFixed(1)} de 10`
        }`;

    }).join('. ');

    return `Gráfica de radar del desempeño ASG. ${description}`;

  }

  ngAfterViewInit(): void {

    this.viewInitialized = true;

    this.initializationTimer = setTimeout(() => {

      this.initializationTimer = null;

      this.renderChart();

    }, 0);

  }

  ngOnChanges(): void {

    if (
      this.viewInitialized &&
      this.initializationTimer === null
    ) {

      this.renderChart();

    }

  }

  private renderChart(): void {

    const canvas = this.chartCanvas?.nativeElement;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const values = this.validScores;

    const completeProfile =
      values.length >= 3 &&
      values.every(score => score !== null);

    const pointColors = this.data.map(
      (_, index) => this.colors[index] || '#00245d'
    );

    const config: ChartConfiguration<
      'radar',
      (number | null)[],
      string
    > = {

      type: 'radar',

      data: {

        labels: this.data,

        datasets: [

          {
            label: this.label,

            data: values,

            backgroundColor: 'rgba(21, 101, 192, 0.16)',

            borderColor: '#00245d',

            borderWidth: 2.5,

            pointBackgroundColor: pointColors,

            pointBorderColor: '#ffffff',

            pointBorderWidth: 2,

            pointRadius: 5,

            pointHoverRadius: 7,

            pointHoverBorderWidth: 2,

            fill: completeProfile,

            showLine: completeProfile,

            spanGaps: false,

            tension: 0
          }

        ]

      },


      options: {

        responsive: true,

        maintainAspectRatio: false,

        animation: false,

        layout: {
          padding: {
            top: 4,
            right: 4,
            bottom: 0,
            left: 4
          }
        },

        plugins: {

          legend: {
            display: false
          },

          tooltip: {
            backgroundColor: '#00245d',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',

            padding: 12,
            cornerRadius: 8,
            displayColors: false,

            callbacks: {

              label: context => {

                const score = context.parsed.r;

                return Number.isFinite(score)
                  ? `Puntuación: ${score.toFixed(1)} / 10`
                  : 'Puntuación no disponible';

              }

            }
          }

        },

        scales: {

          r: {

            min: 0,
            max: 10,
            beginAtZero: true,

            grid: {
              color: '#dce5ee',
              circular: false,
              lineWidth: 1
            },

            angleLines: {
              color: '#dce5ee',
              lineWidth: 1
            },

            ticks: {

              stepSize: 2,
              color: '#595959',

              showLabelBackdrop: false,

              z: 1,

              font: {
                size: 11
              },

              callback: value =>
                Number(value) === 0
                  ? ''
                  : String(value)

            },


            pointLabels: {

              color: '#00245d',

              padding: context =>
                context.chart.width < 420 ? 4 : 6,

              font: context => ({
                size: context.chart.width < 420 ? 11 : 13,
                weight: 600,
                lineHeight: 1.2
              }),

              callback: (name, index) => {

                const score = values[index];

                const formattedScore =
                  score === null
                    ? 'N/D'
                    : score.toFixed(1);

                const canvasWidth = canvas.clientWidth;

                if (canvasWidth < 420) {

                  return [
                    String(name),
                    formattedScore
                  ];

                }

                return `${name} · ${formattedScore}`;

              }

            }


          }

        }

      }


    };

    this.chart?.destroy();

    this.chart = new Chart(ctx, config);

  }

  ngOnDestroy(): void {

    this.viewInitialized = false;

    if (this.initializationTimer !== null) {

      clearTimeout(this.initializationTimer);

      this.initializationTimer = null;

    }

    this.chart?.destroy();

    this.chart = null;

  }

}
