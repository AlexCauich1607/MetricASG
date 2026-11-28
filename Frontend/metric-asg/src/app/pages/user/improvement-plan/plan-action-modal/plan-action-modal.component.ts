import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ImprovementActionCreate, ImprovementActionUpdate } from '../../../../models/improvement_action';

@Component({
  selector: 'app-plan-action-modal',
  standalone: true,
  imports: [FormsModule, CdkTrapFocus],
  templateUrl: './plan-action-modal.component.html',
  styleUrl: './plan-action-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class PlanActionModalComponent {
  @Input() activeModal: 'create' | 'edit' | null = null;
  @Input() editingActionId: number | null = null;
  @Input({ required: true }) newAction!: ImprovementActionCreate;
  @Input({ required: true }) editAction!: ImprovementActionUpdate;
  @Input() saving = false;
  @Input() updating = false;
  @Input() formError: string | null = null;
  @Input() editError: string | null = null;
  @Output() readonly createCancelled = new EventEmitter<void>();
  @Output() readonly editCancelled = new EventEmitter<void>();
  @Output() readonly createSubmitted = new EventEmitter<void>();
  @Output() readonly editSubmitted = new EventEmitter<void>();
}
