import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { EvaluationComponent } from './evaluation.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationStructure } from '../../../models/evaluation_structure';
import { signal } from '@angular/core';
import { CompanyContextService } from '../../../services/company-context.service';
import { CompanyRole } from '../../../models/company_membership';

describe('EvaluationComponent', () => {
  let component: EvaluationComponent;
  let fixture: ComponentFixture<EvaluationComponent>;
  let selectedRole: ReturnType<typeof signal<CompanyRole | null>>;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;
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
  const multiAmbitStructure: EvaluationStructure = {
    ambits: [
      {
        id: 1,
        name: 'Ambiental',
        color: '#00AA00',
        letter: 'A',
        indicators: [
          {
            id: 1,
            question: 'Pregunta ambiental 1',
            answers: [
              {
                id: 1,
                maturity_level_id: 1,
                text: 'Respuesta inicial'
              },
              {
                id: 2,
                maturity_level_id: 2,
                text: 'Respuesta alternativa'
              }
            ]
          },
          {
            id: 2,
            question: 'Pregunta ambiental 2',
            answers: [
              {
                id: 3,
                maturity_level_id: 1,
                text: 'Respuesta ambiental'
              }
            ]
          }
        ]
      },
      {
        id: 2,
        name: 'Social',
        color: '#1565C0',
        letter: 'S',
        indicators: [
          {
            id: 3,
            question: 'Pregunta social 1',
            answers: [
              {
                id: 4,
                maturity_level_id: 1,
                text: 'Respuesta social'
              }
            ]
          }
        ]
      },
      {
        id: 3,
        name: 'Gobernanza',
        color: '#4823A4',
        letter: 'G',
        indicators: [
          {
            id: 4,
            question: 'Pregunta de gobernanza 1',
            answers: [
              {
                id: 5,
                maturity_level_id: 1,
                text: 'Respuesta de gobernanza'
              }
            ]
          }
        ]
      }
    ]
  };

  let getDraftSpy: jasmine.Spy;
  let saveDraftSpy: jasmine.Spy;
  let submitEvaluationSpy: jasmine.Spy;

  const evaluationServiceMock = {
    getEvaluation: () => of(evaluationStructure),
    getDraft: () => getDraftSpy(),
    saveDraft: (...args: unknown[]) => saveDraftSpy(...args),
    submitEvaluation: (...args: unknown[]) => submitEvaluationSpy(...args)
  };

  beforeEach(async () => {
    selectedRole = signal<CompanyRole | null>(
      CompanyRole.COMPANY_ADMIN
    );
    selectedCompanyId = signal<number | null>(3);
    getDraftSpy = jasmine.createSpy('getDraft').and.returnValue(
      of(null)
    );

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
        {
          provide: CompanyContextService,
          useValue: { selectedRole, selectedCompanyId }
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

  describe('Global evaluation progress', () => {

    it('should initialize global progress at zero', () => {
      expect(component.totalQuestions()).toBe(1);
      expect(component.answeredQuestions()).toBe(0);
      expect(component.globalProgress()).toBe(0);
    });

    it('should return zero progress when no structure exists', () => {
      component.structure.set(null);

      expect(component.totalQuestions()).toBe(0);
      expect(component.globalProgress()).toBe(0);
    });

    it('should return zero progress for an empty structure', () => {
      component.structure.set({ ambits: [] });

      expect(component.totalQuestions()).toBe(0);
      expect(component.answeredQuestions()).toBe(0);
      expect(component.globalProgress()).toBe(0);
    });

    it('should calculate progress across all ambits', fakeAsync(() => {
      component.structure.set(multiAmbitStructure);

      expect(component.totalQuestions()).toBe(4);
      expect(component.globalProgress()).toBe(0);

      component.selectAnswer(1, 1, 1);

      expect(component.answeredQuestions()).toBe(1);
      expect(component.globalProgress()).toBe(25);

      component.selectAnswer(2, 3, 1);

      expect(component.answeredQuestions()).toBe(2);
      expect(component.globalProgress()).toBe(50);

      component.ambit.set(1);
      component.question.set(0);
      component.selectAnswer(3, 4, 2);

      expect(component.answeredQuestions()).toBe(3);
      expect(component.globalProgress()).toBe(75);

      component.ambit.set(2);
      component.question.set(0);
      component.selectAnswer(4, 5, 3);

      expect(component.answeredQuestions()).toBe(4);
      expect(component.globalProgress()).toBe(100);

      tick(800);
    }));

    it('should not increase progress when an answer changes', fakeAsync(() => {
      component.structure.set(multiAmbitStructure);

      component.selectAnswer(1, 1, 1);

      expect(component.answeredQuestions()).toBe(1);
      expect(component.globalProgress()).toBe(25);

      component.selectAnswer(1, 2, 1);

      expect(component.responses().get(1)).toBe(2);
      expect(component.answeredQuestions()).toBe(1);
      expect(component.globalProgress()).toBe(25);

      tick(800);
    }));

    it('should preserve global progress when changing the current ambit', () => {
      component.structure.set(multiAmbitStructure);

      component.responses.set(new Map([
        [1, 1],
        [2, 3]
      ]));

      expect(component.globalProgress()).toBe(50);

      component.ambit.set(1);
      component.question.set(0);

      expect(component.globalProgress()).toBe(50);

      component.ambit.set(2);
      component.question.set(0);

      expect(component.globalProgress()).toBe(50);
    });

    it('should not round incomplete progress up to 100 percent', () => {
      const templateAmbit = multiAmbitStructure.ambits[0];
      const templateIndicator = templateAmbit.indicators[0];

      const indicators = Array.from(
        { length: 201 },
        (_, index) => ({
          ...templateIndicator,
          id: index + 1
        })
      );

      component.structure.set({
        ambits: [
          {
            ...templateAmbit,
            indicators
          }
        ]
      });

      component.responses.set(new Map(
        indicators.slice(0, 200).map(
          indicator => [indicator.id, 1]
        )
      ));

      expect(component.totalQuestions()).toBe(201);
      expect(component.answeredQuestions()).toBe(200);
      expect(component.globalProgress()).toBe(99);
    });

    it('should render the global progress accessibly', () => {
      component.structure.set(multiAmbitStructure);

      component.responses.set(new Map([
        [1, 1],
        [2, 3]
      ]));

      fixture.detectChanges();

      const progressbar: HTMLElement =
        fixture.nativeElement.querySelector(
          '.evaluation-progress__track'
        );

      expect(progressbar).toBeTruthy();
      expect(progressbar.getAttribute('role')).toBe('progressbar');
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0');
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100');
      expect(progressbar.getAttribute('aria-valuenow')).toBe('50');

      expect(progressbar.getAttribute('aria-valuetext'))
        .toBe('2 de 4 preguntas respondidas');
    });



  });

  describe('Responsive question presentation', () => {

    it('should initialize the global question number at one', () => {
      expect(component.currentQuestionNumber()).toBe(1);
    });

    it('should return zero when no current question exists', () => {
      component.structure.set(null);

      expect(component.currentQuestionNumber()).toBe(0);
    });

    it('should return zero for an invalid question index', () => {
      component.question.set(99);

      expect(component.currentQuestionNumber()).toBe(0);
    });

    it('should calculate the global question number across ambits', () => {
      component.structure.set(multiAmbitStructure);

      expect(component.currentQuestionNumber()).toBe(1);

      component.nextQuestion();

      expect(component.currentQuestionNumber()).toBe(2);

      component.nextQuestion();

      expect(component.ambit()).toBe(1);
      expect(component.question()).toBe(0);
      expect(component.currentQuestionNumber()).toBe(3);

      component.nextQuestion();

      expect(component.ambit()).toBe(2);
      expect(component.question()).toBe(0);
      expect(component.currentQuestionNumber()).toBe(4);
    });

    it('should update the global question number when navigating backwards', () => {
      component.structure.set(multiAmbitStructure);
      component.ambit.set(2);
      component.question.set(0);

      expect(component.currentQuestionNumber()).toBe(4);

      component.beforeQuestion();

      expect(component.currentQuestionNumber()).toBe(3);

      component.beforeQuestion();

      expect(component.currentQuestionNumber()).toBe(2);

      component.beforeQuestion();

      expect(component.currentQuestionNumber()).toBe(1);
    });

    it('should keep question position independent from answered progress', () => {
      component.structure.set(multiAmbitStructure);

      component.nextQuestion();
      component.nextQuestion();

      expect(component.currentQuestionNumber()).toBe(3);
      expect(component.answeredQuestions()).toBe(0);
      expect(component.globalProgress()).toBe(0);
    });
    it('should display the corresponding icon for each ambit', () => {
      component.structure.set(multiAmbitStructure);

      expect(component.currentAmbitIcon()).toBe('bi bi-tree');

      component.ambit.set(1);

      expect(component.currentAmbitIcon()).toBe('bi bi-people');

      component.ambit.set(2);

      expect(component.currentAmbitIcon()).toBe('bi bi-bank');
    });

    it('should normalize the ambit letter before selecting its icon', () => {
      component.structure.set({
        ambits: [
          {
            ...multiAmbitStructure.ambits[0],
            letter: ' a '
          }
        ]
      });

      expect(component.currentAmbitIcon()).toBe('bi bi-tree');
    });

    it('should use a fallback icon for unknown ambits', () => {
      component.structure.set({
        ambits: [
          {
            ...multiAmbitStructure.ambits[0],
            letter: 'X'
          }
        ]
      });

      expect(component.currentAmbitIcon()).toBe('bi bi-bar-chart');
    });

    it('should use a fallback icon when no ambit exists', () => {
      component.structure.set(null);

      expect(component.currentAmbitIcon()).toBe('bi bi-bar-chart');
    });
    it('should render the current question and its global position', () => {
      component.structure.set(multiAmbitStructure);
      component.ambit.set(1);
      component.question.set(0);

      fixture.detectChanges();

      const position: HTMLElement =
        fixture.nativeElement.querySelector(
          '.evaluation-question-header__position'
        );

      const title: HTMLElement =
        fixture.nativeElement.querySelector(
          '.evaluation-question-title'
        );

      expect(position.textContent?.replace(/\s+/g, ' ').trim())
        .toBe('Pregunta 3 de 4');

      expect(title.textContent?.trim())
        .toBe('Pregunta social 1');

      expect(title.tagName).toBe('H2');
    });

    it('should group native radio inputs accessibly', () => {
      component.structure.set(multiAmbitStructure);

      fixture.detectChanges();

      const fieldset: HTMLFieldSetElement =
        fixture.nativeElement.querySelector(
          '.evaluation-answers'
        );

      const radios = Array.from(
        fieldset.querySelectorAll<HTMLInputElement>(
          'input[type="radio"]'
        )
      );

      expect(fieldset.tagName).toBe('FIELDSET');

      expect(fieldset.getAttribute('aria-labelledby'))
        .toBe('evaluation-question-title');

      expect(fieldset.getAttribute('aria-describedby'))
        .toBe('evaluation-question-description');

      expect(radios.length).toBe(2);

      radios.forEach(radio => {
        expect(radio.name).toBe('indicator-1');
        expect(radio.closest('label')).not.toBeNull();
      });
    });
    it('should update the selected answer through the native radio input',
      fakeAsync(() => {

        component.structure.set(multiAmbitStructure);

        fixture.detectChanges();

        const radios: NodeListOf<HTMLInputElement> =
          fixture.nativeElement.querySelectorAll(
            '.evaluation-answer__radio'
          );

        radios[0].click();

        fixture.detectChanges();

        expect(component.responses().get(1)).toBe(1);
        expect(component.answeredQuestions()).toBe(1);

        expect(radios[0].checked).toBeTrue();

        expect(
          radios[0].closest('label')?.classList.contains(
            'evaluation-answer--selected'
          )
        ).toBeTrue();

        radios[1].click();

        fixture.detectChanges();

        expect(component.responses().get(1)).toBe(2);
        expect(component.answeredQuestions()).toBe(1);

        expect(radios[0].checked).toBeFalse();
        expect(radios[1].checked).toBeTrue();

        expect(
          radios[0].closest('label')?.classList.contains(
            'evaluation-answer--selected'
          )
        ).toBeFalse();

        expect(
          radios[1].closest('label')?.classList.contains(
            'evaluation-answer--selected'
          )
        ).toBeTrue();

        tick(800);
      })
    );
    it('should disable answer options for read-only roles', () => {
      component.structure.set(multiAmbitStructure);

      selectedRole.set(CompanyRole.AUDITOR);

      fixture.detectChanges();

      const radios: NodeListOf<HTMLInputElement> =
        fixture.nativeElement.querySelectorAll(
          '.evaluation-answer__radio'
        );

      expect(radios.length).toBe(2);

      radios.forEach(radio => {
        expect(radio.disabled).toBeTrue();

        expect(
          radio.closest('label')?.classList.contains(
            'evaluation-answer--disabled'
          )
        ).toBeTrue();
      });
    });

    it('should disable answers while an evidence operation is pending', () => {
      component.structure.set(multiAmbitStructure);

      component.onEvidenceOperationPending(true);

      fixture.detectChanges();

      const radios: NodeListOf<HTMLInputElement> =
        fixture.nativeElement.querySelectorAll(
          '.evaluation-answer__radio'
        );

      expect(radios.length).toBe(2);

      radios.forEach(radio => {
        expect(radio.disabled).toBeTrue();
      });

      component.onEvidenceOperationPending(false);

      fixture.detectChanges();

      radios.forEach(radio => {
        expect(radio.disabled).toBeFalse();
      });
    });

  });

  [
    {
      role: CompanyRole.COMPANY_ADMIN,
      canEdit: true,
      canSubmit: true
    },
    {
      role: CompanyRole.ASG_MANAGER,
      canEdit: true,
      canSubmit: true
    },
    {
      role: CompanyRole.COLLABORATOR,
      canEdit: true,
      canSubmit: false
    },
    {
      role: CompanyRole.AUDITOR,
      canEdit: false,
      canSubmit: false
    },
    {
      role: null,
      canEdit: false,
      canSubmit: false
    }
  ].forEach(({ role, canEdit, canSubmit }) => {
    it(`should apply evaluation permissions for role ${role ?? 'NONE'}`, () => {
      selectedRole.set(role);

      expect(component.canEditEvaluation()).toBe(canEdit);
      expect(component.canSubmitEvaluation()).toBe(canSubmit);
    });
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

  it('should save only the latest answer after rapid changes', fakeAsync(() => {
    component.selectAnswer(1, 1, 1);

    tick(200);

    component.selectAnswer(1, 2, 1);

    expect(saveDraftSpy).not.toHaveBeenCalled();
    expect(component.autosaveStatus()).toBe('pending');

    tick(650);

    expect(saveDraftSpy).not.toHaveBeenCalled();

    tick(150);

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
  }));

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
  it('should keep pending status when changes await debounce', fakeAsync(() => {
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

    tick(800);

    expect(saveDraftSpy).toHaveBeenCalledTimes(1);
    expect(component.autosaveStatus()).toBe('saving');

    component.selectAnswer(1, 2, 1);

    firstRequest.next({
      evaluation_id: 1,
      status: 'DRAFT'
    });
    firstRequest.complete();

    expect(saveDraftSpy).toHaveBeenCalledTimes(1);
    expect(component.autosaveStatus()).toBe('pending');

    tick(800);

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
  }));
  it('should restore saved draft responses and progress', () => {
    getDraftSpy.and.returnValue(
      of({
        evaluation_id: 1,
        status: 'draft',
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 1
          }
        ]
      })
    );

    component.loadSurvey();

    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBeFalse();

    expect(component.responses().get(1)).toBe(1);
    expect(component.completadas().get(1)).toBe(1);
    expect(component.progreso()).toBe(100);
    expect(component.answeredQuestions()).toBe(1);
    expect(component.globalProgress()).toBe(100);

    expect(component.autosaveStatus()).toBe('saved');

    expect(saveDraftSpy).not.toHaveBeenCalled();
  });
  it('should initialize an empty evaluation when no draft exists', () => {
    getDraftSpy.and.returnValue(of(null));

    component.loadSurvey();

    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBeFalse();

    expect(component.responses().size).toBe(0);
    expect(component.completadas().size).toBe(0);
    expect(component.progreso()).toBe(0);
    expect(component.answeredQuestions()).toBe(0);
    expect(component.globalProgress()).toBe(0);

    expect(component.autosaveStatus()).toBe('idle');

    expect(saveDraftSpy).not.toHaveBeenCalled();
  });
  it('should prevent changes when draft recovery fails', () => {
    getDraftSpy.and.returnValue(
      throwError(() => new Error('Simulated recovery error'))
    );

    component.loadSurvey();

    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBeTrue();

    expect(component.responses().size).toBe(0);
    expect(component.autosaveStatus()).toBe('idle');

    component.selectAnswer(1, 1, 1);

    expect(component.responses().size).toBe(0);
    expect(component.completadas().size).toBe(0);

    expect(saveDraftSpy).not.toHaveBeenCalled();
  });
  it('should retry draft recovery after a failed request', () => {
    getDraftSpy.and.returnValues(
      throwError(() => new Error('Simulated recovery error')),
      of({
        evaluation_id: 1,
        status: 'draft',
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 1
          }
        ]
      })
    );

    component.loadSurvey();

    expect(component.loadError()).toBeTrue();
    expect(component.responses().size).toBe(0);

    component.loadSurvey();

    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBeFalse();

    expect(component.responses().get(1)).toBe(1);
    expect(component.completadas().get(1)).toBe(1);
    expect(component.progreso()).toBe(100);
    expect(component.answeredQuestions()).toBe(1);
    expect(component.globalProgress()).toBe(100);

    expect(component.autosaveStatus()).toBe('saved');
    expect(saveDraftSpy).not.toHaveBeenCalled();
  });

  it('should ignore invalid draft responses', () => {
    getDraftSpy.and.returnValue(
      of({
        evaluation_id: 1,
        status: 'draft',
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 999
          },
          {
            indicator_id: 999,
            indicator_answer_id: 1
          }
        ]
      })
    );

    component.loadSurvey();

    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBeFalse();

    expect(component.responses().size).toBe(0);
    expect(component.completadas().size).toBe(0);
    expect(component.progreso()).toBe(0);
    expect(component.answeredQuestions()).toBe(0);
    expect(component.globalProgress()).toBe(0);

    expect(saveDraftSpy).not.toHaveBeenCalled();
  });


  it('should restore evaluation ID from an existing draft', () => {
    getDraftSpy.and.returnValue(
      of({
        evaluation_id: 25,
        status: 'DRAFT',
        responses: [
          {
            indicator_id: 1,
            indicator_answer_id: 1
          }
        ]
      })
    );

    component.loadSurvey();

    expect(component.evaluationId()).toBe(25);
    expect(component.responses().get(1)).toBe(1);
  });


  it('should store evaluation ID after saving a draft', fakeAsync(() => {
    saveDraftSpy.and.returnValue(
      of({
        evaluation_id: 30,
        status: 'DRAFT'
      })
    );

    component.selectAnswer(1, 1, 1);

    tick(800);

    expect(saveDraftSpy).toHaveBeenCalledTimes(1);
    expect(component.evaluationId()).toBe(30);
    expect(component.autosaveStatus()).toBe('saved');
  }));

  it('should not allow evidence editing without a saved answer', () => {
    expect(component.canEditCurrentEvidence()).toBeFalse();

    component.selectAnswer(1, 1, 1);

    expect(component.canEditCurrentEvidence()).toBeFalse();
    expect(component.autosaveStatus()).toBe('pending');
  });

  it('should allow evidence editing after the answer is saved', fakeAsync(() => {
    component.selectAnswer(1, 1, 1);

    expect(component.canEditCurrentEvidence()).toBeFalse();

    tick(800);

    expect(component.autosaveStatus()).toBe('saved');
    expect(component.savedResponses().get(1)).toBe(1);
    expect(component.canEditCurrentEvidence()).toBeTrue();
  }));

  it('should not allow evidence editing when autosave fails', fakeAsync(() => {
    saveDraftSpy.and.returnValue(
      throwError(() => new Error('Error al guardar'))
    );

    component.selectAnswer(1, 1, 1);

    tick(800);

    expect(component.autosaveStatus()).toBe('error');
    expect(component.savedResponses().has(1)).toBeFalse();
    expect(component.canEditCurrentEvidence()).toBeFalse();
  }));

  it('should prevent answer changes while an evidence operation is pending', () => {
    component.onEvidenceOperationPending(true);

    component.selectAnswer(1, 1, 1);

    expect(component.responses().has(1)).toBeFalse();
    expect(saveDraftSpy).not.toHaveBeenCalled();
  });

  it('should prevent evaluation submission while an evidence operation is pending', () => {
    component.onEvidenceOperationPending(true);

    component.submit();

    expect(submitEvaluationSpy).not.toHaveBeenCalled();
    expect(component.submitting()).toBeFalse();
  });

  it('should block navigation while an evidence operation is pending', () => {
    const initialAmbit = component.ambit();
    const initialQuestion = component.question();

    component.onEvidenceOperationPending(true);

    component.nextQuestion();
    component.beforeQuestion();

    expect(component.ambit()).toBe(initialAmbit);
    expect(component.question()).toBe(initialQuestion);

    component.onEvidenceOperationPending(false);

    expect(component.evidenceOperationPending()).toBeFalse();
  });

  it('should prevent auditors from selecting answers', () => {
    selectedRole.set(CompanyRole.AUDITOR);

    component.selectAnswer(1, 1, 1);

    expect(component.responses().size).toBe(0);
    expect(component.completadas().size).toBe(0);
    expect(component.autosaveStatus()).toBe('idle');

    expect(saveDraftSpy).not.toHaveBeenCalled();
  });

  it('should allow collaborators to select answers', () => {
    selectedRole.set(CompanyRole.COLLABORATOR);

    component.selectAnswer(1, 1, 1);

    expect(component.responses().get(1)).toBe(1);
    expect(component.completadas().get(1)).toBe(1);
    expect(component.autosaveStatus()).toBe('pending');
  });

  it('should not save a pending draft after losing edit permissions', fakeAsync(() => {
    // El usuario comienza como COLLABORATOR.
    selectedRole.set(CompanyRole.COLLABORATOR);

    component.selectAnswer(1, 1, 1);

    expect(component.autosaveStatus()).toBe('pending');
    expect(saveDraftSpy).not.toHaveBeenCalled();

    // Pierde permisos antes de completarse el debounce.
    selectedRole.set(CompanyRole.AUDITOR);

    tick(800);

    // No debe iniciarse ninguna solicitud de guardado.
    expect(saveDraftSpy).not.toHaveBeenCalled();
  }));

  it('should prevent collaborators from submitting evaluations', () => {
    selectedRole.set(CompanyRole.COLLABORATOR);

    // Simulamos una evaluación completamente respondida.
    component.responses.set(new Map([[1, 1]]));

    component.submit();

    expect(component.submitting()).toBeFalse();
    expect(submitEvaluationSpy).not.toHaveBeenCalled();
  });

  it('should prevent auditors from submitting evaluations', () => {
    selectedRole.set(CompanyRole.AUDITOR);

    component.responses.set(new Map([[1, 1]]));

    component.submit();

    expect(component.submitting()).toBeFalse();
    expect(submitEvaluationSpy).not.toHaveBeenCalled();
  });

  it('should prevent submitting without an active company role', () => {
    selectedRole.set(null);

    component.responses.set(new Map([[1, 1]]));

    component.submit();

    expect(component.submitting()).toBeFalse();
    expect(submitEvaluationSpy).not.toHaveBeenCalled();
  });

  it('should wait for a selected company before loading the survey', () => {
    // La inicialización del componente ya ocurrió en beforeEach().
    expect(getDraftSpy).toHaveBeenCalledTimes(1);

    // Reiniciamos el escenario con una empresa todavía no disponible.
    fixture.destroy();

    selectedCompanyId.set(null);
    getDraftSpy.calls.reset();

    fixture = TestBed.createComponent(EvaluationComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getDraftSpy).not.toHaveBeenCalled();
    expect(component.loading()).toBeTrue();

    // Las membresías terminan de cargarse.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getDraftSpy).toHaveBeenCalledTimes(1);
    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBeFalse();
  });

  it('should invalidate the evaluation after switching companies', () => {
    // La evaluación comienza en la empresa 3.
    expect(selectedCompanyId()).toBe(3);
    expect(component.loading()).toBeFalse();

    // El usuario responde una pregunta.
    component.selectAnswer(1, 1, 1);

    expect(component.responses().get(1)).toBe(1);
    expect(component.autosaveStatus()).toBe('pending');

    // El contexto empresarial cambia a la empresa 7.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // El formulario anterior debe quedar invalidado.
    expect(component.loadError()).toBeTrue();
    expect(component.loading()).toBeFalse();
    expect(component.structure()).toBeNull();
    expect(component.evaluationId()).toBeNull();

    expect(component.responses().size).toBe(0);
    expect(component.savedResponses().size).toBe(0);
    expect(component.completadas().size).toBe(0);
    expect(component.autosaveStatus()).toBe('idle');

    // No debe permitir nuevas respuestas.
    component.selectAnswer(1, 1, 1);

    expect(component.responses().size).toBe(0);

    // Volver a la empresa inicial no reactiva el formulario.
    selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.loadError()).toBeTrue();
    expect(component.structure()).toBeNull();
    expect(getDraftSpy).toHaveBeenCalledTimes(1);
  });

  it('should not save a pending draft after switching companies', fakeAsync(() => {
    // La evaluación comienza en la empresa 3.
    expect(selectedCompanyId()).toBe(3);

    component.selectAnswer(1, 1, 1);

    expect(component.autosaveStatus()).toBe('pending');
    expect(saveDraftSpy).not.toHaveBeenCalled();

    // Cambiar de empresa antes del guardado automático.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.loadError()).toBeTrue();
    expect(component.responses().size).toBe(0);

    // Completar el intervalo del debounce.
    tick(800);

    // No debe enviarse ninguna solicitud de guardado.
    expect(saveDraftSpy).not.toHaveBeenCalled();

    expect(component.autosaveStatus()).toBe('idle');
  }));

  it('should cancel an active draft save after switching companies', fakeAsync(() => {
    const pendingSave = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValue(pendingSave.asObservable());

    // Iniciar una evaluación en la empresa 3.
    component.selectAnswer(1, 1, 1);
    tick(800);

    expect(saveDraftSpy).toHaveBeenCalledTimes(1);
    expect(pendingSave.observed).toBeTrue();
    expect(component.autosaveStatus()).toBe('saving');

    // Cambiar a la empresa 7 mientras el guardado está pendiente.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La suscripción anterior debe cancelarse.
    expect(pendingSave.observed).toBeFalse();

    expect(component.loadError()).toBeTrue();
    expect(component.responses().size).toBe(0);
    expect(component.evaluationId()).toBeNull();

    // Simular una respuesta tardía del servidor.
    pendingSave.next({
      evaluation_id: 99,
      status: 'DRAFT'
    });

    // La respuesta no debe recuperar el formulario invalidado.
    expect(component.evaluationId()).toBeNull();
    expect(component.savedResponses().size).toBe(0);
    expect(component.autosaveStatus()).toBe('idle');
  }));

  it('should cancel pending draft loading after switching companies', () => {
    const pendingDraft = new Subject<
      ReturnType<typeof getDraftSpy> extends never ? never : any
    >();

    // Destruir el componente creado en beforeEach.
    fixture.destroy();

    // Preparar una carga de borrador que no termina inmediatamente.
    getDraftSpy.calls.reset();
    getDraftSpy.and.returnValue(pendingDraft.asObservable());

    fixture = TestBed.createComponent(EvaluationComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getDraftSpy).toHaveBeenCalledTimes(1);
    expect(pendingDraft.observed).toBeTrue();
    expect(component.loading()).toBeTrue();

    // Cambiar de empresa antes de recibir el borrador.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(pendingDraft.observed).toBeFalse();
    expect(component.loadError()).toBeTrue();
    expect(component.loading()).toBeFalse();

    // Una respuesta tardía no debe restaurar el formulario.
    pendingDraft.next({
      evaluation_id: 99,
      responses: [
        {
          indicator_id: 1,
          indicator_answer_id: 1
        }
      ]
    });

    pendingDraft.complete();

    expect(component.evaluationId()).toBeNull();
    expect(component.structure()).toBeNull();
    expect(component.responses().size).toBe(0);
    expect(component.savedResponses().size).toBe(0);
  });

  it('should cancel pending submission after switching companies', () => {
    const pendingSubmission = new Subject<any>();

    submitEvaluationSpy.and.returnValue(
      pendingSubmission.asObservable()
    );

    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    // Evaluación completa en la empresa 3.
    expect(selectedCompanyId()).toBe(3);

    component.responses.set(new Map([[1, 1]]));

    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);

    component.submit();

    expect(confirmSpy).toHaveBeenCalled();
    expect(submitEvaluationSpy).toHaveBeenCalledTimes(1);
    expect(pendingSubmission.observed).toBeTrue();
    expect(component.submitting()).toBeTrue();

    // Cambiar de empresa mientras el envío sigue pendiente.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(pendingSubmission.observed).toBeFalse();
    expect(component.loadError()).toBeTrue();
    expect(component.submitting()).toBeFalse();
    expect(component.responses().size).toBe(0);

    // Simular una respuesta tardía.
    pendingSubmission.next({});
    pendingSubmission.complete();

    // No debe navegar a resultados.
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(component.loadError()).toBeTrue();
  });

  it('should restrict evidence editing based on company role', () => {
    // Simular una respuesta guardada correctamente.
    component.evaluationId.set(10);
    component.responses.set(new Map([[1, 1]]));
    component.savedResponses.set(new Map([[1, 1]]));
    component.autosaveStatus.set('saved');

    // COMPANY_ADMIN puede editar evidencias.
    selectedRole.set(CompanyRole.COMPANY_ADMIN);
    expect(component.canEditCurrentEvidence()).toBeTrue();

    // ASG_MANAGER puede editar evidencias.
    selectedRole.set(CompanyRole.ASG_MANAGER);
    expect(component.canEditCurrentEvidence()).toBeTrue();

    // COLLABORATOR puede editar evidencias.
    selectedRole.set(CompanyRole.COLLABORATOR);
    expect(component.canEditCurrentEvidence()).toBeTrue();

    // AUDITOR no puede editar evidencias.
    selectedRole.set(CompanyRole.AUDITOR);
    expect(component.canEditCurrentEvidence()).toBeFalse();

    // Sin membresía activa tampoco puede editarlas.
    selectedRole.set(null);
    expect(component.canEditCurrentEvidence()).toBeFalse();
  });

  it('should not navigate after submission permissions are revoked', () => {
    const pendingSubmission = new Subject<any>();

    submitEvaluationSpy.and.returnValue(
      pendingSubmission.asObservable()
    );

    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    // El usuario tiene permisos para finalizar.
    selectedRole.set(CompanyRole.ASG_MANAGER);

    component.responses.set(new Map([[1, 1]]));

    spyOn(window, 'confirm').and.returnValue(true);

    component.submit();

    expect(submitEvaluationSpy).toHaveBeenCalledTimes(1);
    expect(pendingSubmission.observed).toBeTrue();
    expect(component.submitting()).toBeTrue();

    // El usuario pierde el permiso de finalización.
    selectedRole.set(CompanyRole.COLLABORATOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La operación anterior debe cancelarse.
    expect(pendingSubmission.observed).toBeFalse();
    expect(component.submitting()).toBeFalse();

    // Una respuesta tardía no debe provocar navegación.
    pendingSubmission.next({});
    pendingSubmission.complete();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('should cancel pending draft save when edit permissions are revoked', fakeAsync(() => {
    const pendingSave = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValue(pendingSave.asObservable());

    // El usuario comienza con permisos de edición.
    selectedRole.set(CompanyRole.COLLABORATOR);

    component.selectAnswer(1, 1, 1);
    tick(800);

    expect(saveDraftSpy).toHaveBeenCalledTimes(1);
    expect(pendingSave.observed).toBeTrue();
    expect(component.autosaveStatus()).toBe('saving');

    // El usuario pierde sus permisos de edición.
    selectedRole.set(CompanyRole.AUDITOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La solicitud anterior debe cancelarse.
    expect(pendingSave.observed).toBeFalse();

    // No debe permanecer en estado de guardado.
    expect(component.autosaveStatus()).not.toBe('saving');

    // Una respuesta tardía no debe modificar la evaluación.
    const evaluationIdBeforeResponse = component.evaluationId();
    const savedResponsesBeforeResponse =
      new Map(component.savedResponses());

    pendingSave.next({
      evaluation_id: 99,
      status: 'DRAFT'
    });

    pendingSave.complete();

    expect(component.evaluationId()).toBe(evaluationIdBeforeResponse);
    expect(component.savedResponses()).toEqual(savedResponsesBeforeResponse);
  }));

  it('should warn about unsaved responses after edit permissions are revoked', fakeAsync(() => {
    const pendingSave = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValue(pendingSave.asObservable());

    // El colaborador selecciona una respuesta.
    selectedRole.set(CompanyRole.COLLABORATOR);
    component.selectAnswer(1, 1, 1);

    // Comienza el guardado automático.
    tick(800);

    expect(pendingSave.observed).toBeTrue();

    // El usuario pierde permisos antes de guardar.
    selectedRole.set(CompanyRole.AUDITOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(pendingSave.observed).toBeFalse();

    // Hay respuestas locales que no están guardadas.
    expect(component.responses().get(1)).toBe(1);
    expect(component.savedResponses().has(1)).toBeFalse();

    // Simular que el usuario decide permanecer.
    const confirmSpy = spyOn(window, 'confirm')
      .and.returnValue(false);

    expect(component.canLeaveEvaluation()).toBeFalse();
    expect(confirmSpy).toHaveBeenCalled();
  }));

  it('should prevent unloading when responses remain unsaved after permissions are revoked', fakeAsync(() => {
    const pendingSave = new Subject<{
      evaluation_id: number;
      status: string;
    }>();

    saveDraftSpy.and.returnValue(pendingSave.asObservable());

    // El colaborador comienza a responder la evaluación.
    selectedRole.set(CompanyRole.COLLABORATOR);

    component.selectAnswer(1, 1, 1);
    tick(800);

    expect(pendingSave.observed).toBeTrue();

    // Pierde permisos mientras el guardado está pendiente.
    selectedRole.set(CompanyRole.AUDITOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(pendingSave.observed).toBeFalse();
    expect(component.autosaveStatus()).toBe('idle');

    // Simular el cierre o la recarga de la pestaña.
    const event = new Event('beforeunload', {
      cancelable: true
    }) as BeforeUnloadEvent;

    component.onBeforeUnload(event);

    // El navegador debe recibir la solicitud de advertencia.
    expect(event.defaultPrevented).toBeTrue();
  }));

  it('should prevent reloading an evaluation after switching companies', () => {
    // La evaluación comienza en la empresa 3.
    expect(selectedCompanyId()).toBe(3);
    expect(getDraftSpy).toHaveBeenCalledTimes(1);

    // Cambiar a otra empresa.
    selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.companyChanged).toBeTrue();
    expect(component.loadError()).toBeTrue();

    // Intentar recuperar nuevamente la evaluación.
    getDraftSpy.calls.reset();

    component.loadSurvey();

    // No debe consultar el borrador de la nueva empresa.
    expect(getDraftSpy).not.toHaveBeenCalled();

    // El formulario debe continuar bloqueado.
    expect(component.companyChanged).toBeTrue();
    expect(component.loadError()).toBeTrue();
    expect(component.structure()).toBeNull();
  });

  it('should display a warning when unsaved responses remain idle', () => {
    // Simular respuestas locales que todavía no se guardaron.
    component.responses.set(new Map([[1, 1]]));
    component.savedResponses.set(new Map());
    component.autosaveStatus.set('idle');

    fixture.detectChanges();

    let content: string = fixture.nativeElement.textContent;

    expect(component.hasUnsavedResponses()).toBeTrue();
    expect(content).toContain('Hay respuestas sin guardar');

    // Simular que las respuestas se guardaron correctamente.
    component.savedResponses.set(new Map([[1, 1]]));

    fixture.detectChanges();

    content = fixture.nativeElement.textContent;

    expect(component.hasUnsavedResponses()).toBeFalse();
    expect(content).not.toContain('Hay respuestas sin guardar');
  });

  it('should allow editing again after permissions are restored', fakeAsync(() => {
    // El usuario comienza con permisos de edición.
    selectedRole.set(CompanyRole.COLLABORATOR);

    component.selectAnswer(1, 1, 1);

    expect(component.responses().get(1)).toBe(1);
    expect(component.canEditEvaluation()).toBeTrue();

    // Pierde permisos de edición.
    selectedRole.set(CompanyRole.AUDITOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.canEditEvaluation()).toBeFalse();

    // Las respuestas locales deben conservarse.
    expect(component.responses().get(1)).toBe(1);

    // Recupera los permisos.
    selectedRole.set(CompanyRole.COLLABORATOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.canEditEvaluation()).toBeTrue();
    expect(component.responses().get(1)).toBe(1);

    // El usuario modifica su respuesta.
    component.selectAnswer(1, 2, 1);

    expect(component.responses().get(1)).toBe(2);
    expect(component.autosaveStatus()).toBe('pending');

    // Verificar que puede iniciar nuevamente el guardado.
    tick(800);

    expect(saveDraftSpy).toHaveBeenCalledTimes(1);
    expect(component.autosaveStatus()).toBe('saved');
  }));

  it('should preserve saved responses when edit permissions are revoked', () => {
    // Simular una respuesta guardada previamente.
    const saved = new Map([[1, 1]]);

    component.responses.set(new Map(saved));
    component.savedResponses.set(new Map(saved));
    component.autosaveStatus.set('saved');

    selectedRole.set(CompanyRole.COLLABORATOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.canEditEvaluation()).toBeTrue();

    // Revocar los permisos de edición.
    selectedRole.set(CompanyRole.AUDITOR);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // Los datos guardados deben conservarse.
    expect(component.responses().get(1)).toBe(1);
    expect(component.savedResponses().get(1)).toBe(1);

    // No existen cambios pendientes.
    expect(component.hasUnsavedResponses()).toBeFalse();
    expect(component.autosaveStatus()).toBe('saved');

    // El usuario ya no puede editar.
    expect(component.canEditEvaluation()).toBeFalse();
  });

});