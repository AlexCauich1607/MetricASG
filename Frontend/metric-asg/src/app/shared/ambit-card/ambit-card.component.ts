import {
  Component,
  Input,
  ChangeDetectionStrategy
} from '@angular/core';


@Component({
  selector: 'app-ambit-card',
  standalone: true,
  templateUrl: './ambit-card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ambit-card.component.scss',
  host: {
    '[class.ambit-card--dashboard]': 'variant === "dashboard"'
  }
})
export class AmbitCardComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() score: number | null = 0;
  @Input() delta: number | null = null;
  @Input() showDelta: boolean = false;
  @Input() color: string = '';
  @Input() letter: string = '';
  @Input() maturity_color: string = '';

  @Input() variant: 'default' | 'dashboard' = 'default';
  @Input() featured = false;

  get dashboardIcon(): string {

    switch (this.letter.trim().toUpperCase()) {
      case 'A':
        return 'bi bi-tree';

      case 'S':
        return 'bi bi-people';

      case 'G':
        return 'bi bi-bank';

      default:
        return 'bi bi-bar-chart';
    }
  }

  get hasValidScore(): boolean {
    return (
      typeof this.score === 'number' &&
      Number.isFinite(this.score)
    );
  }

  get formattedScore(): string {
    return this.hasValidScore
      ? this.score!.toFixed(1)
      : 'N/D';
  }

  get progressPercentage(): number {
    if (!this.hasValidScore) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(0, this.score! * 10)
    );
  }

  get dashboardMaturityColor(): string | null {
    const color = this.maturity_color?.trim();

    if (
      !color ||
      !/^#[0-9a-f]{6}$/i.test(color)
    ) {
      return null;
    }

    return color;
  }
}