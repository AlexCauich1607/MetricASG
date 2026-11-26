import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';

import { BarChartComponent } from './bar-chart.component';

describe('BarChartComponent', () => {
  let component: BarChartComponent;
  let fixture: ComponentFixture<BarChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarChartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(BarChartComponent);
    component = fixture.componentInstance;
  });

  function renderChart(
    variant: 'default' | 'dashboard' | 'results' = 'dashboard'
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

    expect(component.chart.options.animation)
      .toBeFalse();
  }));

  it('should provide an accessible dashboard chart', fakeAsync(() => {
    renderChart();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    expect(canvas.getAttribute('role')).toBe('img');

    expect(
      canvas.getAttribute('aria-label')
    ).toContain('puntuaciones por ámbito ASG');
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

    expect(dataset.borderRadius).toBe(6);

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

    const plugins = component.chart.config.plugins ?? [];

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
      .toContain('puntuaciones por ámbito ASG');

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

});