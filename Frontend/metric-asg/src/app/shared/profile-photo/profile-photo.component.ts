import { Component } from '@angular/core';
import { SessionService } from '../class/temporalStorage';
import { SidebarComponent } from '../../pages/modals/settings/sidebar/sidebar.component';
import { Dialog } from '@angular/cdk/dialog';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-profile-photo',
  standalone: false,
  templateUrl: './profile-photo.component.html',
  styleUrl: './profile-photo.component.scss'
})
export class ProfilePhotoComponent {
  photo = SessionService.getSessionItem('photo');

  constructor(private dialog: MatDialog){

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
