
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';

import { Chart } from 'chart.js';

import {
  RadarChartComponent
} from './radar-chart.component';

describe('RadarChartComponent', () => {

  let component: RadarChartComponent;
  let fixture: ComponentFixture<RadarChartComponent>;

  const labels = [
    'Ambiental',
    'Social',
    'Gobernanza'
  ];

  const scores = [
    9.8,
    9.6,
    9
  ];

  const colors = [
    '#30a745',
    '#1565c0',
    '#4527a0'
  ];

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [RadarChartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(
      RadarChartComponent
    );

    component = fixture.componentInstance;

  });

  function renderChart(
    inputScores: (number | null)[] = scores,
    inputLabels: string[] = labels,
    inputColors: string[] = colors
  ): void {

    fixture.componentRef.setInput(
      'data',
      inputLabels
    );

    fixture.componentRef.setInput(
      'scores',
      inputScores
    );

    fixture.componentRef.setInput(
      'colors',
      inputColors
    );

    fixture.detectChanges();

    tick(0);

  }

  it('should create', fakeAsync(() => {

    renderChart();

    expect(component).toBeTruthy();

  }));

  it('should initialize a radar chart', fakeAsync(() => {

    renderChart();

    expect(component.chart).not.toBeNull();

    const config = component.chart!.config;

    expect('type' in config).toBeTrue();

    if ('type' in config) {
      expect(config.type).toBe('radar');
    }

  }));

  it('should preserve labels and scores', fakeAsync(() => {

    renderChart();

    expect(
      component.chart!.data.labels
    ).toEqual(labels);

    expect(
      component.chart!.data.datasets[0].data
    ).toEqual(scores);

  }));

  it('should preserve ambit point colors', fakeAsync(() => {

    renderChart();

    expect(
      component.chart!.data.datasets[0]
        .pointBackgroundColor
    ).toEqual(colors);

  }));

  it('should use a fallback color when missing', fakeAsync(() => {

    renderChart(
      scores,
      labels,
      ['#30a745']
    );

    expect(
      component.chart!.data.datasets[0]
        .pointBackgroundColor
    ).toEqual([
      '#30a745',
      '#00245d',
      '#00245d'
    ]);

  }));

  it('should keep the official scale from zero to ten', fakeAsync(() => {

    renderChart();

    expect(
      component.chart!.scales['r'].min
    ).toBe(0);

    expect(
      component.chart!.scales['r'].max
    ).toBe(10);

  }));

  it('should fill a complete radar profile', fakeAsync(() => {

    renderChart();

    const dataset =
      component.chart!.data.datasets[0];

    expect(dataset.fill).toBeTrue();
    expect(dataset.showLine).toBeTrue();
    expect(dataset.spanGaps).toBeFalse();

  }));

  it('should not fill an incomplete radar profile', fakeAsync(() => {

    renderChart([
      9.8,
      null,
      9
    ]);

    const dataset =
      component.chart!.data.datasets[0];

    expect(dataset.fill).toBeFalse();
    expect(dataset.showLine).toBeFalse();
    expect(dataset.spanGaps).toBeFalse();

  }));

  it('should preserve null scores instead of converting them to zero', fakeAsync(() => {

    renderChart([
      9.8,
      null,
      9
    ]);

    expect(component.validScores).toEqual([
      9.8,
      null,
      9
    ]);

    expect(
      component.chart!.data.datasets[0].data
    ).toEqual([
      9.8,
      null,
      9
    ]);

  }));

  it('should not render a missing score as a radar point', fakeAsync(() => {

    renderChart([
      9.8,
      null,
      9
    ]);

    const point =
      component.chart!.getDatasetMeta(0).data[1];

    expect(
      (point as unknown as { skip: boolean }).skip
    ).toBeTrue();

  }));

  it('should convert invalid scores to null', fakeAsync(() => {

    renderChart([
      -1,
      Number.NaN,
      11
    ]);

    expect(component.validScores).toEqual([
      null,
      null,
      null
    ]);

  }));

  it('should handle missing score entries', fakeAsync(() => {

    renderChart([
      9.8
    ]);

    expect(component.validScores).toEqual([
      9.8,
      null,
      null
    ]);

  }));

  it('should preserve valid minimum and maximum scores', fakeAsync(() => {

    renderChart([
      0,
      10,
      5
    ]);

    expect(component.validScores).toEqual([
      0,
      10,
      5
    ]);

  }));

  it('should distinguish a valid zero score from a missing score', fakeAsync(() => {

    renderChart([
      0,
      null,
      9
    ]);

    const points =
      component.chart!.getDatasetMeta(0).data;

    const zeroPoint =
      points[0] as unknown as { skip: boolean };

    const missingPoint =
      points[1] as unknown as { skip: boolean };

    expect(zeroPoint.skip).toBeFalse();

    expect(missingPoint.skip).toBeTrue();

  }));

  it('should not fill a profile with fewer than three ambits', fakeAsync(() => {

    renderChart(
      [8, 9],
      ['Ambiental', 'Social'],
      ['#30a745', '#1565c0']
    );

    const dataset =
      component.chart!.data.datasets[0];

    expect(dataset.fill).toBeFalse();
    expect(dataset.showLine).toBeFalse();

  }));

  it('should provide an accessible chart description', fakeAsync(() => {

    renderChart();

    const canvas: HTMLCanvasElement =
      fixture.nativeElement.querySelector('canvas');

    expect(
      canvas.getAttribute('role')
    ).toBe('img');

    expect(
      canvas.getAttribute('aria-label')
    ).toContain('Ambiental: 9.8 de 10');

    expect(
      canvas.getAttribute('aria-label')
    ).toContain('Social: 9.6 de 10');

    expect(
      canvas.getAttribute('aria-label')
    ).toContain('Gobernanza: 9.0 de 10');

  }));

  it('should describe missing scores as unavailable', fakeAsync(() => {

    renderChart([
      9.8,
      null,
      9
    ]);

    expect(
      component.accessibleDescription
    ).toContain('Social: No disponible');

  }));

  it('should recreate the chart when inputs change', fakeAsync(() => {

    renderChart();

    const previousChart = component.chart!;

    const destroySpy = spyOn(
      previousChart,
      'destroy'
    ).and.callThrough();

    fixture.componentRef.setInput(
      'scores',
      [7, 8, 9]
    );

    fixture.detectChanges();

    tick(0);

    expect(destroySpy).toHaveBeenCalledTimes(1);

    expect(component.chart).not.toBe(previousChart);

    expect(
      component.chart!.data.datasets[0].data
    ).toEqual([
      7,
      8,
      9
    ]);

  }));

  it('should destroy the chart when the component is destroyed', fakeAsync(() => {

    renderChart();

    const chart = component.chart!;

    const canvas =
      component.chartCanvas.nativeElement;

    const destroySpy = spyOn(
      chart,
      'destroy'
    ).and.callThrough();

    fixture.destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);

    expect(component.chart).toBeNull();

    expect(
      Chart.getChart(canvas)
    ).toBeUndefined();

  }));

  it('should cancel pending initialization when destroyed', fakeAsync(() => {

    fixture.componentRef.setInput(
      'data',
      labels
    );

    fixture.componentRef.setInput(
      'scores',
      scores
    );

    fixture.detectChanges();

    expect(component.chart).toBeNull();

    fixture.destroy();

    tick(0);

    expect(component.chart).toBeNull();

  }));

});
