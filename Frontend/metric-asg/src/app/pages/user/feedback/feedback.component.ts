import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { SessionService } from '../../../shared/class/temporalStorage';
import { FeedbackComponent as FeedbackCardComponent } from '../../../shared/feedback/feedback.component';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    FeedbackCardComponent
  ],
  templateUrl: './feedback.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './feedback.component.scss'
})

export class FeedbackComponent {
  id : number = SessionService.getSessionItem('id') ?? 0;
  results: ResultEvaluation | null = null;
  constructor(private evaluationService: EvaluationService) {

  }
  ngOnInit(): void {
    this.loadFeedbacks();
  }

  loadFeedbacks() {
    this.evaluationService.getLastEvaluationResult().subscribe({
      next: (value) => {
        this.results = value;
      }, error: (err) => {
        console.log(err);
      }
    });
  }

}
