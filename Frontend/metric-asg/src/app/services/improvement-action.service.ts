
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ImprovementAction,
  ImprovementActionCreate,
  ImprovementActionUpdate
} from '../models/improvement_action';
import { ImprovementProgress } from '../models/improvement_progress';

@Injectable({
  providedIn: 'root'
})
export class ImprovementActionService {
  private readonly baseUrl =
    'http://localhost:8000/api/evaluations';

  constructor(private http: HttpClient) { }

  createAction(
    evaluationId: number,
    payload: ImprovementActionCreate
  ): Observable<ImprovementAction> {
    return this.http.post<ImprovementAction>(
      `${this.baseUrl}/${evaluationId}/improvement-actions`,
      payload
    );
  }

  getActions(
    evaluationId: number
  ): Observable<ImprovementAction[]> {
    return this.http.get<ImprovementAction[]>(
      `${this.baseUrl}/${evaluationId}/improvement-actions`
    );
  }

  getProgressMetrics(
    evaluationId: number
  ): Observable<ImprovementProgress> {
    return this.http.get<ImprovementProgress>(
      `${this.baseUrl}/${evaluationId}/improvement-actions/progress`
    );
  }

  getAction(
    evaluationId: number,
    actionId: number
  ): Observable<ImprovementAction> {
    return this.http.get<ImprovementAction>(
      `${this.baseUrl}/${evaluationId}/improvement-actions/${actionId}`
    );
  }

  updateAction(
    evaluationId: number,
    actionId: number,
    payload: ImprovementActionUpdate
  ): Observable<ImprovementAction> {
    return this.http.patch<ImprovementAction>(
      `${this.baseUrl}/${evaluationId}/improvement-actions/${actionId}`,
      payload
    );
  }

  deleteAction(
    evaluationId: number,
    actionId: number
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${evaluationId}/improvement-actions/${actionId}`
    );
  }
}
