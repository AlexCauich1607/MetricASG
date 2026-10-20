import { Subject, debounceTime, takeUntil } from 'rxjs';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  signal,
  HostListener
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

@Component({
  selector: 'app-evaluation',
  standalone: true,
  imports: [
    MatProgressSpinnerModule
  ],
  templateUrl: './evaluation.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './evaluation.component.scss'
})
export class EvaluationComponent {
  structure = signal<EvaluationStructure | null>(null);
  loading = signal(true);

  responses = signal<Map<number, number>>(new Map());
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

  private savingDraft = false;
  private pendingDraft = false;
  private draftReady = false;

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

  fondo = '#6d2828ff';

  mesActual = '';
  anioActual = '';
  mesFuturo = '';
  anioFuturo = '';



  constructor(
    private evaluationService: EvaluationService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadSurvey();
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
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    this.destroy$.next();
    this.destroy$.complete();
    this.autosaveChanges$.complete();
  }

  private saveDraft(): void {
    if (
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

    this.evaluationService.saveDraft(payload).subscribe({
      next: () => {
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
    if (!this.finalizing || !this.submitPending || this.savingDraft) {
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

    this.evaluationService.submitEvaluation(payload).subscribe({
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
    this.evaluationService.getEvaluation().subscribe({
      next: res => {
        this.structure.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  selectAnswer(
    indicatorId: number,
    answerId: number,
    ambitId: number
  ): void {
    if (this.finalizing) {
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
    if (this.finalizing || this.submitting()) {
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