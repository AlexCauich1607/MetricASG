import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FeedbackAmbitService } from '../../../services/feedback-ambit.service';
import { FeedbackAmbit } from '../../../models/feedback_ambit';

@Component({
  selector: 'app-feedbacks-form',
  standalone: false,
  templateUrl: './feedbacks-form.component.html',
  styleUrl: './feedbacks-form.component.scss'
})
export class FeedbacksFormComponent {
  form: FormGroup;
  saving = false;
  feedback_id = 0;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<FeedbacksFormComponent>,
    private feedbackService: FeedbackAmbitService,
     @Inject(MAT_DIALOG_DATA) public data: { id: number; nivel: number, name: string }
  ) {
    this.form = this.fb.group({
      text: ['', Validators.required],
    });
  }
  ngOnInit(): void {
    this.loadFeedback();
  }

  loadFeedback(){
    let filtros = {
      ambit_id: this.data.id,
      maturity_level_id: this.data.nivel,
    };
    this.feedbackService.getAll({filters:filtros}).subscribe({
      next:(data)=>{
        let feedback = data[0];
        this.feedback_id = feedback.id;
        this.form.get('text')?.setValue(feedback.text);
      },
      error: (err) =>{

      }
    })
  }

  save(): void {
      this.saving = true;
      this.feedbackService.update(this.feedback_id, {text:  this.form.get('text')?.value}).subscribe(
        {
          next:(data) =>{

          },
          error:(err) =>{

          }
        }
      );
      this.dialogRef.close();
    }
  
    close(): void {
      this.dialogRef.close(null);
    }
  
}
