import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
@Component({
  selector: 'app-plan-delete-confirmation',
  standalone: true,
  imports: [],
  templateUrl: './plan-delete-confirmation.component.html',
  styleUrl: './plan-delete-confirmation.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class PlanDeleteConfirmationComponent {
  @Input({ required: true }) actionId!: number;
  @Input() deletingActionId: number | null = null;
  @Input() deleteError: string | null = null;
  @Output() readonly cancelled = new EventEmitter<void>();
  @Output() readonly confirmed = new EventEmitter<void>();
}
