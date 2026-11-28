
import {
  ChangeDetectionStrategy,
  Component
} from '@angular/core';

@Component({
  selector: 'app-results-skeleton',
  standalone: true,
  templateUrl: './results-skeleton.component.html',
  styleUrl: './results-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsSkeletonComponent {

  readonly cards = [0, 1, 2, 3];

  readonly summaryItems = [0, 1];

  readonly nextSteps = [0, 1];

}
