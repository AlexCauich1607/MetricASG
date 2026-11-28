
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';

import {
  BarChartComponent
} from './bar-chart.component';

describe('BarChartComponent', () => {

  let component: BarChartComponent;
  let fixture: ComponentFixture<BarChartComponent>;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [BarChartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(
      BarChartComponent
    );

    component = fixture.componentInstance;

  });

  function renderChart(
    variant:
      | 'default'
      | 'dashboard'
      | 'results'
      | 'admin' = 'dashboard'
  ): void {

    component.variant = variant;

    component.data = [
      'Ambiental',
      'Social',
      'Gobernanza'
    ];

    component.scores = [9.8, 9.6, 9.0];

    component.colors = [
      '#5d9732',
      '#1565c0',
      '#6945ac'
    ];

    component.bordes = [
      '#467326',
      '#00245d',
      '#467326'
    ];

    fixture.detectChanges();
    tick(0);

  }

  it('should create', fakeAsync(() => {

    renderChart();

    expect(component).toBeTruthy();
    expect(component.chart).toBeTruthy();

  }));

  it('should use the default variant initially', () => {

    expect(component.variant).toBe('default');

  });

  it('should configure a fixed ASG scale', fakeAsync(() => {

    renderChart();

    const scale = component.chart.options.scales.y;

    expect(scale.min).toBe(0);
    expect(scale.max).toBe(10);
    expect(scale.ticks.stepSize).toBe(2);

  }));

  it('should preserve the original score values', fakeAsync(() => {

    renderChart();

    expect(
      component.chart.data.datasets[0].data
    ).toEqual([9.8, 9.6, 9.0]);

  }));

  it('should preserve ambit labels and colors', fakeAsync(() => {

    renderChart();

    expect(component.chart.data.labels)
      .toEqual(component.data);

    expect(
      component.chart.data.datasets[0].backgroundColor
    ).toEqual(component.colors);

  }));

  it('should remove thick borders in the dashboard', fakeAsync(() => {

    renderChart();

    expect(
      component.chart.data.datasets[0].borderWidth
    ).toBe(0);

    expect(
      component.chart.data.datasets[0].maxBarThickness
    ).toBe(64);

  }));

  it('should disable dashboard chart animations', fakeAsync(() => {

    renderChart();

    expect(
      component.chart.options.animation
    ).toBeFalse();

  }));

  it('should provide an accessible dashboard chart', fakeAsync(() => {

    renderChart();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    expect(canvas.getAttribute('role')).toBe('img');

    expect(
      canvas.getAttribute('aria-label')
    ).toContain('Puntuaciones por ámbito ASG');

  }));

  it('should preserve the default chart borders', fakeAsync(() => {

    renderChart('default');

    expect(
      component.chart.data.datasets[0].borderWidth
    ).toBe(4);

    expect(
      component.chart.data.datasets[0].borderColor
    ).toEqual(component.bordes);

  }));

  it('should not restrict administrative charts to ten', fakeAsync(() => {

    component.data = ['Usuarios'];
    component.scores = [150];
    component.colors = ['#00245d'];

    fixture.detectChanges();
    tick(0);

    expect(
      component.chart.data.datasets[0].data
    ).toEqual([150]);

    expect(
      component.chart.scales.y.max
    ).toBeGreaterThanOrEqual(150);

  }));

  it('should destroy the chart with the component', fakeAsync(() => {

    renderChart();

    const destroy = spyOn(
      component.chart,
      'destroy'
    ).and.callThrough();

    fixture.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);

  }));

  it('should cancel pending chart initialization when destroyed', fakeAsync(() => {

    component.variant = 'dashboard';
    component.data = ['Ambiental'];
    component.scores = [8.5];
    component.colors = ['#5d9732'];

    fixture.detectChanges();

    expect(component.chart).toBeFalsy();

    fixture.destroy();

    tick(0);

    expect(component.chart).toBeFalsy();

  }));

  it('should release the chart reference after destruction', fakeAsync(() => {

    renderChart();

    const destroy = spyOn(
      component.chart,
      'destroy'
    ).and.callThrough();

    fixture.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(component.chart).toBeNull();

    component.ngOnDestroy();

    expect(destroy).toHaveBeenCalledTimes(1);

  }));

  it('should render a horizontal results chart', fakeAsync(() => {

    renderChart('results');

    expect(component.chart.options.indexAxis)
      .toBe('y');

    expect(component.chart.config.type)
      .toBe('bar');

  }));

  it('should use a fixed horizontal ASG scale', fakeAsync(() => {

    renderChart('results');

    const scale = component.chart.options.scales.x;

    expect(scale.min).toBe(0);
    expect(scale.max).toBe(10);
    expect(scale.ticks.stepSize).toBe(2);

  }));

  it('should preserve score values and colors in results', fakeAsync(() => {

    renderChart('results');

    const dataset = component.chart.data.datasets[0];

    expect(dataset.data)
      .toEqual([9.8, 9.6, 9.0]);

    expect(dataset.backgroundColor)
      .toEqual(component.colors);

    expect(component.chart.data.labels)
      .toEqual(component.data);

  }));

  it('should apply the results bar styling', fakeAsync(() => {

    renderChart('results');

    const dataset = component.chart.data.datasets[0];

    expect(dataset.borderWidth).toBe(0);

    expect(dataset.borderRadius).toEqual({
      topLeft: 0,
      bottomLeft: 0,
      topRight: 7,
      bottomRight: 7
    });

    expect(dataset.borderSkipped).toBeFalse();

    expect(dataset.maxBarThickness).toBe(32);

    expect(component.chart.options.animation)
      .toBeFalse();

  }));

  it('should register the results score labels plugin', fakeAsync(() => {

    renderChart('results');

    expect(
      component.chart.config.plugins.some(
        (plugin: { id: string }) =>
          plugin.id === 'resultsScoreLabels'
      )
    ).toBeTrue();

  }));

  it('should not register results labels in the dashboard', fakeAsync(() => {

    renderChart('dashboard');

    const plugins =
      component.chart.config.plugins ?? [];

    expect(
      plugins.some(
        (plugin: { id: string }) =>
          plugin.id === 'resultsScoreLabels'
      )
    ).toBeFalse();

  }));

  it('should provide an accessible results chart', fakeAsync(() => {

    renderChart('results');

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    expect(canvas.getAttribute('role'))
      .toBe('img');

    expect(canvas.getAttribute('aria-label'))
      .toContain('Puntuaciones por ámbito ASG');

    expect(
      fixture.nativeElement.querySelector(
        '.chart-container--results'
      )
    ).not.toBeNull();

  }));

  it('should preserve the vertical dashboard orientation', fakeAsync(() => {

    renderChart('dashboard');

    expect(component.chart.options.indexAxis)
      .toBe('x');

  }));

  // HU-059 / T02 — Administrative chart regression tests

  it('should preserve administrative counts above ten', fakeAsync(() => {

    component.variant = 'admin';

    component.data = [
      'Nivel inicial',
      'Nivel avanzado'
    ];

    component.scores = [150, 275];

    component.colors = [
      '#00245d',
      '#5d9732'
    ];

    fixture.detectChanges();
    tick(0);

    expect(
      component.chart.data.datasets[0].data
    ).toEqual([150, 275]);

    expect(
      component.chart.scales.y.max
    ).toBeGreaterThanOrEqual(275);

  }));

  it('should configure adaptive administrative ticks', fakeAsync(() => {

    renderChart('admin');

    const scales = component.chart.options.scales;

    expect(scales.y.beginAtZero).toBeTrue();

    expect(scales.y.ticks.precision).toBe(0);

    expect(scales.y.ticks.maxTicksLimit).toBe(6);

    expect(scales.x.ticks.autoSkip).toBeTrue();

    expect(scales.x.ticks.minRotation).toBe(0);

    expect(scales.x.ticks.maxRotation).toBe(45);

  }));

  it('should preserve full administrative category labels', fakeAsync(() => {

    component.variant = 'admin';

    component.data = [
      'Nivel de madurez inicial',
      'Nivel de madurez consolidado'
    ];

    component.scores = [120, 250];

    component.colors = [
      '#00245d',
      '#5d9732'
    ];

    fixture.detectChanges();
    tick(0);

    expect(
      component.chart.data.labels
    ).toEqual([
      'Nivel de madurez inicial',
      'Nivel de madurez consolidado'
    ]);

    expect(
      component.chart.data.datasets[0].data
    ).toEqual([120, 250]);

    expect(
      component.chart.data.datasets[0].backgroundColor
    ).toEqual(component.colors);

  }));

  it('should not apply administrative density to the default variant', fakeAsync(() => {

    renderChart('default');

    const ticks =
      component.chart.config.options.scales.y.ticks;

    expect(ticks.precision).toBeUndefined();

    expect(ticks.maxTicksLimit).toBeUndefined();

    expect(
      component.chart.data.datasets[0].borderWidth
    ).toBe(4);

  }));


  // HU-059 / T02.2 - Adaptive ASG presentation

  it('should adapt dashboard fonts to the chart width', fakeAsync(() => {

    renderChart('dashboard');

    const font =
      component.chart.config.options.scales.x.ticks.font;

    expect(
      font({ chart: { width: 263 } }).size
    ).toBe(10);

    expect(
      font({ chart: { width: 600 } }).size
    ).toBe(11);

    expect(
      component.chart.data.labels
    ).toEqual(component.data);

  }));

  it('should preserve all dashboard ambit labels', fakeAsync(() => {

    renderChart('dashboard');

    expect(
      component.chart.options.scales.x.ticks.autoSkip
    ).toBeFalse();

    expect(
      component.chart.data.labels.length
    ).toBe(3);

  }));

  it('should adapt results fonts to the chart width', fakeAsync(() => {

    renderChart('results');

    const scales =
      component.chart.config.options.scales;

    expect(
      scales.x.ticks.font({
        chart: { width: 263 }
      }).size
    ).toBe(11);

    expect(
      scales.y.ticks.font({
        chart: { width: 649 }
      }).size
    ).toBe(12);

  }));

  it('should adapt results padding without changing scores', fakeAsync(() => {

    renderChart('results');

    const padding =
      component.chart.config.options.layout.padding;

    expect(
      padding({ chart: { width: 263 } }).right
    ).toBe(32);

    expect(
      padding({ chart: { width: 649 } }).right
    ).toBe(40);

    expect(
      component.chart.data.datasets[0].data
    ).toEqual([9.8, 9.6, 9.0]);

  }));

  it('should preserve zero and maximum ASG scores', fakeAsync(() => {

    component.variant = 'results';

    component.data = [
      'Ambiental',
      'Social',
      'Gobernanza'
    ];

    component.scores = [0, 10, 5];

    component.colors = [
      '#5d9732',
      '#1565c0',
      '#6945ac'
    ];

    fixture.detectChanges();
    tick(0);

    expect(
      component.chart.data.datasets[0].data
    ).toEqual([0, 10, 5]);

    expect(
      component.chart.scales.x.min
    ).toBe(0);

    expect(
      component.chart.scales.x.max
    ).toBe(10);

  }));

  it('should truncate only the displayed administrative labels', fakeAsync(() => {

    renderChart('admin');

    const callback =
      component.chart.config.options.scales.x.ticks.callback;

    const fullLabel = 'Nivel de madurez consolidado';

    const compact = callback.call({
      chart: { width: 255 },
      getLabelForValue: () => fullLabel
    }, 0);

    const expanded = callback.call({
      chart: { width: 800 },
      getLabelForValue: () => fullLabel
    }, 0);

    expect(compact.length).toBeLessThan(fullLabel.length);

    expect(compact.endsWith('…')).toBeTrue();

    expect(expanded).toBe(fullLabel);

  }));


  // HU-059 / T03 - Accessible bar data tests

  it('should provide a dynamic accessible ASG description', fakeAsync(() => {

    renderChart('dashboard');

    const description =
      component.accessibleChartDescription;

    expect(description).toContain('Ambiental: 9.8 / 10');
    expect(description).toContain('Social: 9.6 / 10');
    expect(description).toContain('Gobernanza: 9.0 / 10');

  }));

  it('should provide administrative counts without ASG units', fakeAsync(() => {

    component.variant = 'admin';
    component.data = ['Usuarios activos'];
    component.scores = [275];
    component.colors = ['#00245d'];

    fixture.detectChanges();
    tick(0);

    expect(
      component.accessibleChartDescription
    ).toContain('Usuarios activos: 275');

    expect(
      component.accessibleChartDescription
    ).not.toContain('/ 10');

  }));

  it('should distinguish unavailable scores from zero', () => {

    component.variant = 'results';

    expect(
      component.formatAccessibleChartValue(0)
    ).toBe('0.0 / 10');

    expect(
      component.formatAccessibleChartValue(null)
    ).toBe('N/D');

    expect(
      component.formatAccessibleChartValue(undefined)
    ).toBe('N/D');

    expect(
      component.formatAccessibleChartValue(NaN)
    ).toBe('N/D');

    expect(
      component.formatAccessibleChartValue(Infinity)
    ).toBe('N/D');

  });

  it('should preserve zero administrative counts', () => {

    component.variant = 'admin';

    expect(
      component.formatAccessibleChartValue(0)
    ).toBe('0');

  });

  it('should provide a semantic data table', fakeAsync(() => {

    renderChart('results');

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

    expect(table.querySelector('caption')).not.toBeNull();

    expect(
      table.querySelectorAll('tbody tr').length
    ).toBe(3);

    expect(
      table.querySelectorAll('th[scope="row"]').length
    ).toBe(3);

    expect(table.textContent).toContain('9.8 / 10');

  }));

  it('should preserve complete administrative labels in the table', fakeAsync(() => {

    component.variant = 'admin';

    const label = 'Nivel de madurez consolidado';

    component.data = [label];
    component.scores = [275];
    component.colors = ['#00245d'];

    fixture.detectChanges();
    tick(0);

    const table = fixture.nativeElement.querySelector(
      '.chart-data-alternative__table'
    );

    expect(table.textContent).toContain(label);
    expect(table.textContent).toContain('275');

  }));

  it('should provide an empty alternative for missing data', fakeAsync(() => {

    component.variant = 'dashboard';

    fixture.detectChanges();
    tick(0);

    expect(component.hasAccessibleChartData).toBeFalse();

    expect(
      component.accessibleChartDescription
    ).toContain('Sin datos disponibles');

    expect(
      fixture.nativeElement.querySelector(
        '.chart-data-alternative__empty'
      )
    ).not.toBeNull();

  }));

  it('should preserve the legacy PDF presentation', fakeAsync(() => {

    renderChart('default');

    expect(
      fixture.nativeElement.querySelector(
        '.chart-data-alternative'
      )
    ).toBeNull();

  }));

  it('should expose actual scores through the canvas aria label', fakeAsync(() => {

    renderChart('dashboard');

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    const label = canvas.getAttribute('aria-label');

    expect(label).toContain('Ambiental: 9.8 / 10');
    expect(label).toContain('Social: 9.6 / 10');
    expect(label).toContain('Gobernanza: 9.0 / 10');

  }));

});
