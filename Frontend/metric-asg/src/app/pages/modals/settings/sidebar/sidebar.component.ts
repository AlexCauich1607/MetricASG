import { Component } from '@angular/core';
import { UserService } from '../../../../services/user.service';
import { User } from '../../../../models/user';
import { SessionService } from '../../../../shared/class/temporalStorage';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-sidebar-settings',
  standalone: false,
  templateUrl: './sidebar.component.html',
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
