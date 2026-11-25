import {
  ChangeDetectionStrategy,
  Component
} from '@angular/core';

@Component({
  selector: 'app-evaluation-skeleton',
  standalone: true,
  imports: [],
  templateUrl: './evaluation-skeleton.component.html',
  styleUrl: './evaluation-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EvaluationSkeletonComponent {
  readonly answers = [0, 1, 2];
}