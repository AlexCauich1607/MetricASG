import { Component } from '@angular/core';
import { SessionService } from '../../../shared/class/temporalStorage';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  isOpen = false;

  constructor(private router: Router, private authService: AuthService) {

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
    this.authService.logout()
      .pipe(
        finalize(() => {
          SessionService.logout();
          this.router.navigate(['/home']);
        })
      )
      .subscribe({
        error: () => { }
      });
  }
}
