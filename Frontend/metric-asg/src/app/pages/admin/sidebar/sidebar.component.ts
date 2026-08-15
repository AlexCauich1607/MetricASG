import { Component } from '@angular/core';
import { SessionService } from '../../../shared/class/temporalStorage';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  isOpen = false;

  constructor(private router: Router){

  }
  toggleSidebar() {
    this.isOpen = !this.isOpen;
  }

  closeOnMobile() {
    if (window.innerWidth < 768) {
      this.isOpen = false;
    }
  }

  close() {
    SessionService.logout();
    this.router.navigate(["/home"])
  }
}
