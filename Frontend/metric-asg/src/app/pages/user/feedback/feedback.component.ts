import { Component } from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { SessionService } from '../../../shared/class/temporalStorage';

@Component({
  selector: 'app-feedback',
  standalone: false,
  templateUrl: './feedback.component.html',
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
    this.evaluationService.getLastEvaluationResult(this.id).subscribe({
      next: (value) => {
        this.results = value;
      }, error: (err) => {
        console.log(err);
      }
    });
  }

}
