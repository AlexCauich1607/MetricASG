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

  private explanationValue: string | null = null;

  explanationBlocks: ExplanationBlock[] = [];

  @Input()
  set explanation(value: string | null) {

    if (value === this.explanationValue) {
      return;
    }

    this.explanationValue = value;

    this.explanationBlocks =
      this.buildExplanationBlocks(value);

  }

  get explanation(): string | null {
    return this.explanationValue;
  }

  @Input() generating = false;

  @Input() error: string | null = null;

  @Input() unavailable = false;

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

  private buildExplanationBlocks(
    explanation: string | null
  ): ExplanationBlock[] {

    if (!explanation?.trim()) {
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

    const lines = explanation
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