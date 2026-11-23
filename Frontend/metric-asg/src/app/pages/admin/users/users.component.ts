import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { SharedModule } from '../../../shared/shared.module';

import { AdminService } from '../../../services/admin.service';
import { AllUsers } from '../../../models/admin';
import { User } from '../../../models/user';
import { UserFormComponent } from '../../modals/user-form/user-form.component';
import { AdminRegister } from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    SharedModule
  ],
  templateUrl: './users.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  allUsers: AllUsers | null = null;
  admin: User[] = [];
  users: User[] = [];
  user_name_search = "";
  admin_name_search = "";

  constructor(private userService: AdminService, private authService: UserService,
    private dialog: MatDialog) {
  }
  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.lodadAdminUsers();
    this.loadNormalUsers();
  }
  lodadAdminUsers() {
    this.authService.getAll({
      filters: {
        role: "admin",
        name: this.admin_name_search,
      }
    }).subscribe({
      next: (data) => {
        this.admin = data;
      },
      error: (err) => {
        console.log(err)
      }
    });
  }

  loadNormalUsers(): void {
    this.authService.getAll({
      filters: {
        role: 'user',
        name: this.user_name_search
      }
    }).subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
      }
    });
  }

  openCreateModal(): void {
    const dialogRef = this.dialog.open(UserFormComponent, {
      width: '400px'
    });


    dialogRef.afterClosed().subscribe((result?: AdminRegister ) => {
      this.loadUsers();
    });

  }
  changeStateUser(id: number, state: boolean) {
    if (confirm(`¿Esta seguro de ${state ? "desactivar" : "activar"} este usuario?`)) {
      this.userService.changeUserState(id).subscribe({
        next: (value) => {
          this.loadUsers();
        }, error: (err) => {
          console.log(err);
        }
      });
    }
  }
}
