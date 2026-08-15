import { Component } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { AllUsers } from '../../../models/admin';
import { User } from '../../../models/user';
import { MatDialog } from '@angular/material/dialog';
import { UserFormComponent } from '../../modals/user-form/user-form.component';
import { UserRegister } from '../../../models/auth';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { filter } from 'rxjs';
import { CompanySectorService } from '../../../services/company-sector.service';
import { CompanySector } from '../../../models/company_sector';
import { CompanySizeService } from '../../../services/company-size.service';
import { SearchFilterComponent } from '../../modals/search-filter/search-filter.component';

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  allUsers: AllUsers | null = null;
  admin: User[] = [];
  users: User[] = [];
  sectores: CompanySector[] = [];
  sizes: CompanySector[] = [];
  user_name_search = "";
  admin_name_search = "";
  sectores_seleccionados: number [] = []
  sizes_seleccionados: number [] = []

  constructor(private userService: AdminService, private authService: UserService,
    private sectorService: CompanySectorService, private sizeService: CompanySizeService,
    private dialog: MatDialog) {
  }
  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.lodadAdminUsers();
    this.loadNormalUsers();
    this.loadSectors();
    this.loadSizes();
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
  loadNormalUsers() {
    let filters: any = {
      role: "user",
      company_name: this.user_name_search,
    }
    if(this.sectores_seleccionados.length > 0 && this.sectores_seleccionados.length != this.sectores.length){
      filters = {...filters, company_sector_id: this.sectores_seleccionados};
    }
     if(this.sizes_seleccionados.length > 0 && this.sizes_seleccionados.length != this.sizes.length){
      filters = {...filters, company_size_id: this.sizes_seleccionados};
    }
    this.authService.getAll({
      filters: filters
    }).subscribe({
      next: (data) => {
        this.users = data;
      },
      error: (err) => {
        console.log(err)
      }
    })
  }
  loadSectors() {
    this.sectorService.getAll().subscribe(
      {
        next: (value) => {
          this.sectores = value;
        }
      }
    )
  }
  loadSizes() {
    this.sizeService.getAll().subscribe(
      {
        next: (value) => {
          this.sizes = value;
        }
      }
    )
  }
  getSector(id: number) {
    let name = "Sector";
    this.sectores.forEach(s => {
      if (s.id == id) {
        name = s.name;
      }
    })
    return name;
  }
  getSize(id: number) {
    let name = "Size";
    this.sizes.forEach(s => {
      if (s.id == id) {
        name = s.name;
      }
    })
    return name;
  }
  openCreateModal(): void {
    const dialogRef = this.dialog.open(UserFormComponent, {
      width: '400px'
    });


    dialogRef.afterClosed().subscribe((result?: UserRegister) => {
      this.loadUsers();
    });

  }
  changeStateUser(id: number, state: boolean) {
    if (confirm(`¿Esta seguro de ${state?"desactivar":"activar"} este usuario?`)) {
      this.userService.changeUserState(id).subscribe({
        next: (value) => {
          this.loadUsers();
        }, error: (err) => {
          console.log(err);
        }
      });
    }
  }

  openCreateFilterModal(): void {
    const dialogRef = this.dialog.open(SearchFilterComponent, {
      width: '400px',
      data: {
        sectores: this.sectores,
        sectores_seleccionados: this.sectores_seleccionados,
        sizes: this.sizes,
        sizes_seleccionados: this.sizes_seleccionados,
      }
    });


    dialogRef.afterClosed().subscribe((result?: any) => {
      if (!result) return;
      this.sectores_seleccionados = result.sectores_seleccionados;
      this.sizes_seleccionados = result.sizes_seleccionados;
      this.loadUsers();
    });

  }
}
