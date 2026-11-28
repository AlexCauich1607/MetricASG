
import {
  Component,
  ChangeDetectionStrategy
} from '@angular/core';

import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

@Component({
  selector: 'app-improvement',
  standalone: true,

  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],

  templateUrl: './improvement.component.html',
  styleUrl: './improvement.component.scss',

  changeDetection: ChangeDetectionStrategy.Eager
})
export class ImprovementComponent {}
