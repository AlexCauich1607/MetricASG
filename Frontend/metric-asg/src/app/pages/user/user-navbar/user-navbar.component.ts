import { Component } from '@angular/core';
import { SessionService } from '../../../shared/class/temporalStorage';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AdminLayoutComponent } from '../../admin/layout/admin-layout/admin-layout.component';
import { SidebarComponent } from '../../modals/settings/sidebar/sidebar.component';


@Component({
  selector: 'app-user-navbar',
  standalone: false,
  templateUrl: './user-navbar.component.html',
  styleUrl: './user-navbar.component.scss'
})
export class UserNavbarComponent {

  first = SessionService.getSessionItem('first-time');
  photo = SessionService.getSessionItem('photo') ;
  constructor(private router: Router, private dialog: MatDialog) {

  }
  cerrarSesion() {
    SessionService.logout();
    this.router.navigate(["/home"])
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
