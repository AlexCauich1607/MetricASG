import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    SidebarComponent,
    RouterOutlet
  ],
  templateUrl: './admin-layout.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent {

}
