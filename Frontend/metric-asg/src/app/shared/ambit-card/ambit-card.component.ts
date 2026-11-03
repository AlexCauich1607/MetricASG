import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-ambit-card',
  standalone: true,
  templateUrl: './ambit-card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ambit-card.component.scss'
})
export class AmbitCardComponent {
  @Input() title: string = "";
  @Input() subtitle: string = "";
  @Input() score: number | null = 0;
  @Input() delta: number | null = null;
  @Input() showDelta: boolean = false;
  @Input() color: string = "";
  @Input() letter: string = "";
  @Input() maturity_color: string = "";
}
