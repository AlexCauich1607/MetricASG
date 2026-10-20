import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { EvaluationComponent } from './evaluation.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationStructure } from '../../../models/evaluation_structure';

describe('EvaluationComponent', () => {
  let component: EvaluationComponent;
  let fixture: ComponentFixture<EvaluationComponent>;

  const evaluationStructure: EvaluationStructure = {
    ambits: [
      {
        id: 1,
        name: 'Ambiental',
        color: '#00AA00',
        letter: 'A',
        indicators: [
          {
            id: 1,
            question: 'Pregunta de prueba',
            answers: [
              {
                id: 1,
                maturity_level_id: 1,
                text: 'Respuesta de prueba'
              }
            ]
          }
        ]
      }
    ]
  };

  let saveDraftSpy: jasmine.Spy;
  let submitEvaluationSpy: jasmine.Spy;

  const evaluationServiceMock = {
    getEvaluation: () => of(evaluationStructure),
    saveDraft: (...args: unknown[]) => saveDraftSpy(...args),
    submitEvaluation: (...args: unknown[]) => submitEvaluationSpy(...args)
  };

  beforeEach(async () => {
    saveDraftSpy = jasmine.createSpy('saveDraft').and.returnValue(
      of({
        evaluation_id: 1,
        status: 'DRAFT'
      })
    );

    submitEvaluationSpy = jasmine.createSpy('submitEvaluation').and.returnValue(
      of({})
    );

    await TestBed.configureTestingModule({
      imports: [
        EvaluationComponent
      ],
      providers: [
        {
          provide: EvaluationService,
          useValue: evaluationServiceMock
        },
        provideRouter([])
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(EvaluationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should debounce draft saves after answer changes', (done) => {
    component.selectAnswer(1, 1, 1);

    expect(component.autosaveStatus()).toBe('pending');
    expect(saveDraftSpy).not.toHaveBeenCalled();

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      expect(saveDraftSpy).toHaveBeenCalledWith({
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 1
          }
        ]
      });

      expect(component.autosaveStatus()).toBe('saved');
      done();
    }, 950);
  });

  it('should save only the latest answer after rapid changes', (done) => {
    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      component.selectAnswer(1, 2, 1);

      expect(saveDraftSpy).not.toHaveBeenCalled();
      expect(component.autosaveStatus()).toBe('pending');
    }, 200);

    setTimeout(() => {
      expect(saveDraftSpy).not.toHaveBeenCalled();
    }, 850);

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      expect(saveDraftSpy).toHaveBeenCalledWith({
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 2
          }
        ]
      });

      expect(component.autosaveStatus()).toBe('saved');

      done();
    }, 1150);
  });

  it('should save pending changes after the active request completes', (done) => {
    const firstRequest = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValues(
      firstRequest.asObservable(),
      of({
        evaluation_id: 1,
        status: 'DRAFT'
      })
    );

    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);
      expect(component.autosaveStatus()).toBe('saving');

      component.selectAnswer(1, 2, 1);

      expect(component.autosaveStatus()).toBe('pending');
    }, 850);

    setTimeout(() => {
      // The first request is still active.
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      firstRequest.next({
        evaluation_id: 1,
        status: 'DRAFT'
      });
      firstRequest.complete();

      // The pending changes should now be saved.
      expect(saveDraftSpy).toHaveBeenCalledTimes(2);

      expect(saveDraftSpy.calls.mostRecent().args[0]).toEqual({
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 2
          }
        ]
      });

      expect(component.autosaveStatus()).toBe('saved');

      done();
    }, 1750);
  });

  it('should report an error when autosave fails', (done) => {
    saveDraftSpy.and.returnValue(
      throwError(() => new Error('Simulated network error'))
    );

    component.selectAnswer(1, 1, 1);

    expect(component.autosaveStatus()).toBe('pending');

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      expect(component.autosaveStatus()).toBe('error');

      expect(component.responses().get(1)).toBe(1);

      done();
    }, 950);
  });

  it('should retry a failed autosave', (done) => {
    saveDraftSpy.and.returnValues(
      throwError(() => new Error('Simulated network error')),
      of({
        evaluation_id: 1,
        status: 'DRAFT'
      })
    );

    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);
      expect(component.autosaveStatus()).toBe('error');

      component.retrySaveDraft();

      expect(saveDraftSpy).toHaveBeenCalledTimes(2);

      expect(saveDraftSpy.calls.mostRecent().args[0]).toEqual({
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 1
          }
        ]
      });

      expect(component.autosaveStatus()).toBe('saved');

      done();
    }, 950);
  });

  it('should wait for autosave before submitting the evaluation', (done) => {
    const firstRequest = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValue(firstRequest.asObservable());

    spyOn(window, 'confirm').and.returnValue(true);

    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      component.submit();

      expect(component.submitting()).toBeTrue();
      expect(submitEvaluationSpy).not.toHaveBeenCalled();

      firstRequest.next({
        evaluation_id: 1,
        status: 'DRAFT'
      });

      firstRequest.complete();

      expect(submitEvaluationSpy).toHaveBeenCalledTimes(1);

      expect(submitEvaluationSpy).toHaveBeenCalledWith({
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 1
          }
        ]
      });

      done();
    }, 950);
  });

  it('should prevent duplicate evaluation submissions', () => {
    const submitRequest = new Subject<unknown>();

    submitEvaluationSpy.and.returnValue(
      submitRequest.asObservable()
    );

    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    component.selectAnswer(1, 1, 1);

    component.submit();
    component.submit();
    component.submit();

    expect(confirmSpy).toHaveBeenCalledTimes(1);

    expect(submitEvaluationSpy).toHaveBeenCalledTimes(1);

    expect(component.submitting()).toBeTrue();

    expect(submitEvaluationSpy).toHaveBeenCalledWith({
      responses: [
        {
          indicator_id: 1,
          indicator_answer_id: 1
        }
      ]
    });

    submitRequest.complete();
  });

  it('should restore autosave when final submission fails', (done) => {
    spyOn(window, 'confirm').and.returnValue(true);

    submitEvaluationSpy.and.returnValue(
      throwError(() => new Error('Simulated submission error'))
    );

    component.selectAnswer(1, 1, 1);
    component.submit();

    expect(submitEvaluationSpy).toHaveBeenCalledTimes(1);
    expect(component.submitting()).toBeFalse();

    expect(component.responses().get(1)).toBe(1);
    expect(component.autosaveStatus()).toBe('pending');

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      expect(saveDraftSpy).toHaveBeenCalledWith({
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 1
          }
        ]
      });

      expect(component.autosaveStatus()).toBe('saved');

      done();
    }, 950);
  });

  it('should prevent leaving when unsaved changes exist', () => {
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(false);

    component.selectAnswer(1, 1, 1);

    const canLeave = component.canLeaveEvaluation();

    expect(canLeave).toBeFalse();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(component.autosaveStatus()).toBe('pending');
  });

  it('should allow leaving after autosave succeeds', (done) => {
    const confirmSpy = spyOn(window, 'confirm');

    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      expect(component.autosaveStatus()).toBe('saved');

      const canLeave = component.canLeaveEvaluation();

      expect(canLeave).toBeTrue();
      expect(confirmSpy).not.toHaveBeenCalled();

      done();
    }, 950);
  });
  it('should warn before unloading with unsaved changes', () => {
    component.selectAnswer(1, 1, 1);

    const event = new Event('beforeunload', {
      cancelable: true
    }) as BeforeUnloadEvent;

    component.onBeforeUnload(event);

    expect(event.defaultPrevented).toBeTrue();
  });

  it('should allow unloading after autosave succeeds', (done) => {
    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      expect(component.autosaveStatus()).toBe('saved');

      const event = new Event('beforeunload', {
        cancelable: true
      }) as BeforeUnloadEvent;

      component.onBeforeUnload(event);

      expect(event.defaultPrevented).toBeFalse();

      done();
    }, 950);
  });

  it('should not start another autosave after component destruction', (done) => {
    const firstRequest = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValue(firstRequest.asObservable());

    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      // El primer guardado sigue en curso.
      component.selectAnswer(1, 2, 1);

      // Simulamos la destrucción del componente.
      fixture.destroy();

      // La solicitud anterior termina después de destruirlo.
      firstRequest.next({
        evaluation_id: 1,
        status: 'DRAFT'
      });
      firstRequest.complete();

      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      done();
    }, 950);
  });
  it('should keep pending status when changes await debounce', (done) => {
    const firstRequest = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValues(
      firstRequest.asObservable(),
      of({
        evaluation_id: 1,
        status: 'DRAFT'
      })
    );

    component.selectAnswer(1, 1, 1);

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(1);

      component.selectAnswer(1, 2, 1);

      firstRequest.next({
        evaluation_id: 1,
        status: 'DRAFT'
      });
      firstRequest.complete();

      expect(saveDraftSpy).toHaveBeenCalledTimes(1);
      expect(component.autosaveStatus()).toBe('pending');
    }, 850);

    setTimeout(() => {
      expect(saveDraftSpy).toHaveBeenCalledTimes(2);

      expect(saveDraftSpy.calls.mostRecent().args[0]).toEqual({
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 2
          }
        ]
      });

      expect(component.autosaveStatus()).toBe('saved');

      done();
    }, 1750);
  });
});