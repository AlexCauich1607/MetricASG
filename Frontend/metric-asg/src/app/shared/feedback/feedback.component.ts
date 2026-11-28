import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ResultAmbit } from '../../models/evaluation_result';

@Component({
  selector: 'feedback-component',
  standalone: true,
  templateUrl: './feedback.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './feedback.component.scss'
})
export class FeedbackComponent {

  @Input() ambits: ResultAmbit[] = [];

  @Input() variant: 'default' | 'analysis' = 'default';

  getAmbitIcon(letter: string): string {
    switch (letter?.trim().toUpperCase()) {
      case 'A':
        return 'bi bi-tree';

      case 'S':
        return 'bi bi-people';

      case 'G':
        return 'bi bi-bank';

      default:
        return 'bi bi-globe-americas';
    }
  }

  getBorderColor(level: string): string {
    let color = "";
    if (level === "Básico") {
      color = "#ce4040ff";
    } else if (level === "Intermedio") {
      color = "#ffa616ff";
    } else {
      color = "#15b91dff";
    }
    return color;
  }
}
