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
  styleUrl: './bar-chart.component.scss',
  host: {
    '[class.bar-chart--results]': "variant === 'results'"
  },
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
  @Input() variant: 'default' | 'dashboard' | 'results' | 'admin' = 'default';


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
    const isResults = this.variant === 'results';
    const isAdmin = this.variant === 'admin';

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
    // HU-059 / T02 - Administrative charts

    if (isAdmin) {

      config.options = {

        responsive: true,
        maintainAspectRatio: false,

        layout: {
          padding: {
            top: 8,
            right: 8,
            bottom: 4,
            left: 0
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
            padding: 10,
            cornerRadius: 8,
            displayColors: false,

            callbacks: {
              label: context =>
                `Usuarios: ${context.parsed.y?.toLocaleString('es-MX')
                ?? 'N/D'
                }`
            }
          }
        },

        scales: {

          y: {
            beginAtZero: true,

            border: {
              display: false
            },

            grid: {
              color: '#e4e9ed',
              drawTicks: false
            },

            ticks: {
              precision: 0,
              maxTicksLimit: 6,
              color: '#595959',
              padding: 6,

              font: context => ({
                size: context.chart.width < 360 ? 10 : 11
              }),

              callback: value =>
                Number(value).toLocaleString('es-MX')
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
              padding: 6,

              autoSkip: true,
              minRotation: 0,
              maxRotation: 45,

              font: context => ({
                size: context.chart.width < 360 ? 10 : 12,
                weight: 500
              }),

              callback: function (value) {

                const label = this.getLabelForValue(
                  Number(value)
                );

                const maxLength =
                  this.chart.width < 360 ? 12 :
                    this.chart.width < 600 ? 18 : 28;

                return label.length > maxLength
                  ? `${label.slice(0, maxLength - 1)}…`
                  : label;
              }
            }
          }
        }
      };
    }

    // HU-059 / T02.2 - Adaptive ASG charts
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

              font: context => ({
                size: context.chart.width < 360 ? 10 : 11
              })
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

              font: context => ({
                size: context.chart.width < 360 ? 10 : 11,
                weight: 500
              })
            }
          }
        }
      };
    }

    if (isResults) {

      const dataset = config.data.datasets[0];

      dataset.borderColor = 'transparent';
      dataset.borderWidth = 0;
      dataset.borderRadius = {
        topLeft: 0,
        bottomLeft: 0,
        topRight: 7,
        bottomRight: 7
      };
      dataset.borderSkipped = false;
      dataset.barPercentage = 0.60;
      dataset.categoryPercentage = 0.70;
      dataset.maxBarThickness = 32;

      config.options = {

        indexAxis: 'y',

        responsive: true,
        maintainAspectRatio: false,
        animation: false,

        layout: {
          padding: context => ({
            top: 12,
            right: context.chart.width < 360 ? 32 : 40,
            bottom: 8,
            left: 4
          })
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
              label: context =>
                `Puntuación: ${context.parsed.x?.toFixed(1)} / 10`
            }
          }

        },

        scales: {

          x: {

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

              font: context => ({
                size: context.chart.width < 360 ? 11 : 12
              })
            }

          },

          y: {

            border: {
              display: false
            },

            grid: {
              display: false
            },

            ticks: {
              color: '#13243d',
              padding: 8,
              autoSkip: false,

              font: context => ({
                size: context.chart.width < 360 ? 11 : 12,
                weight: 500
              })
            }

          }

        }

      };

      config.plugins = [

        ...(config.plugins ?? []),

        {
          id: 'resultsScoreLabels',

          afterDatasetsDraw(chart) {

            const { ctx } = chart;

            const dataset = chart.data.datasets[0];
            const meta = chart.getDatasetMeta(0);

            ctx.save();

            const compact = chart.width < 360;
            const fontSize = compact ? 11 : 13;
            const labelGap = compact ? 5 : 8;

            ctx.font =
              `600 ${fontSize}px Aptos, Segoe UI, sans-serif`;
            ctx.fillStyle = '#00245d';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            meta.data.forEach((bar, index) => {

              const score = dataset.data[index];

              if (
                typeof score !== 'number' ||
                !Number.isFinite(score)
              ) {
                return;
              }

              const label = score.toFixed(1);
              const labelWidth = ctx.measureText(label).width;

              const maxX = Math.max(
                0,
                chart.width - labelWidth - 3
              );

              const labelX = Math.min(
                bar.x + labelGap,
                maxX
              );

              ctx.fillText(
                label,
                labelX,
                bar.y
              );

            });

            ctx.restore();

          }

        }

      ];

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

  // HU-059 / T03 - Accessible bar chart data

  get hasAccessibleChartData(): boolean {
    return this.data.length > 0;
  }

  get accessibleChartTitle(): string {
    return this.variant === 'admin'
      ? 'Cantidades de usuarios por categoría'
      : 'Puntuaciones por ámbito ASG';
  }

  get accessibleValueHeading(): string {
    return this.variant === 'admin'
      ? 'Usuarios'
      : 'Puntuación';
  }

  formatAccessibleChartValue(
    value: number | null | undefined
  ): string {

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      return 'N/D';
    }

    if (this.variant === 'admin') {
      return value.toLocaleString('es-MX', {
        maximumFractionDigits: 0
      });
    }

    return `${value.toFixed(1)} / 10`;
  }

  get accessibleChartDescription(): string {

    if (!this.hasAccessibleChartData) {
      return `${this.accessibleChartTitle}. Sin datos disponibles.`;
    }

    const values = this.data.map(
      (label, index) =>
        `${label}: ${this.formatAccessibleChartValue(this.scores[index])}`
    );

    return `${this.accessibleChartTitle}. ${values.join('; ')}.`;
  }

}