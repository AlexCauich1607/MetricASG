import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withXhr
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { CompanyContextService } from './company-context.service';
import { EvaluationService } from './evaluation.service';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let httpTestingController: HttpTestingController;
  let selectedCompanyId = signal<number | null>(3);

  beforeEach(() => {
    selectedCompanyId = signal<number | null>(3);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {
          provide: CompanyContextService,
          useValue: {
            selectedCompanyId
          }
        }
      ]
    });

    service = TestBed.inject(EvaluationService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get the evaluation structure', () => {
    service.getEvaluation().subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      'http://localhost:8000/api/evaluations/structure/all'
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });

  it('should save an evaluation draft', () => {
    const payload = {
      responses: [
        {
          indicator_id: 1,
          indicator_answer_id: 2
        }
      ]
    };

    service.saveDraft(payload).subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      'http://localhost:8000/api/evaluations/draft'
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ...payload,
      company_id: 3
    });

    request.flush({ success: true });
  });

  it('should submit an evaluation', () => {
    const payload = {
      responses: [
        {
          indicator_id: 1,
          indicator_answer_id: 2
        },
        {
          indicator_id: 3,
          indicator_answer_id: 4
        }
      ]
    };

    service.submitEvaluation(payload).subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      'http://localhost:8000/api/evaluations/submit'
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      ...payload,
      company_id: 3
    });

    request.flush({ success: true });
  });

  it('should get the last evaluation result', () => {

    service.getLastEvaluationResult().subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      req =>
        req.url === 'http://localhost:8000/api/evaluations/results/me' &&
        req.params.get('company_id') === '3'
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });

  it('should get the evaluation history', () => {

    service.getEvaluationHistory().subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      req =>
        req.url === 'http://localhost:8000/api/evaluations/history/me' &&
        req.params.get('company_id') === '3'
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });

  it('should get the comparison of two evaluations', () => {
    const evaluationId1 = 12;
    const evaluationId2 = 15;

    const mockResponse = {
      comparable: true,
      warning: null,
      evaluations: [
        {
          evaluation_id: evaluationId1,
          date: '2026-09-10T12:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 7.5,
          ambits: []
        },
        {
          evaluation_id: evaluationId2,
          date: '2026-10-20T12:00:00',
          methodology_id: 1,
          methodology_version: '1.0',
          global_score: 8.5,
          ambits: []
        }
      ],
      differences: {
        global_score: 1.0,
        ambits: []
      }
    };

    service.getEvaluationComparison(
      evaluationId1,
      evaluationId2
    ).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const request = httpTestingController.expectOne(
      req => req.url ===
        'http://localhost:8000/api/evaluations/compare'
    );

    expect(request.request.method).toBe('GET');

    expect(
      request.request.params.get('evaluation_id_1')
    ).toBe('12');

    expect(
      request.request.params.get('evaluation_id_2')
    ).toBe('15');

    expect(
      request.request.params.get('company_id')
    ).toBe('3');

    request.flush(mockResponse);
  });
  it('should get evaluation results by ID', () => {
    const evaluationId = 12;

    const mockResponse = {
      evaluation_id: evaluationId,
      date: '2026-10-20T12:00:00',
      global_score: 8,
      global_maturity_level: 'Intermedio',
      ambits: [
        {
          ambit_id: 1,
          ambit_name: 'Ambiental',
          score: 8,
          letter: 'A',
          color: '#37AB48',
          maturity_level: 'Intermedio',
          maturity_color: '#13b46e',
          feedback: 'Mantener las prácticas ambientales.'
        }
      ]
    };

    service.getEvaluationResultById(evaluationId).subscribe(response => {
      expect(response).toEqual(mockResponse);
      expect(response.evaluation_id).toBe(evaluationId);
      expect(response.global_score).toBe(8);
      expect(response.ambits.length).toBe(1);
    });

    const request = httpTestingController.expectOne(
      `http://localhost:8000/api/evaluations/${evaluationId}/results`
    );

    expect(request.request.method).toBe('GET');

    request.flush(mockResponse);
  });

  it('should use the newly selected company when submitting', () => {
    const payload = {
      responses: [
        {
          indicator_id: 1,
          indicator_answer_id: 2
        }
      ]
    };

    selectedCompanyId.set(7);

    service.submitEvaluation(payload).subscribe();

    const request = httpTestingController.expectOne(
      'http://localhost:8000/api/evaluations/submit'
    );

    expect(request.request.method).toBe('POST');

    expect(request.request.body).toEqual({
      ...payload,
      company_id: 7
    });

    request.flush({ success: true });
  });

  it('should reject evaluation writes without a selected company', () => {
    const payload = {
      responses: [
        {
          indicator_id: 1,
          indicator_answer_id: 2
        }
      ]
    };

    selectedCompanyId.set(null);

    let errors = 0;

    service.saveDraft(payload).subscribe({
      next: () => fail('Draft should not be saved'),
      error: error => {
        expect(error.message).toBe('No hay una empresa seleccionada.');
        errors++;
      }
    });

    service.submitEvaluation(payload).subscribe({
      next: () => fail('Evaluation should not be submitted'),
      error: error => {
        expect(error.message).toBe('No hay una empresa seleccionada.');
        errors++;
      }
    });

    expect(errors).toBe(2);

    httpTestingController.expectNone(
      'http://localhost:8000/api/evaluations/draft'
    );

    httpTestingController.expectNone(
      'http://localhost:8000/api/evaluations/submit'
    );
  });

  it('should get the draft for the selected company', () => {
    selectedCompanyId.set(3);

    service.getDraft().subscribe(response => {
      expect(response).toBeNull();
    });

    const request = httpTestingController.expectOne(
      req =>
        req.url === 'http://localhost:8000/api/evaluations/draft' &&
        req.params.get('company_id') === '3'
    );

    expect(request.request.method).toBe('GET');

    request.flush(null);
  });

  it('should reject draft queries without a selected company', () => {
    selectedCompanyId.set(null);

    service.getDraft().subscribe({
      next: () => fail('Draft query should not succeed'),
      error: error => {
        expect(error.message).toBe(
          'No hay una empresa seleccionada.'
        );
      }
    });

    httpTestingController.expectNone(
      'http://localhost:8000/api/evaluations/draft'
    );
  });

  it('should get the historical dashboard for the selected company', () => {
    selectedCompanyId.set(3);

    service.getHistoricalDashboard().subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      req =>
        req.url ===
        'http://localhost:8000/api/evaluations/dashboard/history/me' &&
        req.params.get('company_id') === '3'
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });

});