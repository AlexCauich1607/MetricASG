import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmbitCardComponent } from './ambit-card.component';

describe('AmbitCardComponent', () => {
  let component: AmbitCardComponent;
  let fixture: ComponentFixture<AmbitCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AmbitCardComponent
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AmbitCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('should preserve the default variant', () => {
    expect(component.variant).toBe('default');

    expect(
      fixture.nativeElement.querySelector('.dashboard-kpi')
    ).toBeNull();
  });

  it('should render the dashboard variant', () => {
    component.variant = 'dashboard';
    component.title = 'Ambiental';
    component.letter = 'A';
    component.subtitle = 'Avanzado';
    component.score = 9.8;

    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector(
      '.dashboard-kpi'
    );

    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Ambiental');
    expect(card.textContent).toContain('9.8');
    expect(card.textContent).toContain('Avanzado');
    expect(component.progressPercentage).toBe(98);
  });

  it('should display unavailable scores without a progress bar', () => {
    component.variant = 'dashboard';
    component.score = null;

    fixture.detectChanges();

    expect(component.formattedScore).toBe('N/D');

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__score'
      ).textContent.trim()
    ).toBe('N/D');

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__progress'
      )
    ).toBeNull();
  });

  it('should handle non-finite scores', () => {
    component.score = Number.NaN;

    expect(component.formattedScore).toBe('N/D');
    expect(component.progressPercentage).toBe(0);

    component.score = Number.POSITIVE_INFINITY;

    expect(component.formattedScore).toBe('N/D');
    expect(component.progressPercentage).toBe(0);
  });

  it('should limit the progress bar without changing the score', () => {
    component.score = 12;

    expect(component.progressPercentage).toBe(100);
    expect(component.formattedScore).toBe('12.0');

    component.score = -2;

    expect(component.progressPercentage).toBe(0);
    expect(component.formattedScore).toBe('-2.0');
  });

  it('should preserve positive delta in the default variant', () => {
    component.showDelta = true;
    component.delta = 1.2;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.textContent
    ).toContain('+1.2');
  });

  it('should preserve unavailable historical comparisons', () => {
    component.showDelta = true;
    component.delta = null;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.textContent
    ).toContain('Sin comparación');
  });

  it('should support delta in the dashboard variant', () => {
    component.variant = 'dashboard';
    component.showDelta = true;
    component.delta = -0.5;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__delta'
      ).textContent.trim()
    ).toBe('-0.5');
  });
  it('should render a featured dashboard card', () => {
    component.variant = 'dashboard';
    component.featured = true;
    component.score = 9.5;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi--featured'
      )
    ).not.toBeNull();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__gauge'
      )
    ).not.toBeNull();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__gauge-fill'
      ).getAttribute('stroke-dasharray')
    ).toBe('95 100');
  });

  it('should hide the gauge when the score is unavailable', () => {
    component.variant = 'dashboard';
    component.featured = true;
    component.score = null;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__gauge'
      )
    ).toBeNull();

    expect(component.formattedScore).toBe('N/D');
  });
  [
    '#ffffff',
    '#000000',
    '#eac84f',
    '#00245d'
  ].forEach(color => {

    it(`should preserve the configured maturity color ${color}`, () => {
      component.variant = 'dashboard';
      component.maturity_color = color;

      fixture.detectChanges();

      const level: HTMLElement =
        fixture.nativeElement.querySelector(
          '.dashboard-kpi__level'
        );

      expect(component.dashboardMaturityColor)
        .toBe(color);

      expect(level).not.toBeNull();

      expect(
        level.style.getPropertyValue('--maturity-color').trim()
      ).toBe(color);
    });

  });
  it('should render the configured maturity color in the soft glass badge', () => {
    component.variant = 'dashboard';
    component.subtitle = 'Intermedio';
    component.maturity_color = '#eac84f';

    fixture.detectChanges();

    const level: HTMLElement =
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__level'
      );

    expect(level).not.toBeNull();

    expect(
      level.style.getPropertyValue('--maturity-color').trim()
    ).toBe('#eac84f');

    expect(level.textContent?.trim())
      .toBe('Intermedio');

    expect(
      level.querySelector('.dashboard-kpi__level-dot')
    ).not.toBeNull();
  });

  it('should preserve the maturity color in the featured card', () => {
    component.variant = 'dashboard';
    component.featured = true;
    component.subtitle = 'Avanzado';
    component.maturity_color = '#00245d';

    fixture.detectChanges();

    const level: HTMLElement =
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__level'
      );

    expect(level).not.toBeNull();

    expect(
      level.style.getPropertyValue('--maturity-color').trim()
    ).toBe('#00245d');

    expect(level.textContent?.trim())
      .toBe('Avanzado');

    expect(
      level.querySelector('.dashboard-kpi__level-dot')
    ).not.toBeNull();
  });

  it('should use neutral styles when maturity color is missing', () => {
    component.variant = 'dashboard';
    component.maturity_color = '';

    fixture.detectChanges();

    const level: HTMLElement =
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__level'
      );

    expect(component.dashboardMaturityColor).toBeNull();

    expect(
      level.style.getPropertyValue('--maturity-color').trim()
    ).toBe('');
  });
  it('should reject invalid maturity colors', () => {
    component.variant = 'dashboard';
    component.maturity_color = 'invalid-color';

    fixture.detectChanges();

    const level: HTMLElement =
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__level'
      );

    expect(component.dashboardMaturityColor).toBeNull();

    expect(
      level.style.getPropertyValue('--maturity-color').trim()
    ).toBe('');
  });

  it('should render the institutional icon in the featured card', () => {
    component.variant = 'dashboard';
    component.featured = true;
    component.score = 9.5;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi__brand-icon'
      )
    ).not.toBeNull();
  });
  it('should preserve the default card when featured is enabled', () => {
    component.variant = 'default';
    component.featured = true;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-kpi--featured'
      )
    ).toBeNull();
  });
  [
    {
      letter: 'A',
      icon: 'bi bi-tree'
    },
    {
      letter: 'S',
      icon: 'bi bi-people'
    },
    {
      letter: 'G',
      icon: 'bi bi-bank'
    },
    {
      letter: 'X',
      icon: 'bi bi-bar-chart'
    }
  ].forEach(({ letter, icon }) => {

    it(`should render the appropriate icon for ${letter}`, () => {
      component.variant = 'dashboard';
      component.letter = letter;

      fixture.detectChanges();

      const symbol: HTMLElement =
        fixture.nativeElement.querySelector(
          '.dashboard-kpi__symbol i'
        );

      expect(component.dashboardIcon).toBe(icon);
      expect(symbol).not.toBeNull();
      expect(symbol.className).toBe(icon);
    });

  });
});
