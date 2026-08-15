import { Component, Input, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-bar-chart',
  standalone: false,
  templateUrl: './bar-chart.component.html',
  styleUrl: './bar-chart.component.scss'
})
export class BarChartComponent implements AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef;

  chart: any;
  @Input() id: number = 0;
  @Input() data: string[] = [];
  @Input() scores: number[] = [];
  @Input() colors: string[] = [];
  @Input() bordes: string[] = [];

  ngAfterViewInit(): void {
    setTimeout(() => this.cargarGrafica(), 0);
  }

  private cargarGrafica(): void {

    if (!this.chartCanvas?.nativeElement) {
      console.error('Canvas element not found');
      return;
    }


    const ctx = this.chartCanvas.nativeElement.getContext('2d');

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
          borderColor: this.bordes,
          borderWidth: this.bordes.length == 0 ? 0 : 4,
          borderRadius: {
            topLeft: 5,
            topRight: 5,
            bottomLeft: 5,
            bottomRight: 5
          },
          borderSkipped: false,

          barPercentage: 0.5,
          categoryPercentage: 0.5,
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


    if (this.chart) {
      this.chart.destroy();
    }


    this.chart = new Chart(ctx, config);
  }

  ngOnDestroy(): void {

    if (this.chart) {
      this.chart.destroy();
    }
  }
}