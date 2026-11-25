import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import { EvaluationSkeletonComponent } from
  './evaluation-skeleton.component';

describe('EvaluationSkeletonComponent', () => {
  let component: EvaluationSkeletonComponent;
  let fixture: ComponentFixture<EvaluationSkeletonComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvaluationSkeletonComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(
      EvaluationSkeletonComponent
    );

    component = fixture.componentInstance;
    element = fixture.nativeElement;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the global progress placeholder', () => {
    expect(
      element.querySelector('.evaluation-skeleton-progress')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--percentage')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--progress-track')
    ).not.toBeNull();
  });

  it('should display the question card placeholder', () => {
    expect(
      element.querySelector('.evaluation-skeleton-question')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--question-title')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--question-description')
    ).not.toBeNull();
  });

  it('should display the ambit and question position placeholders', () => {
    expect(
      element.querySelector('.skeleton--ambit-icon')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--ambit-name')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--question-position')
    ).not.toBeNull();
  });

  it('should display three answer placeholders', () => {
    expect(
      element.querySelectorAll('.evaluation-skeleton-answer')
        .length
    ).toBe(3);

    expect(
      element.querySelectorAll('.skeleton--radio')
        .length
    ).toBe(3);
  });

  it('should display the evidence section placeholder', () => {
    expect(
      element.querySelector('.evaluation-skeleton-evidences')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--evidence-title')
    ).not.toBeNull();

    expect(
      element.querySelector('.skeleton--evidence-toggle')
    ).not.toBeNull();
  });

  it('should display two navigation placeholders', () => {
    expect(
      element.querySelectorAll(
        '.evaluation-skeleton-navigation .skeleton--button'
      ).length
    ).toBe(2);
  });

  it('should expose an accessible loading message', () => {
    const status = element.querySelector('[role="status"]');

    expect(status).not.toBeNull();

    expect(status?.textContent)
      .toContain('Cargando evaluación ASG');

    expect(status?.getAttribute('aria-live'))
      .toBe('polite');

    expect(status?.getAttribute('aria-atomic'))
      .toBe('true');

    expect(status?.closest('[aria-hidden="true"]'))
      .toBeNull();
  });

  it('should hide decorative placeholders from assistive technology', () => {
    const layout = element.querySelector(
      '.evaluation-skeleton-layout'
    );

    expect(layout).not.toBeNull();

    expect(layout?.getAttribute('aria-hidden'))
      .toBe('true');

    const placeholders = Array.from(
      element.querySelectorAll('.skeleton')
    );

    expect(placeholders.length).toBeGreaterThan(0);

    expect(
      placeholders.every(placeholder =>
        placeholder.closest('[aria-hidden="true"]') !== null
      )
    ).toBeTrue();
  });

  it('should not expose interactive or focusable controls', () => {
    expect(
      element.querySelectorAll(
        'button, a[href], input, select, textarea, ' +
        '[tabindex], [contenteditable="true"]'
      ).length
    ).toBe(0);
  });

});