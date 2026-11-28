
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import {
  ResultsSkeletonComponent
} from './results-skeleton.component';

describe('ResultsSkeletonComponent', () => {

  let component: ResultsSkeletonComponent;

  let fixture:
    ComponentFixture<ResultsSkeletonComponent>;

  let element: HTMLElement;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [ResultsSkeletonComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(
      ResultsSkeletonComponent
    );

    component = fixture.componentInstance;
    element = fixture.nativeElement;

    fixture.detectChanges();

  });

  it('should create', () => {

    expect(component).toBeTruthy();

  });

  it('should expose an accessible loading status', () => {

    const status = element.querySelector(
      '[role="status"]'
    );

    expect(status).not.toBeNull();

    expect(status?.textContent).toContain(
      'Cargando resultados de tu evaluación'
    );

  });

  it('should hide decorative placeholders from assistive technologies', () => {

    const content = element.querySelector(
      '.results-loading__content'
    );

    expect(content).not.toBeNull();

    expect(
      content?.getAttribute('aria-hidden')
    ).toBe('true');

  });

  it('should render the company context placeholder', () => {

    expect(
      element.querySelector('.sk-company')
    ).not.toBeNull();

    expect(
      element.querySelector('.sk-period')
    ).not.toBeNull();

    expect(
      element.querySelector('.sk-company-action')
    ).not.toBeNull();

  });

  it('should render four ASG performance cards', () => {

    expect(
      element.querySelectorAll(
        '.sk-performance-grid .sk-card'
      ).length
    ).toBe(4);

  });

  it('should render a single featured global ASG card', () => {

    expect(
      element.querySelectorAll(
        '.sk-card--featured'
      ).length
    ).toBe(1);

  });

  it('should render bar and radar chart placeholders', () => {

    expect(
      element.querySelectorAll('.sk-chart')
        .length
    ).toBe(2);

    expect(
      element.querySelectorAll('.sk-chart-figure')
        .length
    ).toBe(2);

  });

  it('should render two performance summary placeholders', () => {

    expect(
      element.querySelectorAll(
        '.sk-summary-grid .sk-row'
      ).length
    ).toBe(2);

  });

  it('should render the AI assistant placeholder', () => {

    expect(
      element.querySelector('.sk-ai')
    ).not.toBeNull();

    expect(
      element.querySelector('.sk-ai__disclaimer')
    ).not.toBeNull();

  });

  it('should render the evidence placeholder', () => {

    expect(
      element.querySelector('.sk-evidences')
    ).not.toBeNull();

  });

  it('should render two next step placeholders', () => {

    expect(
      element.querySelectorAll('.sk-next-card')
        .length
    ).toBe(2);

  });

  it('should not expose interactive elements during loading', () => {

    expect(
      element.querySelectorAll(
        'button, a, input, select, textarea, ' +
        '[tabindex]:not([tabindex="-1"])'
      ).length
    ).toBe(0);

  });

  it('should not instantiate real results components', () => {

    expect(
      element.querySelectorAll(
        'app-ambit-card, ' +
        'app-bar-chart, ' +
        'app-radar-chart, ' +
        'app-results-ai, ' +
        'app-results-evidences'
      ).length
    ).toBe(0);

  });

});
