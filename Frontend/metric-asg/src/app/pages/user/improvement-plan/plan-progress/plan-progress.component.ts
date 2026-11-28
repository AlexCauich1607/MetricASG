import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ImprovementProgress } from '../../../../models/improvement_progress';

@Component({
  selector: 'app-plan-progress',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './plan-progress.component.html',
  styleUrl: './plan-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class PlanProgressComponent {
  @Input() loadingProgress = false;
  @Input() progressError: string | null = null;
  @Input() progress: ImprovementProgress | null = null;
  @Output() readonly retry = new EventEmitter<void>();
}
