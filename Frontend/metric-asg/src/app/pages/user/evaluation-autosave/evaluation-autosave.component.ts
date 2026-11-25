import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';

export type EvaluationAutosaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error';

@Component({
  selector: 'app-evaluation-autosave',
  standalone: true,
  templateUrl: './evaluation-autosave.component.html',
  styleUrl: './evaluation-autosave.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EvaluationAutosaveComponent {

  readonly status = input.required<EvaluationAutosaveStatus>();

  readonly hasUnsavedResponses = input(false);

  readonly canRetry = input(false);

  readonly presentation = input<'indicator' | 'notice'>(
    'indicator'
  );

  readonly retry = output<void>();

  readonly showUnsavedWarning = computed(() =>
    this.status() === 'idle' &&
    this.hasUnsavedResponses()
  );

  readonly showIndicator = computed(() =>
    this.status() !== 'idle' ||
    this.showUnsavedWarning()
  );

  readonly showNotice = computed(() =>
    this.status() === 'error' ||
    this.showUnsavedWarning()
  );

  requestRetry(): void {
    if (
      this.status() !== 'error' ||
      !this.canRetry()
    ) {
      return;
    }

    this.retry.emit();
  }
}