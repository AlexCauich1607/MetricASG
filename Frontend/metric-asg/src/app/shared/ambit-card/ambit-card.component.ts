import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ambit-card',
  standalone: false,
  templateUrl: './ambit-card.component.html',
  styleUrl: './ambit-card.component.scss'
})
export class AmbitCardComponent {
  @Input() title: string = "";
  @Input() subtitle: string = "";
  @Input() score: number = 0;
  @Input() color: string = "";
  @Input() letter: string = "";
  @Input() maturity_color: string = "";
}
