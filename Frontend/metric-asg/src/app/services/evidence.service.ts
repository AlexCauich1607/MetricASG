
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  EvaluationEvidence,
  EvidenceCreateRequest
} from '../models/evaluation_evidence';

@Injectable({
  providedIn: 'root'
})
export class EvidenceService {
  private readonly baseUrl =
    'http://localhost:8000/api/evaluations';

  constructor(private http: HttpClient) { }

  createEvidence(
    evaluationId: number,
    payload: EvidenceCreateRequest
  ): Observable<EvaluationEvidence> {
    return this.http.post<EvaluationEvidence>(
      `${this.baseUrl}/${evaluationId}/evidences`,
      payload
    );
  }

  getEvidences(
    evaluationId: number,
    indicatorId?: number
  ): Observable<EvaluationEvidence[]> {
    let params = new HttpParams();

    if (indicatorId !== undefined) {
      params = params.set('indicator_id', indicatorId);
    }

    return this.http.get<EvaluationEvidence[]>(
      `${this.baseUrl}/${evaluationId}/evidences`,
      { params }
    );
  }

  getEvidence(
    evaluationId: number,
    evidenceId: number
  ): Observable<EvaluationEvidence> {
    return this.http.get<EvaluationEvidence>(
      `${this.baseUrl}/${evaluationId}/evidences/${evidenceId}`
    );
  }

  uploadEvidence(
    evaluationId: number,
    indicatorId: number,
    file: File
  ): Observable<EvaluationEvidence> {
    const formData = new FormData();

    formData.append('indicator_id', String(indicatorId));
    formData.append('file', file, file.name);

    return this.http.post<EvaluationEvidence>(
      `${this.baseUrl}/${evaluationId}/evidences/upload`,
      formData
    );
  }

  downloadEvidence(
    evaluationId: number,
    evidenceId: number
  ): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/${evaluationId}/evidences/${evidenceId}/download`,
      {
        responseType: 'blob'
      }
    );
  }


  deleteEvidence(
    evaluationId: number,
    evidenceId: number
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${evaluationId}/evidences/${evidenceId}`
    );
  }
}
