import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { finalize, forkJoin } from 'rxjs';

import {
  CompanyCreateRequest,
  CompanyCreateResponse
} from '../../../models/company_membership';

import { CompanySector } from '../../../models/company_sector';
import { CompanySize } from '../../../models/company_size';

import { CompanyMembershipService } from '../../../services/company-membership.service';
import { CompanySectorService } from '../../../services/company-sector.service';
import { CompanySizeService } from '../../../services/company-size.service';

@Component({
  selector: 'app-create-company',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './create-company.component.html',
  styleUrl: './create-company.component.scss'
})
export class CreateCompanyComponent implements OnInit {
  @ViewChild('companyNameInput')
  companyNameInput?: ElementRef<HTMLInputElement>;

  readonly form;

  sectors: CompanySector[] = [];
  sizes: CompanySize[] = [];

  loadingCatalogs = false;
  saving = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateCompanyComponent>,
    private membershipService: CompanyMembershipService,
    private sectorService: CompanySectorService,
    private sizeService: CompanySizeService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      sector_id: [null as number | null],
      size_id: [null as number | null]
    });
  }

  ngOnInit(): void {
    this.loadCatalogs();
  }

  loadCatalogs(): void {
    this.loadingCatalogs = true;

    forkJoin({
      sectors: this.sectorService.getAll(),
      sizes: this.sizeService.getAll()
    })
      .pipe(finalize(() => {
        this.loadingCatalogs = false;
      }))
      .subscribe({
        next: ({ sectors, sizes }) => {
          this.sectors = sectors;
          this.sizes = sizes;
        },
        error: () => {
          this.errorMessage =
            'No se pudieron cargar los catálogos. Puedes crear la empresa únicamente con su nombre.';
        }
      });
  }

  save(): void {
    if (this.saving) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.companyNameInput?.nativeElement.focus();
      return;
    }

    const name = this.form.controls.name.value?.trim() ?? '';

    if (name.length < 3) {
      this.form.controls.name.setErrors({ minlength: true });
      this.form.controls.name.markAsTouched();
      this.companyNameInput?.nativeElement.focus();
      return;
    }

    const payload: CompanyCreateRequest = { name };

    const sectorId = this.form.controls.sector_id.value;
    const sizeId = this.form.controls.size_id.value;

    if (sectorId !== null) {
      payload.sector_id = sectorId;
    }

    if (sizeId !== null) {
      payload.size_id = sizeId;
    }

    this.saving = true;
    this.errorMessage = '';

    this.membershipService.createCompany(payload)
      .pipe(finalize(() => {
        this.saving = false;
      }))
      .subscribe({
        next: (company: CompanyCreateResponse) => {
          this.dialogRef.close(company);
        },
        error: () => {
          this.errorMessage =
            'No fue posible crear la empresa. Verifica los datos e inténtalo nuevamente.';
        }
      });
  }

  close(): void {
    if (!this.saving) {
      this.dialogRef.close(null);
    }
  }
}