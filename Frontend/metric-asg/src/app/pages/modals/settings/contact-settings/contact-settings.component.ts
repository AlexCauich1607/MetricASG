import { Component, Input } from '@angular/core';
import { User } from '../../../../models/user';
import { UserService } from '../../../../services/user.service';
import { AuthService } from '../../../../services/auth.service';
import { ChangePassword } from '../../../../models/auth';
import { phoneValidate } from '../../../../shared/class/validators';

@Component({
  selector: 'app-contact-settings',
  standalone: false,
  templateUrl: './contact-settings.component.html',
  styleUrl: './contact-settings.component.scss'
})
export class ContactSettingsComponent {
  @Input() user: User | null = null;
  password = "";
  bf_password = "";
  tel_bf = this.user?.phone;

  constructor(private userService: UserService, private authService: AuthService) { }
  update() {

    if (this.user?.phone != this.tel_bf) {
      if (this.user!.phone!.length > 0 && !this.isPhoneValidate()) {
        return;
      }
      const payload = {
        phone: this.user?.phone,
      }
      const id = this.user?.id ?? 0;
      this.userService.update(id, payload).subscribe({
        next: (value) => {
          this.tel_bf = this.user?.phone;
          alert("Telefono actualizado con exito")

        },
        error: (err) => {
          alert("Error al actualizar el usuario")
        }
      })
    }

    if (this.password.length >= 8 && this.bf_password.length >= 8) {
      const request: ChangePassword = {
        id_user: this.user?.id ?? 0,
        new_password: this.password,
        bf_password: this.bf_password
      }
      this.authService.changePaassword(request).subscribe({
        next: (value) => {
          alert("Contraseña cambiada con exito");
        },
        error: (err) => {
          alert("Contraseña incorrecta");
        }
      })
    }
  }
  isPhoneValidate(): boolean {
    return phoneValidate(this.user?.phone!);
  }

  isChangePassword(){
    if(this.password.length <= 0){
      this.bf_password="";
    }
    return this.password.length > 0;
  }
}
