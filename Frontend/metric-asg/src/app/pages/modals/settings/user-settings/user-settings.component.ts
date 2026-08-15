import { Component, Input } from '@angular/core';
import { User } from '../../../../models/user';
import { UserService } from '../../../../services/user.service';
import { SessionService } from '../../../../shared/class/temporalStorage';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-user-settings',
  standalone: false,
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.scss'
})
export class UserSettingsComponent {
  @Input() user: User | null = null;
  imageSrc = this.user?.profile_photo;
  constructor(private userService: UserService){

  }
  ngOnInit():void{
    this.imageSrc = this.user?.profile_photo;
  }


  getImage(): string {
    return "data:image/jpeg;base64," + this.user?.profile_photo;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;

      this.user!.profile_photo = result.split(',')[1];
    };

    reader.readAsDataURL(file);
  }

  deleteImg(){
    this.user!.profile_photo = "";
  }

  update(){
    if(this.user!.name!.length<3 || (!this.user?.lastname || this.user.lastname.length < 3) || 
    ((!this.user?.position || this.user.position.length < 3)&&this.user.role!="admin")){
      return;
    }
    const payload = {
      name: this.user?.name,
      lastname: this.user?.lastname,
      position: this.user?.position,
      profile_photo: this.user?.profile_photo,
      active: true
    }
    const id= this.user?.id ?? 0;
    this.userService.update(id, payload).subscribe({
      next:(value)=> {
        SessionService.setSessionItem('photo', this.user?.profile_photo);
        alert("Usuario actualizado con exito");
      },
      error: (err)=>{
        alert("Error al actualizar el usuario")
      }
    })
  }
}
