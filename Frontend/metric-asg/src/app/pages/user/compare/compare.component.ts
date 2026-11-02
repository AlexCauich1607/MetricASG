
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationComparison } from '../../../models/evaluation_comparison';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-compare',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.scss'
})
export class CompareComponent implements OnInit {
  comparison: EvaluationComparison | null = null;
  loading = false;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private evaluationService: EvaluationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    const evaluationId1 = Number(
      this.route.snapshot.queryParamMap.get('evaluation_id_1')
    );

    const evaluationId2 = Number(
      this.route.snapshot.queryParamMap.get('evaluation_id_2')
    );

    if (
      !Number.isSafeInteger(evaluationId1) ||
      !Number.isSafeInteger(evaluationId2) ||
      evaluationId1 <= 0 ||
      evaluationId2 <= 0 ||
      evaluationId1 === evaluationId2
    ) {
      this.error = 'Selecciona dos evaluaciones diferentes para compararlas.';
      return;
    }

    this.loadComparison(evaluationId1, evaluationId2);
  }


  loadComparison(evaluationId1: number, evaluationId2: number): void {
    this.loading = true;
    this.error = null;
    this.comparison = null;

    this.evaluationService.getEvaluationComparison(
      evaluationId1,
      evaluationId2
    ).subscribe({
      next: (response) => {
        this.comparison = response;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'No fue posible obtener la comparación de evaluaciones.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getAmbitScore(
    evaluationIndex: number,
    ambitId: number
  ): number | null {
    const evaluation = this.comparison?.evaluations[evaluationIndex];

    if (!evaluation) {
      return null;
    }

    return evaluation.ambits.find(
      ambit => ambit.ambit_id === ambitId
    )?.score ?? null;
  }
}
