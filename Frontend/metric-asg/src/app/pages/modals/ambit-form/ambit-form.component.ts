import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AmbitService } from '../../../services/ambit.service';
import { Ambit } from '../../../models/ambit';

@Component({
  selector: 'app-ambit-form',
  standalone: false,
  templateUrl: './ambit-form.component.html',
  styleUrl: './ambit-form.component.scss'
})
export class AmbitFormComponent {
  form: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AmbitFormComponent>,
    private ambitService: AmbitService,
    @Inject(MAT_DIALOG_DATA) public data?: Ambit
  ) {
    this.form = this.fb.group({
      name: [data?.name || '', [Validators.required, Validators.minLength(3)]],
      letter: [data?.letter || "", [Validators.required, Validators.minLength(1), Validators.maxLength(1)]],
      description: "",
      is_removable: true,
      color: [data?.color || '#000000', Validators.required],
    });
  }

  save(): void {
    if(this.form.invalid){
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;

    const result: Ambit = {
      ...this.form.value
    };
    this.dialogRef.close(result);

  }

  close(): void {
    this.dialogRef.close(null);
  }
  getValue(name: string) {
    return this.form.get(name);
  }
}
