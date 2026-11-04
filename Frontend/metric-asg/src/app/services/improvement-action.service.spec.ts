
import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ImprovementProgress } from '../models/improvement_progress';
import { ImprovementActionService } from './improvement-action.service';
import {
  ImprovementAction,
  ImprovementActionCreate
} from '../models/improvement_action';

describe('ImprovementActionService', () => {
  let service: ImprovementActionService;
  let httpMock: HttpTestingController;

  const evaluationId = 10;
  const actionId = 5;
  const baseUrl =
    `http://localhost:8000/api/evaluations/${evaluationId}/improvement-actions`;

  const action: ImprovementAction = {
    id: actionId,
    evaluation_id: evaluationId,
    indicator_id: null,
    gap_description: 'Consumo energético elevado',
    description: 'Implementar iluminación LED',
    priority: 'HIGH',
    responsible: 'Operaciones',
    target_date: '2026-12-15',
    status: 'PENDING',
    created_at: '2026-11-03T12:00:00Z',
    updated_at: '2026-11-03T12:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ImprovementActionService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(ImprovementActionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create an improvement action', () => {
    const payload: ImprovementActionCreate = {
      gap_description: action.gap_description,
      description: action.description,
      priority: action.priority,
      responsible: action.responsible,
      target_date: action.target_date
    };

    service.createAction(evaluationId, payload).subscribe(result => {
      expect(result).toEqual(action);
    });

    const request = httpMock.expectOne(baseUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);

    request.flush(action);
  });

  it('should list improvement actions', () => {
    service.getActions(evaluationId).subscribe(result => {
      expect(result).toEqual([action]);
    });

    const request = httpMock.expectOne(baseUrl);

    expect(request.request.method).toBe('GET');

    request.flush([action]);
  });

  it('should get an improvement action', () => {
    service.getAction(evaluationId, actionId).subscribe(result => {
      expect(result).toEqual(action);
    });

    const request = httpMock.expectOne(`${baseUrl}/${actionId}`);

    expect(request.request.method).toBe('GET');

    request.flush(action);
  });

  it('should update an improvement action', () => {
    const payload = {
      status: 'IN_PROGRESS' as const
    };

    service.updateAction(
      evaluationId,
      actionId,
      payload
    ).subscribe(result => {
      expect(result.status).toBe('IN_PROGRESS');
    });

    const request = httpMock.expectOne(`${baseUrl}/${actionId}`);

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(payload);

    request.flush({
      ...action,
      status: 'IN_PROGRESS'
    });
  });

  it('should delete an improvement action', () => {
    service.deleteAction(evaluationId, actionId).subscribe(result => {
      expect(result).toBeNull();
    });

    const request = httpMock.expectOne(`${baseUrl}/${actionId}`);

    expect(request.request.method).toBe('DELETE');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should get improvement progress metrics', () => {
    const progress: ImprovementProgress = {
      evaluation_id: evaluationId,
      total: 5,
      pending: 1,
      in_progress: 1,
      completed: 2,
      cancelled: 1,
      progress_percentage: 50.0
    };

    service.getProgressMetrics(evaluationId).subscribe(result => {
      expect(result).toEqual(progress);
    });

    const request = httpMock.expectOne(`${baseUrl}/progress`);

    expect(request.request.method).toBe('GET');

    request.flush(progress);
  });

});
