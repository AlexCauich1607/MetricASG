import { Subject, debounceTime, forkJoin, takeUntil } from 'rxjs';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
  HostListener,
  DestroyRef,
  Injector,
  inject
} from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EvaluationService } from '../../../services/evaluation.service';
import {
  EvaluationAmbit,
  EvaluationIndicator,
  EvaluationStructure
} from '../../../models/evaluation_structure';
import { Router } from '@angular/router';
import { EvaluationSubmitPayload } from '../../../models/evaluation_submit';
import { EvaluationEvidencesComponent } from '../evaluation-evidences/evaluation-evidences.component';
import { CompanyContextService } from '../../../services/company-context.service';
import { CompanyRole } from '../../../models/company_membership';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [
    MatProgressSpinnerModule,
    EvaluationEvidencesComponent
  ],
  templateUrl: './evaluation.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './evaluation.component.scss'
})
export class EvaluationComponent {
  structure = signal<EvaluationStructure | null>(null);
  loading = signal(true);
  readonly loadError = signal(false);

  responses = signal<Map<number, number>>(new Map());
  readonly savedResponses = signal<Map<number, number>>(new Map());
  completadas = signal<Map<number, number>>(new Map());

  readonly autosaveStatus = signal<
    'idle' | 'pending' | 'saving' | 'saved' | 'error'
  >('idle');

  private readonly autosaveChanges$ = new Subject<void>();
  readonly submitting = signal(false);
  private finalizing = false;
  private evaluationSubmitted = false;
  private submitPending = false;
  private destroyed = false;
  private readonly destroy$ = new Subject<void>();
  readonly evaluationId = signal<number | null>(null);
  private savingDraft = false;
  private pendingDraft = false;
  private draftReady = false;
  private evaluationCompanyId: number | null = null;
  private companyContextInvalidated = false;
  readonly evidenceOperationPending = signal(false);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly companyInvalidated$ = new Subject<void>();
  private readonly submissionPermissionsRevoked$ = new Subject<void>();
  private readonly editPermissionsRevoked$ = new Subject<void>();
  ambit = signal(0);
  question = signal(0);

  readonly currentAmbit = computed<EvaluationAmbit | null>(() => {
    const structure = this.structure();
    return structure?.ambits[this.ambit()] ?? null;
  });

  readonly currentQuestion = computed<EvaluationIndicator | null>(() => {
    const ambit = this.currentAmbit();
    return ambit?.indicators[this.question()] ?? null;
  });

  readonly progreso = computed(() => {
    const ambit = this.currentAmbit();

    if (!ambit) {
      return 0;
    }

    const completadas = this.completadas().get(ambit.id) ?? 0;
    const total = ambit.indicators.length;

    if (total === 0) {
      return 0;
    }

    return Math.round(completadas * (100 / total));
  });


  readonly canEditCurrentEvidence = computed(() => {
    const indicator = this.currentQuestion();

    if (
      !this.canEditEvaluation() ||
      !this.hasValidCompanyContext() ||
      this.loadError() ||
      !indicator ||
      this.evaluationId() === null
    ) {
      return false;
    }

    const selectedAnswer = this.responses().get(indicator.id);
    const savedAnswer = this.savedResponses().get(indicator.id);

    return (
      selectedAnswer !== undefined &&
      selectedAnswer === savedAnswer &&
      this.autosaveStatus() === 'saved' &&
      !this.submitting()
    );
  });


  readonly totalQuestions = computed(() => {
    const structure = this.structure();

    if (!structure) {
      return 0;
    }

    return structure.ambits.reduce(
      (total, ambit) => total + ambit.indicators.length,
      0
    );
  });


  readonly canEditEvaluation = computed(() => {
    const role = this.companyContext.selectedRole();

    return (
      role === CompanyRole.COMPANY_ADMIN ||
      role === CompanyRole.ASG_MANAGER ||
      role === CompanyRole.COLLABORATOR
    );
  });

  readonly canSubmitEvaluation = computed(() => {
    const role = this.companyContext.selectedRole();

    return (
      role === CompanyRole.COMPANY_ADMIN ||
      role === CompanyRole.ASG_MANAGER
    );
  });


  fondo = '#6d2828ff';

  mesActual = '';
  anioActual = '';
  mesFuturo = '';
  anioFuturo = '';



  constructor(
    private evaluationService: EvaluationService,
    private router: Router,
    private companyContext: CompanyContextService
  ) { }

  get companyChanged(): boolean {
    return this.companyContextInvalidated;
  }
  ngOnInit(): void {
    this.getPeriodo();

    this.autosaveChanges$
      .pipe(
        debounceTime(800),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.draftReady = true;
        this.saveDraft();
      });

    toObservable(this.companyContext.selectedCompanyId, {
      injector: this.injector
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(companyId => {
        if (this.companyContextInvalidated) {
          return;
        }

        // Esperar hasta que exista una empresa seleccionada.
        if (this.evaluationCompanyId === null) {
          if (companyId === null) {
            return;
          }

          this.evaluationCompanyId = companyId;
          this.loadSurvey();
          return;
        }

        // La evaluación pertenece a otra empresa.
        if (companyId !== this.evaluationCompanyId) {
          this.companyContextInvalidated = true;
          this.companyInvalidated$.next();

          this.loadError.set(true);
          this.loading.set(false);

          this.responses.set(new Map());
          this.savedResponses.set(new Map());
          this.completadas.set(new Map());

          this.structure.set(null);
          this.evaluationId.set(null);

          this.pendingDraft = false;
          this.draftReady = false;

          this.autosaveStatus.set('idle');

          this.submitting.set(false);
          this.finalizing = false;
          this.submitPending = false;
        }
      });


    toObservable(this.companyContext.selectedRole, {
      injector: this.injector
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Cancelar la finalización si se pierde ese permiso.
        if (
          this.finalizing &&
          !this.canSubmitEvaluation()
        ) {
          this.submissionPermissionsRevoked$.next();

          this.finalizing = false;
          this.submitPending = false;
          this.submitting.set(false);
        }

        // Cancelar el guardado cuando se pierden
        // los permisos de edición.
        if (!this.canEditEvaluation()) {
          this.editPermissionsRevoked$.next();

          this.savingDraft = false;
          this.pendingDraft = false;
          this.draftReady = false;

          if (this.autosaveStatus() === 'saving' ||
            this.autosaveStatus() === 'pending') {
            this.autosaveStatus.set('idle');
          }
        }
      });
  }

  private hasValidCompanyContext(): boolean {
    return (
      !this.companyContextInvalidated &&
      this.evaluationCompanyId !== null &&
      this.companyContext.selectedCompanyId() ===
      this.evaluationCompanyId
    );
  }

  public hasUnsavedResponses(): boolean {
    const current = this.responses();
    const saved = this.savedResponses();

    if (current.size !== saved.size) {
      return true;
    }

    for (const [indicatorId, answerId] of current) {
      if (saved.get(indicatorId) !== answerId) {
        return true;
      }
    }

    return false;
  }


  ngOnDestroy(): void {
    this.destroyed = true;
    this.companyInvalidated$.complete();
    this.destroy$.next();
    this.destroy$.complete();
    this.autosaveChanges$.complete();
    this.submissionPermissionsRevoked$.complete();
    this.editPermissionsRevoked$.complete();
  }

  onEvidenceOperationPending(pending: boolean): void {
    this.evidenceOperationPending.set(pending);
  }


  private saveDraft(): void {
    if (
      !this.hasValidCompanyContext() ||
      !this.canEditEvaluation() ||
      this.finalizing ||
      this.savingDraft ||
      !this.pendingDraft ||
      !this.draftReady
    ) {
      return;
    }

    this.savingDraft = true;
    this.pendingDraft = false;
    this.draftReady = false;
    this.autosaveStatus.set('saving');

    const payload: EvaluationSubmitPayload = {
      responses: Array.from(this.responses().entries()).map(
        ([indicator_id, indicator_answer_id]) => ({
          indicator_id,
          indicator_answer_id
        })
      )
    };
    const submittedResponses = new Map(this.responses());


    this.evaluationService.saveDraft(payload)
      .pipe(
        takeUntil(this.editPermissionsRevoked$),
        takeUntil(this.companyInvalidated$),
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: (result) => {
          this.evaluationId.set(result.evaluation_id);
          this.savedResponses.set(submittedResponses);
          if (this.destroyed) {
            return;
          }

          this.savingDraft = false;


          if (this.finalizing) {
            this.submitFinalEvaluation();
            return;
          }

          if (this.pendingDraft) {
            this.autosaveStatus.set('pending');
            this.saveDraft();
          } else {
            this.autosaveStatus.set('saved');
          }
        },
        error: () => {
          if (this.destroyed) {
            return;
          }

          this.savingDraft = false;

          this.pendingDraft = true;
          this.autosaveStatus.set('error');

          if (this.finalizing) {
            this.submitFinalEvaluation();
          }
        }
      });
  }

  retrySaveDraft(): void {
    if (this.autosaveStatus() !== 'error') {
      return;
    }

    this.pendingDraft = true;
    this.draftReady = true;

    this.saveDraft();
  }


  private submitFinalEvaluation(): void {
    if (
      !this.hasValidCompanyContext() ||
      !this.canSubmitEvaluation() ||
      !this.finalizing ||
      !this.submitPending ||
      this.savingDraft
    ) {
      return;
    }


    this.submitPending = false;

    const payload: EvaluationSubmitPayload = {
      responses: Array.from(this.responses().entries()).map(
        ([indicator_id, indicator_answer_id]) => ({
          indicator_id,
          indicator_answer_id
        })
      )
    };


    this.evaluationService.submitEvaluation(payload)
      .pipe(
        takeUntil(this.submissionPermissionsRevoked$),
        takeUntil(this.companyInvalidated$),
        takeUntil(this.destroy$)
      )
      .subscribe({

        next: () => {
          this.evaluationSubmitted = true;
          this.router.navigate(['/user/results']);
        },
        error: () => {
          this.finalizing = false;
          this.submitting.set(false);

          this.pendingDraft = true;
          this.draftReady = false;
          this.autosaveStatus.set('pending');
          this.autosaveChanges$.next();
        }
      });
  }

  canLeaveEvaluation(): boolean {
    if (this.evaluationSubmitted) {
      return true;
    }

    if (this.finalizing) {
      return false;
    }

    const status = this.autosaveStatus();


    if (
      this.hasUnsavedResponses() ||
      status === 'pending' ||
      status === 'saving' ||
      status === 'error'
    ) {

      return confirm(
        'Hay respuestas que todavía no se han guardado. ' +
        '¿Desea abandonar la evaluación?'
      );
    }

    return true;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    const status = this.autosaveStatus();


    if (
      !this.evaluationSubmitted &&
      (
        this.finalizing ||
        this.hasUnsavedResponses() ||
        status === 'pending' ||
        status === 'saving' ||
        status === 'error'
      )
    ) {

      event.preventDefault();
      event.returnValue = '';
    }
  }
  nextQuestion(): void {
    if (this.evidenceOperationPending()) {
      return;
    }
    const currentAmbit = this.currentAmbit();
    const structure = this.structure();

    if (!currentAmbit || !structure) {
      return;
    }

    if (this.question() + 1 < currentAmbit.indicators.length) {
      this.question.update(value => value + 1);
    } else if (this.ambit() < structure.ambits.length - 1) {
      this.ambit.update(value => value + 1);
      this.question.set(0);
    }
  }

  capitalizar(texto: string): string {
    if (!texto) {
      return texto;
    }

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  getPeriodo(): void {
    const hoy = new Date();

    this.mesActual = hoy.toLocaleString('es-ES', {
      month: 'long'
    });

    this.mesActual = this.capitalizar(this.mesActual);

    this.anioActual = hoy.toLocaleString('es-ES', {
      year: 'numeric'
    });

    const futura = new Date(hoy);

    futura.setMonth(hoy.getMonth() - 5);

    this.mesFuturo = futura.toLocaleString('es-ES', {
      month: 'long'
    });

    this.mesFuturo = this.capitalizar(this.mesFuturo);

    this.anioFuturo = futura.toLocaleString('es-ES', {
      year: 'numeric'
    });
  }

  beforeQuestion(): void {
    if (this.evidenceOperationPending()) {
      return;
    }
    const currentAmbit = this.currentAmbit();

    if (!currentAmbit) {
      return;
    }

    if (this.question() - 1 >= 0) {
      this.question.update(value => value - 1);
    } else if (this.ambit() > 0) {
      this.ambit.update(value => value - 1);

      const previousAmbit = this.currentAmbit();

      if (previousAmbit) {
        this.question.set(previousAmbit.indicators.length - 1);
      }
    }
  }

  loadSurvey(): void {
    if (this.companyContextInvalidated) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);

    forkJoin({
      structure: this.evaluationService.getEvaluation(),
      draft: this.evaluationService.getDraft()
    }).pipe(
      takeUntil(this.companyInvalidated$),
      takeUntil(this.destroy$)
    ).subscribe({
      next: ({ structure, draft }) => {
        this.evaluationId.set(draft?.evaluation_id ?? null);
        this.structure.set(structure);

        const validIndicators = new Map<number, {
          ambitId: number;
          answerIds: Set<number>;
        }>();

        for (const ambit of structure.ambits) {
          for (const indicator of ambit.indicators) {
            validIndicators.set(indicator.id, {
              ambitId: ambit.id,
              answerIds: new Set(
                indicator.answers.map(answer => answer.id)
              )
            });
          }
        }

        const restoredResponses = new Map<number, number>();
        const restoredCompletadas = new Map<number, number>();

        for (const response of draft?.responses ?? []) {
          const indicator = validIndicators.get(response.indicator_id);

          if (
            !indicator ||
            !indicator.answerIds.has(response.indicator_answer_id) ||
            restoredResponses.has(response.indicator_id)
          ) {
            continue;
          }

          restoredResponses.set(
            response.indicator_id,
            response.indicator_answer_id
          );

          restoredCompletadas.set(
            indicator.ambitId,
            (restoredCompletadas.get(indicator.ambitId) ?? 0) + 1
          );
        }

        this.responses.set(restoredResponses);
        this.savedResponses.set(new Map(restoredResponses));
        this.completadas.set(restoredCompletadas);

        this.autosaveStatus.set(draft ? 'saved' : 'idle');
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }

  selectAnswer(
    indicatorId: number,
    answerId: number,
    ambitId: number
  ): void {
    if (
      !this.canEditEvaluation() ||
      this.finalizing ||
      this.loading() ||
      this.loadError() ||
      this.evidenceOperationPending()
    ) {
      return;
    }

    const currentResponses = this.responses();

    if (currentResponses.get(indicatorId) === answerId) {
      return;
    }

    const isNewAnswer = !currentResponses.has(indicatorId);

    const updatedResponses = new Map(currentResponses);
    updatedResponses.set(indicatorId, answerId);
    this.responses.set(updatedResponses);

    if (isNewAnswer) {
      const updatedCompletadas = new Map(this.completadas());
      const valor = updatedCompletadas.get(ambitId) ?? 0;

      updatedCompletadas.set(ambitId, valor + 1);
      this.completadas.set(updatedCompletadas);
    }

    this.pendingDraft = true;
    this.draftReady = false;
    this.autosaveStatus.set('pending');
    this.autosaveChanges$.next();
  }

  submit(): void {
    if (
      !this.canSubmitEvaluation() ||
      this.finalizing ||
      this.submitting() ||
      this.loading() ||
      this.loadError()
    ) {
      return;
    }

    if (this.responses().size !== this.totalQuestions()) {
      alert('Tiene preguntas sin responder');
      return;
    }

    if (!confirm('¿Desea enviar esta evaluación?')) {
      return;
    }

    this.finalizing = true;
    this.submitting.set(true);
    this.submitPending = true;

    this.submitFinalEvaluation();
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } {
    hex = hex.replace(/^#/, '');

    if (!/^[0-9A-F]{3}$|^[0-9A-F]{6}$/i.test(hex)) {
      throw new Error(
        'Formato HEX inválido. Use formato #RGB o #RRGGBB'
      );
    }

    let r: number;
    let g: number;
    let b: number;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }

    return { r, g, b };
  }

  hexToRgbString(hex: string): string {
    hex = hex.replace('#', '');

    if (hex.length === 3) {
      hex =
        hex[0] +
        hex[0] +
        hex[1] +
        hex[1] +
        hex[2] +
        hex[2];
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `${r}, ${g}, ${b}`;
  }
}