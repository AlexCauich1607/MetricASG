import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withXhr
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { EvaluationService } from './evaluation.service';

describe('EvaluationService', () => {
  let service: EvaluationService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting()
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
    expect(request.request.body).toEqual(payload);

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
    expect(request.request.body).toEqual(payload);

    request.flush({ success: true });
  });

  it('should get the last evaluation result', () => {

    service.getLastEvaluationResult().subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      `http://localhost:8000/api/evaluations/results/me`
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });

  it('should get the evaluation history', () => {

    service.getEvaluationHistory().subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      `http://localhost:8000/api/evaluations/history/me`
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

    request.flush(mockResponse);
  });

});