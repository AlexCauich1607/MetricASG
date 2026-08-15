import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { UserLogin } from '../../models/auth';
import { Router } from '@angular/router';
import { SessionService } from '../../shared/class/temporalStorage';
import { Form, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  showPassword = false;
  hasValue = false;
  email: string | null = null;
  password: string | null = null;
  form: FormGroup;
  constructor(private authService: AuthService, private router: Router,
    private sesionService: SessionService, private fb: FormBuilder) {
    this.form = fb.group({
      email: ['', [Validators.email, Validators.required]],
      password: ['', [Validators.minLength(8), Validators.required]]
    })
  }


  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.hasValue = input.value.length > 0;
  }
  getValue(name: string) {
    return this.form.get(name);
  }
  login(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) {
      let request = { ...this.form.value };
      this.authService.login(request).subscribe({
        next: (value) => {
          let response = value.user;
          if (response.role == 'user') {
            this.router.navigate(['/user']);
          } else if (response.role == 'admin') {
            this.router.navigate(['/admin']);
          }
        },
        error: (err) => {
          console.log(err)
        }
      })
    }
  }
}
