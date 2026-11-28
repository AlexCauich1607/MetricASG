
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';

import {
  EvaluationEvidence
} from '../../../../models/evaluation_evidence';

@Component({
  selector: 'app-results-evidences',
  standalone: true,
  imports: [],
  templateUrl: './results-evidences.component.html',
  styleUrl: './results-evidences.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsEvidencesComponent {

  @Input() evidences: EvaluationEvidence[] = [];

  @Input() loading = false;

  @Input() error = false;

  @Input() downloadingEvidenceId: number | null = null;

  @Input() downloadError: string | null = null;

  @Output() retry = new EventEmitter<void>();

  @Output() download = new EventEmitter<EvaluationEvidence>();

  getEvidenceIndicatorIds(): number[] {

    return [
      ...new Set(
        this.evidences.map(evidence => evidence.indicator_id)
      )
    ].sort((a, b) => a - b);

  }

  requestRetry(): void {

    if (this.loading) {
      return;
    }

    this.retry.emit();

  }

  requestDownload(evidence: EvaluationEvidence): void {

    if (
      evidence.type !== 'FILE' ||
      this.downloadingEvidenceId !== null
    ) {
      return;
    }

    this.download.emit(evidence);

  }

}
