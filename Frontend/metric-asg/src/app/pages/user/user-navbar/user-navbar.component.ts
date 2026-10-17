import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { SessionService } from '../../../shared/class/temporalStorage';
import { MatDialog } from '@angular/material/dialog';
import { SidebarComponent } from '../../modals/settings/sidebar/sidebar.component';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-user-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './user-navbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-navbar.component.scss'
})
export class UserNavbarComponent {

  first = SessionService.getSessionItem('first-time');
  photo = SessionService.getSessionItem('photo');
  constructor(private router: Router, private dialog: MatDialog,
    private authService: AuthService) {

  }
  cerrarSesion() {
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

  getImage(): string {
    return "data:image/jpeg;base64," + this.photo;
  }

  openConfiguration() {
    const dialogRef = this.dialog.open(SidebarComponent, {

      width: '900px',
      height: '500px',
    });

    dialogRef.afterClosed().subscribe();
  }
}
