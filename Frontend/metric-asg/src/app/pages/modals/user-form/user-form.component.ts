import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserRegister } from '../../../models/auth';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-user-form',
  standalone: false,
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.scss'
})
export class UserFormComponent {
  form: FormGroup;
  saving = false;
  r_password = "";

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<UserRegister>,
    private authService: AuthService,
    @Inject(MAT_DIALOG_DATA) public data?: UserRegister
  ) {
    this.form = this.fb.group({
      name: [data?.name || '', [Validators.required, Validators.minLength(3)]],
      lastname: [data?.lastname || '', [Validators.required, Validators.minLength(3)]],
      email: [data?.email || "", [Validators.required, Validators.email]],
      password: [data?.password || '', [Validators.required, Validators.minLength(8)]],
    });
  }

  validatePassword() {
    if (this.getValue("password")?.invalid) {
      this.r_password = "";
    }
    return this.r_password == (this.getValue("password")?.value);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.validatePassword()) {
      return
    }

    this.saving = true;

    const result: UserRegister = {
      ...this.form.value
    };
    this.authService.createAdmin(result).subscribe({
      next: (value) => {
        alert("Usuario creado con exito");
        this.dialogRef.close(result);
      },
      error: (err) => {
        console.log(err)
      }
    })


  }

  close(): void {
    this.dialogRef.close(null);
  }

  getValue(name: string) {
    return this.form.get(name);
  }
}
