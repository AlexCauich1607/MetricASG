import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UserService } from '../../../../services/user.service';
import { User } from '../../../../models/user';
import { SessionService } from '../../../../shared/class/temporalStorage';
import { MatDialogRef } from '@angular/material/dialog';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { CompanySettingsComponent } from '../company-settings/company-settings.component';
import { ContactSettingsComponent } from '../contact-settings/contact-settings.component';

@Component({
  selector: 'app-sidebar-settings',
  standalone: true,
  imports: [
    UserSettingsComponent,
    CompanySettingsComponent,
    ContactSettingsComponent
  ],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  ix = 0;
  user: User | null= null;
  id= SessionService.getSessionItem("id");
  constructor(private userService: UserService, private dialogRef: MatDialogRef<SidebarComponent>){

  }
  ngOnInit(): void{
    this.loadUser();
  }
  loadUser(){
    this.userService.getById(this.id??0).subscribe({
      next: (value)=>{
        this.user = value;
      },
      error: (err)=>{

      }
    })
  }
  selectIx(n:number){
    this.ix= n;
  }
  
  close(): void {
    this.dialogRef.close(null);
  }
}
