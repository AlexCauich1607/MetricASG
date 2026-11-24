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
});
