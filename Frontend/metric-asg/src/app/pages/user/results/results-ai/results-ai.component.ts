
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';

interface ExplanationBlock {
  type: 'heading' | 'paragraph';
  text: string;
}

@Component({
  selector: 'app-results-ai',
  standalone: true,
  imports: [],
  templateUrl: './results-ai.component.html',
  styleUrl: './results-ai.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsAiComponent {

  @Input() explanation: string | null = null;

  @Input() generating = false;

  @Input() error: string | null = null;

  @Output() generate = new EventEmitter<void>();

  private readonly knownHeadings = new Set([
    'resumen general del resultado asg',
    'interpretación de los resultados por ámbito',
    'brechas registradas',
    'resumen ejecutivo',
    'principales fortalezas',
    'oportunidades de mejora',
    'recomendaciones',
    'conclusión',
    'conclusiones'
  ]);

  get explanationBlocks(): ExplanationBlock[] {

    if (!this.explanation?.trim()) {
      return [];
    }

    const blocks: ExplanationBlock[] = [];

    let paragraphLines: string[] = [];

    const flushParagraph = (): void => {

      if (paragraphLines.length === 0) {
        return;
      }

      blocks.push({
        type: 'paragraph',
        text: paragraphLines.join('\n')
      });

      paragraphLines = [];

    };

    const lines = this.explanation
      .replace(/\r\n?/g, '\n')
      .split('\n');

    for (const rawLine of lines) {

      const line = rawLine.trim();

      if (!line) {
        flushParagraph();
        continue;
      }

      const normalizedHeading = line
        .replace(/:$/, '')
        .trim()
        .toLocaleLowerCase('es');

      if (this.knownHeadings.has(normalizedHeading)) {

        flushParagraph();

        blocks.push({
          type: 'heading',
          text: line
        });

        continue;

      }

      paragraphLines.push(line);

    }

    flushParagraph();

    return blocks;

  }

  requestExplanation(): void {

    if (this.generating) {
      return;
    }

    this.generate.emit();

  }

}
