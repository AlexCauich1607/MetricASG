import {
  Component,
  OnInit,
  ChangeDetectorRef,
  DestroyRef,
  Injector
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationComparison } from '../../../models/evaluation_comparison';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CompanyContextService } from '../../../services/company-context.service';

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
  private comparisonRequest?: Subscription;
  private initialCompanyId: number | null = null;
  private comparisonInvalidated = false;

  constructor(
    private route: ActivatedRoute,
    private evaluationService: EvaluationService,
    private cdr: ChangeDetectorRef,
    private companyContext: CompanyContextService,
    private destroyRef: DestroyRef,
    private injector: Injector
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

    toObservable(this.companyContext.selectedCompanyId, {
      injector: this.injector
    })
      .pipe(takeUntilDestroyed(this.destroyRef))

      .subscribe(companyId => {
        if (this.comparisonInvalidated) {
          return;
        }

        // Esperar a que exista un contexto empresarial.
        if (this.initialCompanyId === null) {
          if (companyId === null) {
            return;
          }

          this.initialCompanyId = companyId;
          this.loadComparison(evaluationId1, evaluationId2);
          return;
        }

        // Cualquier cambio respecto a la empresa inicial
        // invalida permanentemente esta comparación.
        if (companyId !== this.initialCompanyId) {
          this.comparisonInvalidated = true;

          this.clearComparisonState();

          this.error =
            'La empresa seleccionada cambió. Selecciona nuevamente las evaluaciones desde el historial.';

          this.cdr.markForCheck();
        }
      });
  }


  private clearComparisonState(): void {
    // Cancelar una consulta pendiente.
    this.comparisonRequest?.unsubscribe();

    // Eliminar los resultados anteriores.
    this.comparison = null;
    this.loading = false;
    this.error = null;
  }


  loadComparison(evaluationId1: number, evaluationId2: number): void {
    this.comparisonRequest?.unsubscribe();

    this.loading = true;
    this.error = null;
    this.comparison = null;

    this.comparisonRequest = this.evaluationService.getEvaluationComparison(
      evaluationId1,
      evaluationId2
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
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
