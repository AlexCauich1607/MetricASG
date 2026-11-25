import {
  Component,
  Input,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bar-chart.component.scss'
})
export class BarChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef;

  chart: any;
  private initializationTimer:
    ReturnType<typeof setTimeout> | null = null;
  @Input() id: number = 0;
  @Input() data: string[] = [];
  @Input() scores: number[] = [];
  @Input() colors: string[] = [];
  @Input() bordes: string[] = [];
  @Input() variant: 'default' | 'dashboard' = 'default';


  ngAfterViewInit(): void {
    this.initializationTimer = setTimeout(() => {
      this.initializationTimer = null;
      this.cargarGrafica();
    }, 0);
  }

  private cargarGrafica(): void {

    if (!this.chartCanvas?.nativeElement) {
      console.error('Canvas element not found');
      return;
    }


    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    const isDashboard = this.variant === 'dashboard';

    if (!ctx) {
      console.error('Could not get 2d context');
      return;
    }

    const config: ChartConfiguration<'bar', number[], string> = {
      type: 'bar',
      data: {
        labels: this.data,
        datasets: [{
          label: '',
          data: this.scores,
          backgroundColor: this.colors,

          borderColor: isDashboard
            ? 'transparent'
            : this.bordes,

          borderWidth: isDashboard
            ? 0
            : this.bordes.length === 0 ? 0 : 4,

          borderRadius: {
            topLeft: isDashboard ? 7 : 5,
            topRight: isDashboard ? 7 : 5,
            bottomLeft: isDashboard ? 0 : 5,
            bottomRight: isDashboard ? 0 : 5
          },

          borderSkipped: false,

          barPercentage: isDashboard ? 0.7 : 0.5,
          categoryPercentage: isDashboard ? 0.7 : 0.5,

          ...(isDashboard ? { maxBarThickness: 64 } : {})
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return parseInt(value.toString()).toFixed(2);
              }
            }
          },
          x: {
            ticks: {
              font: function (context) {
                const width = context.chart.width;
                const baseSize = 10;
                return {
                  size: Math.max(10, baseSize * (width / 800)),
                  weight: 'bold'
                };
              }
            }
          }
        }
      }
    };
    if (isDashboard) {

      config.options = {

        responsive: true,
        maintainAspectRatio: false,
        animation: false,

        layout: {
          padding: {
            top: 12,
            right: 8,
            bottom: 0,
            left: 0
          }
        },

        plugins: {

          legend: {
            display: false
          },

          tooltip: {
            backgroundColor: '#00245d',
            padding: 12,
            cornerRadius: 8,
            displayColors: false,

            callbacks: {
              label: context =>
                `Puntuación: ${context.parsed.y?.toFixed(1)} / 10`
            }
          }
        },

        scales: {

          y: {
            min: 0,
            max: 10,
            beginAtZero: true,

            border: {
              display: false
            },

            grid: {
              color: '#e4e9ed',
              drawTicks: false
            },

            ticks: {
              stepSize: 2,
              color: '#595959',
              padding: 8,

              font: {
                size: 11
              }
            }
          },

          x: {

            border: {
              display: false
            },

            grid: {
              display: false
            },

            ticks: {
              color: '#13243d',
              padding: 10,
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false,

              font: {
                size: 11,
                weight: 500
              }
            }
          }
        }
      };
    }

    if (this.chart) {
      this.chart.destroy();
    }


    this.chart = new Chart(ctx, config);
  }

  ngOnDestroy(): void {
    if (this.initializationTimer !== null) {
      clearTimeout(this.initializationTimer);
      this.initializationTimer = null;
    }

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}