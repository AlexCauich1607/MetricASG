
import {
  ChangeDetectionStrategy,
  Component,
  Input
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type UiStateType = 'loading' | 'error' | 'empty' | 'success';

@Component({
  selector: 'app-ui-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-state.component.html',
  styleUrl: './ui-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UiStateComponent {
  @Input() type: UiStateType = 'empty';
  @Input() title = '';
  @Input() message = '';
}
