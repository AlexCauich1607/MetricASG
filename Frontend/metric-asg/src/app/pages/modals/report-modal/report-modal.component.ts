import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { PdfReportTemplateComponent } from '../../../shared/pdf-template/pdf-template.component';

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [
    PdfReportTemplateComponent
  ],
  templateUrl: './report-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './report-modal.component.scss'
})
export class ReportModalComponent {

  constructor(
    private dialogRef: MatDialogRef<ReportModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      name: string;
      results: ResultEvaluation
    }
  ) {
  }

  loading = false;

  ngOnInit() {
    this.dialogRef.updateSize('800px', '500px');
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
