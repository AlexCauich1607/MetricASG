
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
  selector: 'app-analysis',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class AnalysisComponent {}
