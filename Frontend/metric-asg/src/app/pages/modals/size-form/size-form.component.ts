import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CompanySizeService } from '../../../services/company-size.service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CompanySize } from '../../../models/company_size';

@Component({
  selector: 'app-size-form',
  standalone: false,
  templateUrl: './size-form.component.html',
  styleUrl: './size-form.component.scss'
})
export class SizeFormComponent {
  form: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<SizeFormComponent>,
    private sizeService: CompanySizeService,
    @Inject(MAT_DIALOG_DATA) public data: { size?: CompanySize }
  ) {
    this.form = this.fb.group({
      name: [data.size?.name || '', [Validators.required, Validators.minLength(3)]],
    });
  }

  loading = false;

  ngOnInit(): void {

  }

  save(): void {
    if (this.data.size) {
      this.update();
    } else {
      this.create();
    }
  }
  create() {
    this.saving = true;

    const payload: CompanySize = {
      ...this.form.value
    };
    this.sizeService.create(payload).subscribe({
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

    const payload: CompanySize = {
      ...this.form.value
    };
    const id = this.data.size ? this.data.size.id : 0;
    this.sizeService.update(id, payload).subscribe({
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
      this.sizeService.delete(this.data.size ? this.data.size.id : 0).subscribe({
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
