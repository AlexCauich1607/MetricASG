import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Evaluation } from '../models/evaluation';
import { BaseService } from './base.service';
import { EvaluationStructure } from '../models/evaluation_structure';
import { Observable } from 'rxjs';
import { EvaluationSubmitPayload } from '../models/evaluation_submit';
import { ResultEvaluation } from '../models/evaluation_result';
import { EvaluationHistory } from '../models/history_evaluations';

@Injectable({
  providedIn: 'root'
})
export class EvaluationService extends BaseService<Evaluation> {
  endpoint = 'evaluations';
  constructor(http: HttpClient) {
    super(http, 'evaluations');
  }
  getEvaluation(): Observable<EvaluationStructure> {
    return this.http.get<EvaluationStructure>(`http://localhost:8000/api/${this.endpoint}/structure/all`);
  }

  submitEvaluation(payload: EvaluationSubmitPayload): Observable<any> {
    return this.http.post(
      `http://localhost:8000/api/evaluations/submit`,
      payload
    );
  }
  getLastEvaluationResult(id: number): Observable<ResultEvaluation> {
    return this.http.get<ResultEvaluation>(
      `http://localhost:8000/api/evaluations/results/${id}`,
    );
  }
  getEvaluationHistory(id: number): Observable<EvaluationHistory> {
    return this.http.get<EvaluationHistory>(
      `http://localhost:8000/api/evaluations/history/${id}`,
    );
  }
}
