import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserNavbarComponent } from '../user-navbar/user-navbar.component';
import { FooterComponent } from '../../../shared/footer/footer.component';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    UserNavbarComponent,
    FooterComponent
  ],
  templateUrl: './user-layout.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-layout.component.scss'
})
export class UserLayoutComponent {

}
