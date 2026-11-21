import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { PersonalUserRegister } from '../../models/auth';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { phoneValidate } from '../../shared/class/validators';

@Component({
  selector: 'app-sing-up',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatButtonModule
  ],
  templateUrl: './sing-up.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sing-up.component.scss'
})
export class SingUpComponent {

  name: string | null = null;
  lastname: string | null = null;
  position: string | null = null;

  email: string | null = null;
  phone: string | null = null;

  password: string | null = null;
  r_password: string = "";

  showPassword = false;
  showPassword2 = false;
  hasValue = false;


  touched = [false, false];

  form: FormGroup;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.form = fb.group({
      name: ['', [Validators.minLength(3), Validators.required]],
      lastname: ['', [Validators.minLength(3), Validators.required]],
      position: ['', [Validators.minLength(3), Validators.required]],
      email: ['', [Validators.email, Validators.required]],
      phone: ['', [Validators.required]],
      password: ['', [Validators.minLength(8), Validators.required]],
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.hasValue = input.value.length > 0;
  }

  isTouched(ix: number) {
    this.touched[ix] = true;
  }

  getValue(name: string) {
    return this.form.get(name);
  }

  validatePhone(): boolean {
    return phoneValidate(this.getValue("phone")?.value);
  }

  validatePassword(): boolean {
    const password = this.getValue('password')?.value ?? '';

    if (password.length === 0) {
      return this.r_password === '';
    }

    return password === this.r_password;
  }

  register(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      alert('Hay campos incompletos');
      return;
    }

    if (!this.validatePassword()) {
      alert('Las contraseñas no coinciden');
      return;
    }

    if (!this.validatePhone()) {
      alert('Teléfono no válido');
      return;
    }

    const request: PersonalUserRegister = {
      name: this.getValue('name')?.value,
      lastname: this.getValue('lastname')?.value,
      position: this.getValue('position')?.value,
      email: this.getValue('email')?.value,
      phone: this.getValue('phone')?.value,
      password: this.getValue('password')?.value,
    };

    this.authService.createUser(request).subscribe({
      next: () => {
        alert('Usuario creado con éxito');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error(err);
      },
    });
  }
}
