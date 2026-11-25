import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  EvaluationAutosaveComponent,
  EvaluationAutosaveStatus
} from './evaluation-autosave.component';

describe('EvaluationAutosaveComponent', () => {
  let component: EvaluationAutosaveComponent;
  let fixture: ComponentFixture<EvaluationAutosaveComponent>;

  function setStatus(status: EvaluationAutosaveStatus): void {
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
  }

  function query<T extends HTMLElement = HTMLElement>(
    selector: string
  ): T | null {
    return fixture.nativeElement.querySelector(selector);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvaluationAutosaveComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EvaluationAutosaveComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('status', 'idle');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should hide the indicator when idle without unsaved responses', () => {
    expect(component.showIndicator()).toBeFalse();

    const status = query('.evaluation-autosave__status');

    expect(status).not.toBeNull();
    expect(status?.classList.contains('visually-hidden')).toBeTrue();

    expect(query('.evaluation-autosave__pill')).toBeNull();
  });

  it('should display a warning when idle with unsaved responses', () => {
    fixture.componentRef.setInput('hasUnsavedResponses', true);
    fixture.detectChanges();

    expect(component.showUnsavedWarning()).toBeTrue();
    expect(component.showIndicator()).toBeTrue();

    const pill = query('.evaluation-autosave__pill--warning');

    expect(pill?.textContent).toContain('Sin guardar');
  });

  it('should display the pending status', () => {
    setStatus('pending');

    const pill = query('.evaluation-autosave__pill--warning');

    expect(pill?.textContent).toContain('Pendiente');
  });

  it('should display the saving status and spinner', () => {
    setStatus('saving');

    const pill = query('.evaluation-autosave__pill--saving');

    expect(pill?.textContent).toContain('Guardando...');
    expect(pill?.querySelector('.spinner-border')).not.toBeNull();
  });

  it('should display the saved status', () => {
    setStatus('saved');

    const pill = query('.evaluation-autosave__pill--saved');

    expect(pill?.textContent).toContain('Guardado');
  });

  it('should display the error status', () => {
    setStatus('error');

    const pill = query('.evaluation-autosave__pill--error');

    expect(pill?.textContent).toContain('Error al guardar');
  });

  it('should expose an accessible live status region', () => {
    const status = query('.evaluation-autosave__status');

    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-atomic')).toBe('true');
  });

  it('should preserve the live region during status changes', () => {
    const initialRegion = query('.evaluation-autosave__status');

    setStatus('pending');

    expect(query('.evaluation-autosave__status')).toBe(initialRegion);

    setStatus('saving');

    expect(query('.evaluation-autosave__status')).toBe(initialRegion);

    setStatus('saved');

    expect(query('.evaluation-autosave__status')).toBe(initialRegion);
  });

  it('should not display a notice when idle without unsaved responses', () => {
    fixture.componentRef.setInput('presentation', 'notice');
    fixture.detectChanges();

    expect(component.showNotice()).toBeFalse();

    expect(query('.evaluation-autosave__notice')).toBeNull();
  });

  it('should display the unsaved responses notice', () => {
    fixture.componentRef.setInput('presentation', 'notice');
    fixture.componentRef.setInput('hasUnsavedResponses', true);
    fixture.detectChanges();

    const notice = query('.evaluation-autosave__notice--warning');

    expect(component.showNotice()).toBeTrue();

    expect(notice?.textContent)
      .toContain('Hay respuestas sin guardar');

    expect(notice?.textContent)
      .toContain('Los cambios pendientes podrían perderse al salir');

    expect(query('.evaluation-autosave__retry')).toBeNull();
  });

  it('should display an error notice with a retry button', () => {
    fixture.componentRef.setInput('presentation', 'notice');
    fixture.componentRef.setInput('canRetry', true);

    setStatus('error');

    const notice = query('.evaluation-autosave__notice--error');

    const retryButton = query<HTMLButtonElement>(
      '.evaluation-autosave__retry'
    );

    expect(notice?.textContent)
      .toContain('No se pudieron guardar las respuestas');

    expect(retryButton).not.toBeNull();
    expect(retryButton?.disabled).toBeFalse();
  });

  it('should disable retry when retry permission is unavailable', () => {
    fixture.componentRef.setInput('presentation', 'notice');
    fixture.componentRef.setInput('canRetry', false);

    setStatus('error');

    const retryButton = query<HTMLButtonElement>(
      '.evaluation-autosave__retry'
    );

    expect(retryButton).not.toBeNull();
    expect(retryButton?.disabled).toBeTrue();
  });

  it('should emit retry when the enabled retry button is clicked', () => {
    const retrySpy = jasmine.createSpy('retry');

    component.retry.subscribe(retrySpy);

    fixture.componentRef.setInput('presentation', 'notice');
    fixture.componentRef.setInput('canRetry', true);

    setStatus('error');

    const retryButton = query<HTMLButtonElement>(
      '.evaluation-autosave__retry'
    );

    expect(retryButton).not.toBeNull();

    retryButton?.click();

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('should not emit retry when retry permission is unavailable', () => {
    const retrySpy = jasmine.createSpy('retry');

    component.retry.subscribe(retrySpy);

    fixture.componentRef.setInput('canRetry', false);

    setStatus('error');

    component.requestRetry();

    expect(retrySpy).not.toHaveBeenCalled();
  });

  it('should not emit retry outside the error status', () => {
    const retrySpy = jasmine.createSpy('retry');

    component.retry.subscribe(retrySpy);

    fixture.componentRef.setInput('canRetry', true);

    const statuses: EvaluationAutosaveStatus[] = [
      'idle',
      'pending',
      'saving',
      'saved'
    ];

    for (const status of statuses) {
      setStatus(status);
      component.requestRetry();
    }

    expect(retrySpy).not.toHaveBeenCalled();
  });

  it('should remove the error notice after recovering successfully', () => {
    fixture.componentRef.setInput('presentation', 'notice');

    setStatus('error');

    expect(query('.evaluation-autosave__notice--error'))
      .not.toBeNull();

    setStatus('saved');

    expect(component.showNotice()).toBeFalse();

    expect(query('.evaluation-autosave__notice')).toBeNull();
    expect(query('.evaluation-autosave__retry')).toBeNull();
  });

  it('should not create a duplicate live region in notice mode', () => {
    fixture.componentRef.setInput('presentation', 'notice');

    setStatus('error');

    expect(query('[aria-live]')).toBeNull();
    expect(query('[role="status"]')).toBeNull();

    expect(query('.evaluation-autosave__notice--error'))
      .not.toBeNull();
  });
});