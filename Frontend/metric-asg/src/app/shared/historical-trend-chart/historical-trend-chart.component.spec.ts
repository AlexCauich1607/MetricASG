import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import { Chart } from 'chart.js';

import {
  HistoricalTrendChartComponent,
  HistoricalTrendDataset
} from './historical-trend-chart.component';

describe('HistoricalTrendChartComponent', () => {

  let fixture: ComponentFixture<HistoricalTrendChartComponent>;
  let component: HistoricalTrendChartComponent;

  const dates = [
    Date.UTC(2026, 0, 15, 12),
    Date.UTC(2026, 3, 15, 12),
    Date.UTC(2026, 6, 15, 12)
  ];

  const datasets: HistoricalTrendDataset[] = [
    {
      label: 'Nivel ASG',
      color: '#00245d',
      data: [
        { x: dates[0], y: 0 },
        { x: dates[1], y: null },
        { x: dates[2], y: 10 }
      ]
    }
  ];

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [HistoricalTrendChartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(
      HistoricalTrendChartComponent
    );

    component = fixture.componentInstance;

  });

  function renderChart(): Chart {

    fixture.componentRef.setInput(
      'datasets',
      datasets
    );

    fixture.detectChanges();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    const chart = Chart.getChart(canvas);

    if (!chart) {
      throw new Error('Historical chart was not initialized');
    }

    return chart;

  }

  it('should create the historical chart', () => {

    const chart = renderChart();

    expect(component).toBeTruthy();
    expect(chart).toBeTruthy();

  });

  it('should preserve historical timestamps and scores', () => {

    const chart = renderChart();

    expect(
      chart.data.datasets[0].data
    ).toEqual(datasets[0].data);

  });

  it('should preserve missing values and zero scores', () => {

    const chart = renderChart();

    expect(
      chart.data.datasets[0].data
    ).toEqual([
      { x: dates[0], y: 0 },
      { x: dates[1], y: null },
      { x: dates[2], y: 10 }
    ]);

  });

  it('should not connect missing historical scores', () => {

    const chart = renderChart();

    const dataset = chart.data.datasets[0] as {
      spanGaps?: boolean | number
    };

    expect(dataset.spanGaps).toBeFalse();

  });

  it('should preserve the official ASG scale', () => {

    const chart = renderChart();

    expect(chart.scales['y'].min).toBe(0);
    expect(chart.scales['y'].max).toBe(10);

  });

  it('should preserve the linear temporal axis', () => {

    const chart = renderChart();

    expect(chart.scales['x'].type).toBe('linear');

  });

  it('should configure readable historical ticks', () => {

    const chart = renderChart();

    const options = chart.config.options as any;

    expect(
      options.scales.x.ticks.autoSkip
    ).toBeTrue();

    expect(
      options.scales.x.ticks.maxTicksLimit
    ).toBe(8);

    expect(
      options.scales.x.ticks.maxRotation
    ).toBe(0);

    expect(
      options.scales.y.ticks.stepSize
    ).toBe(2);

  });

  it('should adapt date formatting to the chart width', () => {

    const chart = renderChart();

    const options = chart.config.options as any;

    const callback = options.scales.x.ticks.callback;

    const compact = callback.call({
      chart: { width: 255 }
    }, dates[0]);

    const expanded = callback.call({
      chart: { width: 800 }
    }, dates[0]);

    expect(compact).toBe(
      new Date(dates[0]).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      })
    );

    expect(expanded).toBe(
      new Date(dates[0]).toLocaleDateString('es-MX')
    );

  });

  it('should adapt historical tick fonts', () => {

    const chart = renderChart();

    const options = chart.config.options as any;

    const font = options.scales.x.ticks.font;

    expect(
      font({ chart: { width: 255 } }).size
    ).toBe(10);

    expect(
      font({ chart: { width: 800 } }).size
    ).toBe(12);

  });

  it('should preserve dataset names and colors', () => {

    const chart = renderChart();

    expect(
      chart.data.datasets[0].label
    ).toBe('Nivel ASG');

    expect(
      chart.data.datasets[0].borderColor
    ).toBe('#00245d');

    expect(
      chart.data.datasets[0].backgroundColor
    ).toBe('#00245d');

  });

  it('should preserve the legend and its adaptive font', () => {

    const chart = renderChart();

    const options = chart.config.options as any;

    expect(
      options.plugins.legend.display
    ).toBeTrue();

    expect(
      options.plugins.legend.position
    ).toBe('bottom');

    const font = options.plugins.legend.labels.font;

    expect(
      font({ chart: { width: 255 } }).size
    ).toBe(10);

    expect(
      font({ chart: { width: 800 } }).size
    ).toBe(12);

  });

  it('should recreate the chart when datasets change', () => {

    const previousChart = renderChart();

    const destroy = spyOn(
      previousChart,
      'destroy'
    ).and.callThrough();

    fixture.componentRef.setInput('datasets', [
      {
        label: 'Nivel ASG',
        color: '#00245d',
        data: [
          { x: dates[0], y: 8.5 },
          { x: dates[1], y: 9 }
        ]
      }
    ]);

    fixture.detectChanges();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    const nextChart = Chart.getChart(canvas);

    expect(destroy).toHaveBeenCalledTimes(1);

    expect(nextChart).not.toBe(previousChart);

    expect(
      nextChart!.data.datasets[0].data
    ).toEqual([
      { x: dates[0], y: 8.5 },
      { x: dates[1], y: 9 }
    ]);

  });

  it('should destroy the historical chart with the component', () => {

    const chart = renderChart();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    const destroy = spyOn(
      chart,
      'destroy'
    ).and.callThrough();

    fixture.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);

    expect(
      Chart.getChart(canvas)
    ).toBeUndefined();

  });


  // HU-059 / T03 - Accessible historical data tests

  it('should provide an accessible historical table', () => {

    renderChart();

    const details: HTMLDetailsElement =
      fixture.nativeElement.querySelector(
        '.chart-data-alternative'
      );

    expect(details).not.toBeNull();
    expect(details.open).toBeFalse();

    expect(
      details.querySelector('summary')
    ).not.toBeNull();

    const table = details.querySelector('table')!;

    expect(
      table.querySelector('caption')?.textContent
    ).toContain('Nivel ASG');

    expect(
      table.querySelectorAll('tbody tr').length
    ).toBe(3);

    expect(
      table.querySelectorAll('th[scope="row"]').length
    ).toBe(3);

  });

  it('should distinguish unavailable historical scores from zero', () => {

    expect(
      component.formatAccessibleHistoricalScore(0)
    ).toBe('0.0 / 10');

    expect(
      component.formatAccessibleHistoricalScore(null)
    ).toBe('N/D');

    expect(
      component.formatAccessibleHistoricalScore(undefined)
    ).toBe('N/D');

    expect(
      component.formatAccessibleHistoricalScore(NaN)
    ).toBe('N/D');

    expect(
      component.formatAccessibleHistoricalScore(10)
    ).toBe('10.0 / 10');

  });

  it('should preserve complete historical dates in text', () => {

    expect(
      component.formatAccessibleHistoricalDate(dates[0])
    ).toBe(
      new Date(dates[0]).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    );

    expect(
      component.formatAccessibleHistoricalDate(NaN)
    ).toBe('Fecha no disponible');

  });

  it('should display historical zero and null values separately', () => {

    renderChart();

    const table = fixture.nativeElement.querySelector(
      '.chart-data-alternative__table'
    );

    expect(table.textContent).toContain('0.0 / 10');
    expect(table.textContent).toContain('N/D');
    expect(table.textContent).toContain('10.0 / 10');

  });

  it('should provide a separate table for each historical series', () => {

    fixture.componentRef.setInput('datasets', [
      {
        label: 'Ambiental',
        color: '#5d9732',
        data: [
          { x: dates[0], y: 8.5 }
        ]
      },
      {
        label: 'Social',
        color: '#1565c0',
        data: [
          { x: dates[0], y: 9 }
        ]
      }
    ]);

    fixture.detectChanges();

    const tables =
      fixture.nativeElement.querySelectorAll(
        '.chart-data-alternative__table'
      );

    expect(tables.length).toBe(2);

    expect(
      tables[0].querySelector('caption').textContent
    ).toContain('Ambiental');

    expect(
      tables[1].querySelector('caption').textContent
    ).toContain('Social');

  });

  it('should provide a textual empty state', () => {

    fixture.componentRef.setInput('datasets', []);

    fixture.detectChanges();

    expect(
      component.hasAccessibleHistoricalData
    ).toBeFalse();

    expect(
      fixture.nativeElement.querySelector(
        '.chart-data-alternative__empty'
      )
    ).not.toBeNull();

  });

  it('should provide a descriptive historical canvas label', () => {

    renderChart();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    expect(canvas.getAttribute('role')).toBe('img');

    expect(
      canvas.getAttribute('aria-label')
    ).toContain('Nivel ASG');

    expect(
      canvas.getAttribute('aria-label')
    ).toContain('0 a 10');

  });

});
