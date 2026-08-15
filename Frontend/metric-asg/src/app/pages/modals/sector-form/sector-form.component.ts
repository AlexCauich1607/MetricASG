import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CompanySectorService } from '../../../services/company-sector.service';
import { CompanySector } from '../../../models/company_sector';

@Component({
  selector: 'app-sector-form',
  standalone: false,
  templateUrl: './sector-form.component.html',
  styleUrl: './sector-form.component.scss'
})
export class SectorFormComponent {
  form: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SectorFormComponent>,
    private sectorService: CompanySectorService,
    @Inject(MAT_DIALOG_DATA) public data: { sector?: CompanySector }
  ) {
    this.form = this.fb.group({
      name: [data.sector?.name || '', [Validators.required, Validators.minLength(3)]],
    });
  }

  loading = false;

  ngOnInit(): void {

  }

  save(): void {
    if (this.data.sector) {
      this.update();
    } else {
      this.create();
    }
  }
  create() {
    this.saving = true;

    const payload: CompanySector = {
      ...this.form.value
    };
    this.sectorService.create(payload).subscribe({
      next: (created) => {
        this.dialogRef.close(created);
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
      }
    });
  }

  update() {
    this.saving = true;

    const payload: CompanySector = {
      ...this.form.value
    };
    const id = this.data.sector ? this.data.sector.id : 0;
    this.sectorService.update(id, payload).subscribe({
      next: (data) => {
        this.dialogRef.close();
      },
      error: (err) => {
        console.log(err);
      }
    })


  }
  delete() {
    if (confirm('¿Desea eliminar este Sector?')) {
      this.sectorService.delete(this.data.sector ? this.data.sector.id : 0).subscribe({
        next: (data) => {
          this.dialogRef.close();
        }, error: (err) => {
          console.error(err);
        }
      })
    }

  }

  close(): void {
    this.dialogRef.close(null);
  }

  getValue(name: string) {
    return this.form.get(name);
  }


}
