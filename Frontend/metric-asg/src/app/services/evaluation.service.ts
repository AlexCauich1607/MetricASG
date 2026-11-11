import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Evaluation } from '../models/evaluation';
import { BaseService } from './base.service';
import { EvaluationStructure } from '../models/evaluation_structure';
import { Observable, throwError } from 'rxjs';
import { EvaluationSubmitPayload } from '../models/evaluation_submit';
import { ResultEvaluation } from '../models/evaluation_result';
import { EvaluationHistory } from '../models/history_evaluations';
import { EvaluationDraft } from '../models/evaluation_draft';
import { EvaluationDraftResponse } from '../models/evaluation_draft_response';
import { EvaluationComparison } from '../models/evaluation_comparison';
import { EvaluationDashboard } from '../models/evaluation_dashboard';
import { CompanyContextService } from './company-context.service';

@Injectable({
  providedIn: 'root'
})
export class EvaluationService extends BaseService<Evaluation> {
  endpoint = 'evaluations';
  constructor(
    http: HttpClient,
    private companyContext: CompanyContextService
  ) {
    super(http, 'evaluations');
  }
  getEvaluation(): Observable<EvaluationStructure> {
    return this.http.get<EvaluationStructure>(`http://localhost:8000/api/${this.endpoint}/structure/all`);
  }
  saveDraft(
    payload: EvaluationSubmitPayload
  ): Observable<EvaluationDraftResponse> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    return this.http.post<EvaluationDraftResponse>(
      'http://localhost:8000/api/evaluations/draft',
      {
        ...payload,
        company_id: companyId
      }
    );
  }


  getDraft(): Observable<EvaluationDraft | null> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    return this.http.get<EvaluationDraft | null>(
      'http://localhost:8000/api/evaluations/draft',
      {
        params: {
          company_id: companyId
        }
      }
    );
  }

  submitEvaluation(
    payload: EvaluationSubmitPayload
  ): Observable<any> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    return this.http.post(
      'http://localhost:8000/api/evaluations/submit',
      {
        ...payload,
        company_id: companyId
      }
    );
  }
  getLastEvaluationResult(): Observable<ResultEvaluation> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    return this.http.get<ResultEvaluation>(
      'http://localhost:8000/api/evaluations/results/me',
      {
        params: {
          company_id: companyId
        }
      }
    );
  }
  getEvaluationResultById(
    evaluationId: number
  ): Observable<ResultEvaluation> {
    return this.http.get<ResultEvaluation>(
      `http://localhost:8000/api/${this.endpoint}/${evaluationId}/results`
    );
  }
  getEvaluationHistory(): Observable<EvaluationHistory> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    return this.http.get<EvaluationHistory>(
      'http://localhost:8000/api/evaluations/history/me',
      {
        params: {
          company_id: companyId
        }
      }
    );
  }


  getEvaluationComparison(
    evaluationId1: number,
    evaluationId2: number
  ): Observable<EvaluationComparison> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    return this.http.get<EvaluationComparison>(
      `http://localhost:8000/api/${this.endpoint}/compare`,
      {
        params: {
          evaluation_id_1: evaluationId1,
          evaluation_id_2: evaluationId2,
          company_id: companyId
        }
      }
    );
  }


  getHistoricalDashboard(): Observable<EvaluationDashboard> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    return this.http.get<EvaluationDashboard>(
      `http://localhost:8000/api/${this.endpoint}/dashboard/history/me`,
      {
        params: {
          company_id: companyId
        }
      }
    );
  }

  private getSelectedCompanyId(): number {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      throw new Error('No hay una empresa seleccionada.');
    }

    return companyId;
  }
}
