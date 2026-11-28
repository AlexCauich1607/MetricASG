
import {
  Component,
  Input,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy
} from '@angular/core';

import {
  Chart,
  ChartConfiguration,
  registerables
} from 'chart.js';

Chart.register(...registerables);
function getTimestamp(date: string | null): number | null {
  if (!date) {
    return null;
  }

  const timestamp = new Date(date).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}
export interface HistoricalTrendPoint {
  x: number;
  y: number | null;
}

export interface HistoricalTrendDataset {
  label: string;
  data: HistoricalTrendPoint[];
  color: string;
}

@Component({
  selector: 'app-historical-trend-chart',
  imports: [],
  templateUrl: './historical-trend-chart.component.html',
  styleUrl: './historical-trend-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoricalTrendChartComponent
  implements AfterViewInit, OnChanges, OnDestroy {

  @ViewChild('chartCanvas')
  chartCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() labels: string[] = [];
  @Input() datasets: HistoricalTrendDataset[] = [];

  private chart: Chart<'line', HistoricalTrendPoint[], number> | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.chartCanvas &&
      (changes['labels'] || changes['datasets'])
    ) {
      this.renderChart();
    }
  }

  private renderChart(): void {
    const canvas = this.chartCanvas?.nativeElement;

    if (!canvas) {
      return;
    }

    this.chart?.destroy();

    // HU-059 / T02.3 - Adaptive historical presentation

    const config: ChartConfiguration<
      'line',
      HistoricalTrendPoint[],
      number
    > = {
      type: 'line',
      data: {
        datasets: this.datasets.map(dataset => ({
          label: dataset.label,
          data: dataset.data,
          borderColor: dataset.color,
          backgroundColor: dataset.color,
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: false
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',

            labels: {
              boxWidth: 12,
              boxHeight: 10,
              padding: 12,

              font: context => ({
                size: context.chart.width < 360 ? 10 : 12
              })
            }
          },

          tooltip: {
            callbacks: {
              title: (items) => {
                const timestamp = items[0]?.parsed.x;

                if (timestamp == null) {
                  return 'Fecha no disponible';
                }

                return new Date(timestamp).toLocaleDateString('es-MX');
              },
              label: (context) => {
                const score = context.parsed.y;

                return `${context.dataset.label}: ${score === null ? 'N/D' : score.toFixed(1)
                  }`;
              }
            }
          }

        },
        scales: {
          y: {
            min: 0,
            max: 10,

            title: {
              display: true,
              text: 'Puntuación',

              font: () => ({
                size: canvas.clientWidth < 360 ? 10 : 12
              })
            },

            ticks: {
              stepSize: 2,
              padding: 4,

              font: context => ({
                size: context.chart.width < 360 ? 10 : 12
              })
            }
          },

          x: {
            type: 'linear',

            title: {
              display: true,
              text: 'Fecha de evaluación',

              font: () => ({
                size: canvas.clientWidth < 360 ? 10 : 12
              })
            },

            ticks: {
              autoSkip: true,
              maxTicksLimit: 8,
              minRotation: 0,
              maxRotation: 0,
              padding: 4,

              font: context => ({
                size: context.chart.width < 360 ? 10 : 12
              }),

              callback: function (value) {

                const timestamp = Number(value);

                if (!Number.isFinite(timestamp)) {
                  return '';
                }

                const date = new Date(timestamp);

                if (!Number.isFinite(date.getTime())) {
                  return '';
                }

                if (this.chart.width < 360) {
                  return date.toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit'
                  });
                }

                return date.toLocaleDateString('es-MX');
              }
            }
          }

        }
      }
    };

    this.chart = new Chart(canvas, config);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  // HU-059 / T03 - Accessible historical data

  get hasAccessibleHistoricalData(): boolean {

    return this.datasets.some(
      dataset => dataset.data.length > 0
    );

  }

  formatAccessibleHistoricalDate(
    timestamp: number
  ): string {

    const date = new Date(timestamp);

    if (
      !Number.isFinite(timestamp) ||
      !Number.isFinite(date.getTime())
    ) {
      return 'Fecha no disponible';
    }

    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

  }

  formatAccessibleHistoricalScore(
    score: number | null | undefined
  ): string {

    if (
      typeof score !== 'number' ||
      !Number.isFinite(score)
    ) {
      return 'N/D';
    }

    return `${score.toFixed(1)} / 10`;

  }

  get accessibleHistoricalDescription(): string {

    if (!this.hasAccessibleHistoricalData) {
      return 'Gráfica de evolución ASG. Sin datos históricos disponibles.';
    }

    const series = this.datasets.map(
      dataset => dataset.label
    ).join(', ');

    return `Gráfica de evolución ASG. Series: ${series}. Puntuaciones de 0 a 10. Consulta los datos históricos para conocer las fechas y valores.`;

  }

}
