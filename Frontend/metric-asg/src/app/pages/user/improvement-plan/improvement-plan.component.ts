import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  Renderer2,
  inject
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ActivatedRoute } from '@angular/router';
import { ImprovementActionService } from '../../../services/improvement-action.service';
import { FormsModule } from '@angular/forms';
import {
  ImprovementAction,
  ImprovementActionCreate,
  ImprovementActionUpdate,
  ImprovementPriority,
  ImprovementStatus
} from '../../../models/improvement_action';
import { DOCUMENT, DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { ImprovementProgress } from '../../../models/improvement_progress';

@Component({
  selector: 'app-improvement-plan',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgClass, FormsModule, CdkTrapFocus],
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
  progress: ImprovementProgress | null = null;
  loadingProgress = false;
  progressError: string | null = null;

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
    this.unlockBodyScroll();
  }

  constructor(
    private route: ActivatedRoute,
    private improvementActionService: ImprovementActionService
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
    this.route.paramMap.subscribe(params => {
      const rawId = params.get('evaluationId');
      const evaluationId = Number(rawId);

      this.evaluationId = null;
      this.actions = [];
      this.errorMessage = null;
      this.progress = null;
      this.loadingProgress = false;
      this.progressError = null;

      if (
        rawId === null ||
        !Number.isSafeInteger(evaluationId) ||
        evaluationId <= 0
      ) {
        this.loading = false;
        this.errorMessage = 'El identificador de la evaluación no es válido.';
        return;
      }

      this.evaluationId = evaluationId;
      this.loadActions();
      this.loadProgressMetrics();
    });
  }

  loadProgressMetrics(): void {
    if (this.evaluationId === null) {
      return;
    }

    this.loadingProgress = true;
    this.progressError = null;

    this.improvementActionService.getProgressMetrics(
      this.evaluationId
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
    if (this.evaluationId === null) {
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.improvementActionService.getActions(
      this.evaluationId
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
    if (this.evaluationId === null || this.saving) {
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
