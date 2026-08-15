import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { UserRegister } from '../../models/auth';
import { CompanySector } from '../../models/company_sector';
import { CompanySectorService } from '../../services/company-sector.service';
import { CompanySize } from '../../models/company_size';
import { CompanySizeService } from '../../services/company-size.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { phoneValidate } from '../../shared/class/validators';

@Component({
  selector: 'app-sing-up',
  standalone: false,
  templateUrl: './sing-up.component.html',
  styleUrl: './sing-up.component.scss'
})
export class SingUpComponent {

  name: string | null = null;
  lastname: string | null = null;
  position: string | null = null;

  company_name: string | null = null;
  sector_id: number | null = null;
  size_id: number | null = null;

  email: string | null = null;
  phone: string | null = null;

  password: string | null = null;
  r_password: string = "";

  showPassword = false;
  showPassword2 = false;
  hasValue = false;


  touched = [false, false];
  sectores: CompanySector[] | null = null;
  sectorSeleccionado: CompanySector | null = null;
  sizes: CompanySize[] | null = null;
  sizeSeleccionado: CompanySize | null = null;

  form: FormGroup;

  constructor(private authService: AuthService, private sectorService: CompanySectorService,
    private sizeService: CompanySizeService, private router: Router, private fb: FormBuilder) {
    this.form = fb.group({
      name: ['', [Validators.minLength(3), Validators.required]],
      lastname: ['', [Validators.minLength(3), Validators.required]],
      position: ['', [Validators.minLength(3), Validators.required]],
      company_name: ['', [Validators.minLength(3), Validators.required]],
      email: ['', [Validators.email, Validators.required]],
      phone: ['', [Validators.required]],
      password: ['', [Validators.minLength(8), Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadSectores();
    this.loadSizes();
  }
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.hasValue = input.value.length > 0;
  }

  loadSectores() {
    this.sectorService.getAll().subscribe({
      next: (data) => {
        this.sectores = data;
      },
      error: (err) => {
        console.log(err)
      }
    });
  }

  loadSizes() {
    this.sizeService.getAll().subscribe({
      next: (data) => {
        this.sizes = data;
      },
      error: (err) => {
        console.log(err)
      }
    });
  }
  getSectorId(name: string): number {
    let id = 0;
    this.sectores?.forEach(s => {
      console.log(s.name);
      console.log(name);
      console.log(this.sectorSeleccionado)
      if (s.name == name) {
        id = s.id
        console.log(s.id);
      }
    });
    return id;
  }

  isTouched(ix: number){
    this.touched[ix]=true;
  }

  getSizeId(name: string): number {
    let id = 0;
    this.sizes?.forEach(s => {
      if (s.name == name) {
        id = s.id
      }
    });
    return id;
  }

  getValue(name: string) {
    return this.form.get(name);
  }

  validatePhone(): boolean {
    return phoneValidate(this.getValue("phone")?.value);
  }

  validatePassword(): boolean {
    if (this.getValue("password")?.value.length <= 0) {
      this.r_password = "";
    }
    console.log(this.getValue("password")?.value + " " + this.r_password);
    return this.getValue("password")?.value == this.r_password;
  }

  register(): void {
    if(!this.validatePassword()){
      return;
    }
    if(!this.validatePhone()){
      return
    }
    if(this.form.invalid || this.sizeSeleccionado==null || this.sectorSeleccionado==null){
      alert("Hay campos incompletos"); 
      return;
    }
    let request: UserRegister = {
      name: this.getValue("name")?.value,
      lastname: this.getValue("lastname")?.value,
      position: this.getValue("position")?.value,
      company_name: this.getValue("company_name")?.value,
      company_sector_id: this.sectorSeleccionado?.id??0,
      company_size_id: this.sizeSeleccionado?.id??0,
      email: this.getValue("email")?.value,
      phone: this.getValue("phone")?.value,
      password: this.getValue("password")?.value
    }
    this.authService.createUser(request).subscribe({
      next: (value) => {
        alert("Usuario creado con exito")
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.log(err)
      }
    })

  }
}
