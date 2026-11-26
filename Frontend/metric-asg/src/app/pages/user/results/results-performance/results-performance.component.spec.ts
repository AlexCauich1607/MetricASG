
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';

import {
  ResultsPerformanceComponent
} from './results-performance.component';

import {
  ResultAmbit
} from '../../../../models/evaluation_result';

describe('ResultsPerformanceComponent', () => {

  let component: ResultsPerformanceComponent;
  let fixture: ComponentFixture<ResultsPerformanceComponent>;

  const environmental: ResultAmbit = {
    ambit_id: 1,
    ambit_name: 'Ambiental',
    letter: 'A',
    score: 9.8,
    color: '#30a745',
    maturity_level: 'Avanzado',
    maturity_color: '#164e64',
    feedback: 'Fortalecer la sostenibilidad ambiental.'
  };

  const social: ResultAmbit = {
    ambit_id: 2,
    ambit_name: 'Social',
    letter: 'S',
    score: 9.6,
    color: '#1565c0',
    maturity_level: 'Avanzado',
    maturity_color: '#164e64',
    feedback: 'Generar impacto social.'
  };

  const governance: ResultAmbit = {
    ambit_id: 3,
    ambit_name: 'Gobernanza',
    letter: 'G',
    score: 9,
    color: '#4527a0',
    maturity_level: 'Intermedio',
    maturity_color: '#059669',
    feedback: 'Fortalecer controles y transparencia.'
  };

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [ResultsPerformanceComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(
      ResultsPerformanceComponent
    );

    component = fixture.componentInstance;

  });

  function setAmbits(ambits: ResultAmbit[]): void {

    fixture.componentRef.setInput('ambits', ambits);

    fixture.detectChanges();

    tick(0);

  }

  function setSummary(
    highest: ResultAmbit[],
    lowest: ResultAmbit[]
  ): void {

    fixture.componentRef.setInput(
      'highestAmbits',
      highest
    );

    fixture.componentRef.setInput(
      'lowestAmbits',
      lowest
    );

    fixture.detectChanges();

    tick(0);

  }

  it('should create', () => {

    fixture.detectChanges();

    expect(component).toBeTruthy();

  });

  it('should prepare the bar chart data', fakeAsync(() => {

    setAmbits([
      environmental,
      social,
      governance
    ]);

    expect(component.barLabels).toEqual([
      'Ambiental',
      'Social',
      'Gobernanza'
    ]);

    expect(component.barScores).toEqual([
      9.8,
      9.6,
      9
    ]);

    expect(component.barColors).toEqual([
      '#30a745',
      '#1565c0',
      '#4527a0'
    ]);

  }));

  it('should prepare the radar chart data', fakeAsync(() => {

    setAmbits([
      environmental,
      social,
      governance
    ]);

    expect(component.radarLabels).toEqual([
      'Ambiental',
      'Social',
      'Gobernanza'
    ]);

    expect(component.radarScores).toEqual([
      9.8,
      9.6,
      9
    ]);

    expect(component.radarColors).toEqual([
      '#30a745',
      '#1565c0',
      '#4527a0'
    ]);

  }));

  it('should preserve the original score precision', fakeAsync(() => {

    setAmbits([
      {
        ...environmental,
        score: 9.876
      }
    ]);

    expect(component.barScores).toEqual([
      9.876
    ]);

    expect(component.radarScores).toEqual([
      9.876
    ]);

  }));

  it('should exclude invalid scores from the bar chart', fakeAsync(() => {

    setAmbits([
      {
        ...environmental,
        score: -1
      },
      social,
      {
        ...governance,
        score: 11
      }
    ]);

    expect(component.barLabels).toEqual([
      'Social'
    ]);

    expect(component.barScores).toEqual([
      9.6
    ]);

    expect(component.barColors).toEqual([
      '#1565c0'
    ]);

  }));

  it('should preserve missing radar positions as null', fakeAsync(() => {

    setAmbits([
      {
        ...environmental,
        score: Number.NaN
      },
      social,
      {
        ...governance,
        score: Number.POSITIVE_INFINITY
      }
    ]);

    expect(component.radarLabels).toEqual([
      'Ambiental',
      'Social',
      'Gobernanza'
    ]);

    expect(component.radarScores).toEqual([
      null,
      9.6,
      null
    ]);

  }));

  it('should preserve valid minimum and maximum scores', fakeAsync(() => {

    setAmbits([
      {
        ...environmental,
        score: 0
      },
      {
        ...social,
        score: 10
      }
    ]);

    expect(component.barScores).toEqual([
      0,
      10
    ]);

    expect(component.radarScores).toEqual([
      0,
      10
    ]);

  }));

  it('should use the institutional fallback color', fakeAsync(() => {

    setAmbits([
      {
        ...environmental,
        color: ''
      }
    ]);

    expect(component.barColors).toEqual([
      '#00245d'
    ]);

    expect(component.radarColors).toEqual([
      '#00245d'
    ]);

  }));

  it('should show the empty state without valid scores', fakeAsync(() => {

    setAmbits([
      {
        ...environmental,
        score: -1
      },
      {
        ...social,
        score: 11
      }
    ]);

    expect(component.hasChartData).toBeFalse();

    const element: HTMLElement =
      fixture.nativeElement;

    expect(
      element.querySelector(
        '.performance-analysis__empty'
      )
    ).not.toBeNull();

    expect(
      element.querySelector('app-bar-chart')
    ).toBeNull();

    expect(
      element.querySelector('app-radar-chart')
    ).toBeNull();

  }));

  it('should display both charts with valid scores', fakeAsync(() => {

    setAmbits([
      environmental,
      social,
      governance
    ]);

    expect(component.hasChartData).toBeTrue();

    const element: HTMLElement =
      fixture.nativeElement;

    expect(
      element.querySelector('app-bar-chart')
    ).not.toBeNull();

    expect(
      element.querySelector('app-radar-chart')
    ).not.toBeNull();

  }));

  it('should not display a summary with only one valid score', fakeAsync(() => {

    setAmbits([
      environmental
    ]);

    setSummary(
      [environmental],
      [environmental]
    );

    expect(component.hasSummary).toBeFalse();

    expect(
      fixture.nativeElement.querySelector(
        '.performance-summary'
      )
    ).toBeNull();

  }));

  it('should not display a summary without comparison data', fakeAsync(() => {

    setAmbits([
      environmental,
      social,
      governance
    ]);

    expect(component.hasSummary).toBeFalse();

  }));

  it('should display the highest and lowest scores', fakeAsync(() => {

    setAmbits([
      environmental,
      social,
      governance
    ]);

    setSummary(
      [environmental],
      [governance]
    );

    expect(component.hasSummary).toBeTrue();
    expect(component.isBalanced).toBeFalse();

    const summary: HTMLElement =
      fixture.nativeElement.querySelector(
        '.performance-summary'
      );

    expect(summary.textContent).toContain(
      'Mayor puntuación'
    );

    expect(summary.textContent).toContain(
      'Menor puntuación'
    );

    expect(summary.textContent).toContain(
      'Ambiental'
    );

    expect(summary.textContent).toContain(
      'Gobernanza'
    );

    expect(summary.textContent).toContain(
      '9.8'
    );

    expect(summary.textContent).toContain(
      '9.0'
    );

  }));

  it('should display tied ambit names', fakeAsync(() => {

    const tiedSocial = {
      ...social,
      score: environmental.score
    };

    setAmbits([
      environmental,
      tiedSocial,
      governance
    ]);

    setSummary(
      [environmental, tiedSocial],
      [governance]
    );

    expect(
      component.getAmbitNames([
        environmental,
        tiedSocial
      ])
    ).toBe('Ambiental, Social');

    const summary: HTMLElement =
      fixture.nativeElement.querySelector(
        '.performance-summary'
      );

    expect(summary.textContent).toContain(
      'Ambiental, Social'
    );

  }));

  it('should display balanced performance for equal scores', fakeAsync(() => {

    const equalAmbits = [
      environmental,
      social,
      governance
    ].map(ambit => ({
      ...ambit,
      score: 8
    }));

    setAmbits(equalAmbits);

    setSummary(
      equalAmbits,
      equalAmbits
    );

    expect(component.hasSummary).toBeTrue();
    expect(component.isBalanced).toBeTrue();

    const summary: HTMLElement =
      fixture.nativeElement.querySelector(
        '.performance-summary'
      );

    expect(summary.textContent).toContain(
      'Desempeño equilibrado'
    );

    expect(summary.textContent).not.toContain(
      'Mayor puntuación'
    );

    expect(summary.textContent).not.toContain(
      'Menor puntuación'
    );

  }));

  it('should rebuild chart data when ambits change', fakeAsync(() => {

    setAmbits([
      environmental,
      social,
      governance
    ]);

    const previousRevision =
      component.chartRevision;

    setAmbits([
      {
        ...environmental,
        score: 7.5
      },
      {
        ...social,
        score: 8.2
      }
    ]);

    expect(component.chartRevision).toBe(
      previousRevision + 1
    );

    expect(component.barScores).toEqual([
      7.5,
      8.2
    ]);

    expect(component.radarScores).toEqual([
      7.5,
      8.2
    ]);

  }));

  it('should clear previous chart data when ambits become empty', fakeAsync(() => {

    setAmbits([
      environmental,
      social,
      governance
    ]);

    setAmbits([]);

    expect(component.barLabels).toEqual([]);
    expect(component.barScores).toEqual([]);
    expect(component.barColors).toEqual([]);

    expect(component.radarLabels).toEqual([]);
    expect(component.radarScores).toEqual([]);
    expect(component.radarColors).toEqual([]);

    expect(component.hasChartData).toBeFalse();
    expect(component.hasSummary).toBeFalse();

  }));

});
