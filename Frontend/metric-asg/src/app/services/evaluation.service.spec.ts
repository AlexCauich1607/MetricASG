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
    const id = 15;

    service.getLastEvaluationResult(id).subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      `http://localhost:8000/api/evaluations/results/${id}`
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });

  it('should get the evaluation history', () => {
    const id = 15;

    service.getEvaluationHistory(id).subscribe(response => {
      expect(response).toBeTruthy();
    });

    const request = httpTestingController.expectOne(
      `http://localhost:8000/api/evaluations/history/${id}`
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });
});