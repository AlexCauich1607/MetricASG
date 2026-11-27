import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ImprovementAction } from '../../../../models/improvement_action';
import { PlanDeleteConfirmationComponent } from '../plan-delete-confirmation/plan-delete-confirmation.component';

@Component({
  selector: 'app-plan-action-card',
  standalone: true,
  imports: [DatePipe, PlanDeleteConfirmationComponent],
  templateUrl: './plan-action-card.component.html',
  styleUrl: './plan-action-card.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class PlanActionCardComponent {
  @Input({ required: true }) action!: ImprovementAction;
  @Input({ required: true }) priorityLabel!: string;
  @Input({ required: true }) statusLabel!: string;
  @Input() saving = false;
  @Input() updating = false;
  @Input() deletingActionId: number | null = null;
  @Input() confirmDeleteActionId: number | null = null;
  @Input() deleteError: string | null = null;
  @Output() readonly editRequested = new EventEmitter<ImprovementAction>();
  @Output() readonly deleteRequested = new EventEmitter<number>();
  @Output() readonly deleteCancelled = new EventEmitter<void>();
  @Output() readonly deleteConfirmed = new EventEmitter<void>();
}
