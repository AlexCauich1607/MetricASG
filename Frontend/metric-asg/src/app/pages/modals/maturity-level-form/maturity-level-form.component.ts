import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaturityLevel } from '../../../models/maturity_level';
import { MaturityLevelService } from '../../../services/maturity-level.service';


@Component({
  selector: 'app-maturity-level-form',
  standalone: false,
  templateUrl: './maturity-level-form.component.html',
  styleUrl: './maturity-level-form.component.scss'
})
export class MaturityLevelFormComponent {

  form: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<MaturityLevelFormComponent>,
    private levelService: MaturityLevelService,
    @Inject(MAT_DIALOG_DATA) public data?: MaturityLevel
  ) {
    this.form = this.fb.group({
      name: [data?.name || '',[ Validators.required, Validators.minLength(3)]],
      value: [data?.value || 0,[ Validators.required, Validators.minLength(1)]],
      color: [data?.color || '#ffffff', Validators.required],
      is_removable: true,
      min_score: [data?.min_score || 0, [Validators.required, Validators.minLength(1)]],
      max_score: [data?.max_score || 0, [Validators.required, Validators.minLength(1)]]
    });
  }

  save(): void {

    if (this.getValue("name")?.value.length > 3) {
      this.saving = true;

      const payload: MaturityLevel = {
        ...this.form.value
      };

      this.levelService.create(payload).subscribe({
        next: (created) => {
          this.dialogRef.close(created);
        },
        error: (err) => {
          console.error(err);
          this.saving = false;
        }
      });
    }
  }

  close(): void {
    this.dialogRef.close(null);
  }

  getValue(name: string){
    return this.form.get(name);
  }
}
