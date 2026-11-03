
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
            position: 'bottom'
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
              text: 'Puntuación'
            }
          },

          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Fecha de evaluación'
            },
            ticks: {
              callback: (value) => {
                const timestamp = Number(value);

                return new Date(timestamp).toLocaleDateString('es-MX');
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
}
