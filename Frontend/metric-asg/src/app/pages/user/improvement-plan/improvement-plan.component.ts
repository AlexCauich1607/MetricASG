import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2,
  inject,
  DestroyRef
} from '@angular/core';
import {
  ActivatedRoute,
  Router
} from '@angular/router';
import { ImprovementActionService } from '../../../services/improvement-action.service';
import {
  ImprovementAction,
  ImprovementActionCreate,
  ImprovementActionUpdate,
  ImprovementPriority,
  ImprovementStatus
} from '../../../models/improvement_action';
import { DOCUMENT } from '@angular/common';
import { ImprovementProgress } from '../../../models/improvement_progress';
import { AdvancedExportService } from '../../../services/advanced-export.service';

import {
  Subject,
  take,
  takeUntil,
  distinctUntilChanged
} from 'rxjs';

import {
  toObservable,
  takeUntilDestroyed
} from '@angular/core/rxjs-interop';

import { CompanyContextService } from
  '../../../services/company-context.service';

import { EvaluationService } from
  '../../../services/evaluation.service';

import { PlanProgressComponent } from './plan-progress/plan-progress.component';
import { PlanActionCardComponent } from './plan-action-card/plan-action-card.component';
import { PlanActionModalComponent } from './plan-action-modal/plan-action-modal.component';

@Component({
  selector: 'app-improvement-plan',
  standalone: true,
  imports: [PlanProgressComponent, PlanActionCardComponent, PlanActionModalComponent],
  templateUrl: './improvement-plan.component.html',
  styleUrl: './improvement-plan.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class ImprovementPlanComponent implements OnInit, OnDestroy {
  evaluationId: number | null = null;
  actions: ImprovementAction[] = [];

  loading = false;
  errorMessage: string | null = null;
  showCreateForm = false;
  saving = false;
  formError: string | null = null;
  editingActionId: number | null = null;
  updating = false;
  editError: string | null = null;
  deletingActionId: number | null = null;
  confirmDeleteActionId: number | null = null;
  deleteError: string | null = null;
  editAction: ImprovementActionUpdate = {};
  activeModal: 'create' | 'edit' | null = null;
  newAction: ImprovementActionCreate = {
    indicator_id: null,
    gap_description: '',
    description: '',
    priority: 'MEDIUM',
    responsible: '',
    target_date: ''
  };
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private previousBodyOverflow: string | null = null;

  private readonly companyContext =
    inject(CompanyContextService);

  private readonly router = inject(Router);

  private readonly destroyRef = inject(DestroyRef);

  private readonly companyChanges$ =
    toObservable(this.companyContext.selectedCompanyId);

  private readonly contextReset$ =
    new Subject<void>();

  private activeCompanyId: number | null = null;

  private contextInvalidated = false;

  private readonly evaluationService =
    inject(EvaluationService);

  private requestedEvaluationId: number | null = null;

  private validatedEvaluationId: number | null = null;

  validatingEvaluation = false;

  evaluationValidationError = false;

  progress: ImprovementProgress | null = null;
  loadingProgress = false;
  progressError: string | null = null;

  exportError: string | null = null;


  private get hasValidContext(): boolean {

    return (

      !this.contextInvalidated &&

      !this.validatingEvaluation &&

      this.activeCompanyId !== null &&

      this.companyContext.selectedCompanyId() ===
      this.activeCompanyId &&

      this.evaluationId !== null &&

      this.validatedEvaluationId ===
      this.evaluationId

    );

  }


  private resetPlanContext(): void {

    this.contextReset$.next();
    this.requestedEvaluationId = null;
    this.validatedEvaluationId = null;
    this.validatingEvaluation = false;
    this.evaluationValidationError = false;

    this.evaluationId = null;
    this.actions = [];

    this.loading = false;
    this.errorMessage = null;
    this.exportError = null;

    this.progress = null;
    this.loadingProgress = false;
    this.progressError = null;

    // Formulario de creación.

    this.showCreateForm = false;
    this.saving = false;
    this.formError = null;

    this.resetCreateForm();

    // Formulario de edición.

    this.editingActionId = null;
    this.updating = false;
    this.editError = null;
    this.editAction = {};

    // Eliminación de acciones.

    this.deletingActionId = null;
    this.confirmDeleteActionId = null;
    this.deleteError = null;

    // Estado de ventanas modales.

    this.activeModal = null;

    this.unlockBodyScroll();

  }

  get canExportActions(): boolean {
    return (
      this.hasValidContext &&
      this.evaluationId !== null &&
      this.actions.length > 0 &&
      !this.loading &&
      !this.saving &&
      !this.updating &&
      this.deletingActionId === null &&
      this.activeModal === null &&
      this.errorMessage === null
    );
  }

  exportActions(format: 'csv' | 'xlsx'): void {
    if (!this.canExportActions || this.evaluationId === null) {
      return;
    }

    this.exportError = null;

    try {
      const table =
        this.advancedExportService.buildImprovementActionsTable(
          this.actions
        );

      this.advancedExportService.downloadTable(
        table,
        format,
        `plan-mejora-evaluacion-${this.evaluationId}`
      );
    } catch (error) {
      console.error('Error al exportar el plan de mejora', error);

      this.exportError =
        'No fue posible exportar el plan de mejora. Inténtalo nuevamente.';
    }
  }

  private lockBodyScroll(): void {
    if (this.previousBodyOverflow !== null) {
      return;
    }

    this.previousBodyOverflow =
      this.document.body.style.overflow || '';

    this.renderer.setStyle(
      this.document.body,
      'overflow',
      'hidden'
    );
  }

  private unlockBodyScroll(): void {
    if (this.previousBodyOverflow === null) {
      return;
    }

    if (this.previousBodyOverflow) {
      this.renderer.setStyle(
        this.document.body,
        'overflow',
        this.previousBodyOverflow
      );
    } else {
      this.renderer.removeStyle(
        this.document.body,
        'overflow'
      );
    }

    this.previousBodyOverflow = null;
  }


  ngOnDestroy(): void {

    this.contextReset$.next();
    this.contextReset$.complete();

    this.unlockBodyScroll();

  }


  constructor(
    private route: ActivatedRoute,
    private improvementActionService: ImprovementActionService,
    private advancedExportService: AdvancedExportService
  ) { }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.activeModal === 'create' && !this.saving) {
      this.toggleCreateForm();
    } else if (this.activeModal === 'edit' && !this.updating) {
      this.cancelEditing();
    }
  }

  ngOnInit(): void {

    this.activeCompanyId =
      this.companyContext.selectedCompanyId();

    this.companyChanges$
      .pipe(
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(companyId => {

        if (
          this.contextInvalidated ||
          companyId === this.activeCompanyId
        ) {
          return;
        }

        this.contextInvalidated = true;

        this.resetPlanContext();

        void this.router.navigate([
          '/user/improvement/plan'
        ]);

      });

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(params => {

        this.resetPlanContext();

        if (
          this.contextInvalidated ||
          this.activeCompanyId === null ||
          this.companyContext.selectedCompanyId() !==
          this.activeCompanyId
        ) {

          this.errorMessage =
            'El contexto empresarial ya no es válido.';

          return;

        }

        const rawId = params.get('evaluationId');

        const evaluationId = Number(rawId);

        if (
          rawId === null ||
          !Number.isSafeInteger(evaluationId) ||
          evaluationId <= 0
        ) {

          this.errorMessage =
            'El identificador de la evaluación no es válido.';

          return;

        }

        this.requestedEvaluationId = evaluationId;

        this.validateEvaluationContext();

      });

  }


  private validateEvaluationContext(): void {

    const companyId = this.activeCompanyId;

    const evaluationId = this.requestedEvaluationId;

    if (

      this.contextInvalidated ||

      companyId === null ||

      evaluationId === null ||

      this.companyContext.selectedCompanyId() !== companyId ||

      this.validatingEvaluation

    ) {

      return;

    }

    this.validatedEvaluationId = null;

    this.evaluationId = null;

    this.validatingEvaluation = true;

    this.evaluationValidationError = false;

    this.loading = true;

    this.errorMessage = null;


    const isCurrentRequest = (): boolean =>

      !this.contextInvalidated &&

      this.activeCompanyId === companyId &&

      this.companyContext.selectedCompanyId() === companyId &&

      this.requestedEvaluationId === evaluationId;


    this.evaluationService
      .getEvaluationHistory()
      .pipe(

        take(1),

        takeUntil(this.contextReset$),

        takeUntilDestroyed(this.destroyRef)

      )
      .subscribe({

        next: history => {

          if (!isCurrentRequest()) {

            return;

          }

          this.validatingEvaluation = false;

          const belongsToCompany =
            history.history.some(

              evaluation =>

                evaluation.evaluation_id === evaluationId

            );

          if (!belongsToCompany) {

            this.loading = false;

            this.errorMessage =
              'La evaluación no pertenece a la empresa seleccionada.';

            void this.router.navigate([

              '/user/improvement/plan'

            ]);

            return;

          }

          this.validatedEvaluationId = evaluationId;

          this.evaluationId = evaluationId;

          this.loadActions();

          this.loadProgressMetrics();

        },

        error: () => {

          if (!isCurrentRequest()) {

            return;

          }

          this.validatingEvaluation = false;

          this.loading = false;

          this.evaluationValidationError = true;

          this.errorMessage =
            'No fue posible verificar la evaluación. Inténtalo nuevamente.';

        }

      });

  }

  retryEvaluationValidation(): void {

    if (!this.evaluationValidationError) {

      return;

    }

    this.validateEvaluationContext();

  }

  loadProgressMetrics(): void {
    if (!this.hasValidContext || this.evaluationId === null) {
      return;
    }

    this.loadingProgress = true;
    this.progressError = null;

    this.improvementActionService.getProgressMetrics(
      this.evaluationId
    ).pipe(
      takeUntil(this.contextReset$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: progress => {
        this.progress = progress;
        this.loadingProgress = false;
      },
      error: () => {
        this.progress = null;
        this.loadingProgress = false;
        this.progressError =
          'No se pudieron cargar las métricas de progreso.';
      }
    });
  }


  loadActions(): void {
    if (!this.hasValidContext || this.evaluationId === null) {
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    this.exportError = null;
    this.improvementActionService.getActions(
      this.evaluationId
    ).pipe(
      takeUntil(this.contextReset$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: actions => {
        this.actions = actions;
        this.loading = false;
      },
      error: () => {
        this.actions = [];
        this.loading = false;
        this.errorMessage =
          'No se pudieron cargar las acciones de mejora.';
      }
    });
  }


  getPriorityLabel(priority: ImprovementPriority): string {
    const labels: Record<ImprovementPriority, string> = {
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta'
    };

    return labels[priority];
  }

  getPriorityClass(priority: ImprovementPriority): string {
    const classes: Record<ImprovementPriority, string> = {
      LOW: 'text-bg-success',
      MEDIUM: 'text-bg-warning',
      HIGH: 'text-bg-danger'
    };

    return classes[priority];
  }

  getStatusLabel(status: ImprovementStatus): string {
    const labels: Record<ImprovementStatus, string> = {
      PENDING: 'Pendiente',
      IN_PROGRESS: 'En progreso',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada'
    };

    return labels[status];
  }

  getStatusClass(status: ImprovementStatus): string {
    const classes: Record<ImprovementStatus, string> = {
      PENDING: 'text-bg-secondary',
      IN_PROGRESS: 'text-bg-primary',
      COMPLETED: 'text-bg-success',
      CANCELLED: 'text-bg-dark'
    };

    return classes[status];
  }


  toggleCreateForm(): void {
    if (this.saving || this.updating) {
      return;
    }

    if (this.activeModal === 'create') {
      this.activeModal = null;
      this.showCreateForm = false;
      this.resetCreateForm();
      this.unlockBodyScroll();
    } else {
      this.activeModal = 'create';
      this.showCreateForm = true;
      this.lockBodyScroll();
    }

    this.formError = null;
  }


  resetCreateForm(): void {
    this.newAction = {
      indicator_id: null,
      gap_description: '',
      description: '',
      priority: 'MEDIUM',
      responsible: '',
      target_date: ''
    };
  }


  createAction(): void {
    if (
      !this.hasValidContext ||
      this.evaluationId === null ||
      this.saving
    ) {
      return;
    }

    const payload: ImprovementActionCreate = {
      ...this.newAction,
      gap_description: this.newAction.gap_description.trim(),
      description: this.newAction.description.trim(),
      responsible: this.newAction.responsible.trim(),
      target_date: this.newAction.target_date.trim()
    };

    if (
      !payload.gap_description ||
      !payload.description ||
      !payload.responsible ||
      !payload.target_date
    ) {
      this.formError = 'Completa todos los campos obligatorios.';
      return;
    }

    this.saving = true;
    this.formError = null;

    this.improvementActionService.createAction(
      this.evaluationId,
      payload
    ).pipe(
      takeUntil(this.contextReset$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.saving = false;
        this.showCreateForm = false;
        this.activeModal = null;

        this.unlockBodyScroll();

        this.resetCreateForm();
        this.loadActions();
        this.loadProgressMetrics();
      },
      error: () => {
        this.saving = false;
        this.formError =
          'No se pudo registrar la acción de mejora. Verifica los datos e inténtalo nuevamente.';
      }
    });
  }


  startEditing(action: ImprovementAction): void {
    if (this.updating || this.saving) {
      return;
    }

    this.editingActionId = action.id;
    this.activeModal = 'edit';
    this.lockBodyScroll();
    this.editError = null;

    this.editAction = {
      indicator_id: action.indicator_id,
      gap_description: action.gap_description,
      description: action.description,
      priority: action.priority,
      responsible: action.responsible,
      target_date: action.target_date,
      status: action.status
    };
  }

  cancelEditing(): void {
    if (this.updating) {
      return;
    }

    this.editingActionId = null;
    this.activeModal = null;
    this.editAction = {};
    this.editError = null;

    this.unlockBodyScroll();
  }

  updateAction(): void {
    if (
      !this.hasValidContext ||
      this.evaluationId === null ||
      this.editingActionId === null ||
      this.updating
    ) {
      return;
    }

    const payload: ImprovementActionUpdate = {
      ...this.editAction,
      gap_description: this.editAction.gap_description?.trim(),
      description: this.editAction.description?.trim(),
      responsible: this.editAction.responsible?.trim(),
      target_date: this.editAction.target_date?.trim()
    };

    if (
      !payload.gap_description ||
      !payload.description ||
      !payload.responsible ||
      !payload.target_date ||
      !payload.priority ||
      !payload.status
    ) {
      this.editError = 'Completa todos los campos obligatorios.';
      return;
    }

    this.updating = true;
    this.editError = null;

    this.improvementActionService.updateAction(
      this.evaluationId,
      this.editingActionId,
      payload
    ).pipe(
      takeUntil(this.contextReset$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.updating = false;
        this.cancelEditing();
        this.loadActions();
        this.loadProgressMetrics();
      },
      error: () => {
        this.updating = false;
        this.editError =
          'No se pudo actualizar la acción de mejora. Verifica los datos e inténtalo nuevamente.';
      }
    });
  }

  requestDelete(actionId: number): void {
    if (
      this.deletingActionId !== null ||
      this.updating ||
      this.saving
    ) {
      return;
    }

    this.confirmDeleteActionId = actionId;
    this.deleteError = null;
  }

  cancelDelete(): void {
    if (this.deletingActionId !== null) {
      return;
    }

    this.confirmDeleteActionId = null;
    this.deleteError = null;
  }

  deleteAction(): void {
    if (
      !this.hasValidContext ||
      this.evaluationId === null ||
      this.confirmDeleteActionId === null ||
      this.deletingActionId !== null
    ) {
      return;
    }

    const actionId = this.confirmDeleteActionId;

    this.deletingActionId = actionId;
    this.deleteError = null;

    this.improvementActionService.deleteAction(
      this.evaluationId,
      actionId
    ).pipe(
      takeUntil(this.contextReset$),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.deletingActionId = null;
        this.confirmDeleteActionId = null;
        this.deleteError = null;

        if (this.editingActionId === actionId) {
          this.cancelEditing();
        }

        this.loadActions();
        this.loadProgressMetrics();
      },
      error: () => {
        this.deletingActionId = null;
        this.deleteError =
          'No se pudo eliminar la acción de mejora. Inténtalo nuevamente.';
      }
    });
  }

}
