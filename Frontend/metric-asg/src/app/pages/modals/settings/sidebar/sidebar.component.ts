import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UserService } from '../../../../services/user.service';
import { User } from '../../../../models/user';
import { MatDialogRef } from '@angular/material/dialog';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { ContactSettingsComponent } from '../contact-settings/contact-settings.component';

@Component({
  selector: 'app-sidebar-settings',
  standalone: true,
  imports: [
    UserSettingsComponent,
    ContactSettingsComponent
  ],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  ix = 0;
  user: User | null = null;
  loadingUser = false;
  userError = false;
  constructor(private userService: UserService, private dialogRef: MatDialogRef<SidebarComponent>) {

  }
  ngOnInit(): void {
    this.loadUser();
  }

  loadUser(): void {
    this.loadingUser = true;
    this.userError = false;
    this.user = null;

    this.userService.getMe().subscribe({
      next: (user) => {
        this.user = user;
        this.loadingUser = false;
      },
      error: () => {
        this.user = null;
        this.userError = true;
        this.loadingUser = false;
      }
    });
  }

  selectIx(n: number) {
    this.ix = n;
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
