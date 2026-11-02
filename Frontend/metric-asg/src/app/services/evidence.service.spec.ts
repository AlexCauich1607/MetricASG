
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { EvidenceService } from './evidence.service';
import {
  EvaluationEvidence,
  EvidenceCreateRequest
} from '../models/evaluation_evidence';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let httpMock: HttpTestingController;

  const evaluationId = 10;
  const indicatorId = 5;

  const baseUrl =
    `http://localhost:8000/api/evaluations/${evaluationId}/evidences`;

  const mockEvidence: EvaluationEvidence = {
    id: 1,
    evaluation_id: evaluationId,
    indicator_id: indicatorId,
    type: 'COMMENT',
    content: 'Evidencia de prueba',
    original_filename: null,
    mime_type: null,
    file_size: null,
    created_at: '2026-10-23T12:00:00',
    updated_at: '2026-10-23T12:00:00'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EvidenceService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(EvidenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create evidence using POST', () => {
    const payload: EvidenceCreateRequest = {
      indicator_id: indicatorId,
      type: 'COMMENT',
      content: 'Evidencia de prueba'
    };

    service.createEvidence(evaluationId, payload).subscribe(
      evidence => {
        expect(evidence).toEqual(mockEvidence);
      }
    );

    const request = httpMock.expectOne(baseUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);

    request.flush(mockEvidence);
  });

  it('should list all evidences using GET', () => {
    service.getEvidences(evaluationId).subscribe(
      evidences => {
        expect(evidences).toEqual([mockEvidence]);
      }
    );

    const request = httpMock.expectOne(baseUrl);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('indicator_id')).toBeFalse();

    request.flush([mockEvidence]);
  });

  it('should filter evidences by indicator', () => {
    service.getEvidences(evaluationId, indicatorId).subscribe(
      evidences => {
        expect(evidences).toEqual([mockEvidence]);
      }
    );

    const request = httpMock.expectOne(
      req =>
        req.url === baseUrl &&
        req.params.get('indicator_id') === String(indicatorId)
    );

    expect(request.request.method).toBe('GET');

    request.flush([mockEvidence]);
  });

  it('should get a specific evidence using GET', () => {
    service.getEvidence(evaluationId, mockEvidence.id).subscribe(
      evidence => {
        expect(evidence).toEqual(mockEvidence);
      }
    );

    const request = httpMock.expectOne(
      `${baseUrl}/${mockEvidence.id}`
    );

    expect(request.request.method).toBe('GET');

    request.flush(mockEvidence);
  });

  it('should delete evidence using DELETE', () => {
    service.deleteEvidence(evaluationId, mockEvidence.id).subscribe(
      response => {
        expect(response).toBeNull();
      }
    );

    const request = httpMock.expectOne(
      `${baseUrl}/${mockEvidence.id}`
    );

    expect(request.request.method).toBe('DELETE');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should upload file evidence using multipart form data', () => {
    const file = new File(
      ['PDF content'],
      'evidencia.pdf',
      { type: 'application/pdf' }
    );

    const fileEvidence: EvaluationEvidence = {
      ...mockEvidence,
      id: 2,
      type: 'FILE',
      content: null,
      original_filename: 'evidencia.pdf',
      mime_type: 'application/pdf',
      file_size: file.size
    };

    service.uploadEvidence(
      evaluationId,
      indicatorId,
      file
    ).subscribe(evidence => {
      expect(evidence).toEqual(fileEvidence);
    });

    const request = httpMock.expectOne(
      `${baseUrl}/upload`
    );

    expect(request.request.method).toBe('POST');

    const body = request.request.body as FormData;

    expect(body instanceof FormData).toBeTrue();
    expect(body.get('indicator_id')).toBe(String(indicatorId));

    const uploadedFile = body.get('file') as File;

    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.name).toBe(file.name);
    expect(uploadedFile.size).toBe(file.size);
    expect(uploadedFile.type).toBe(file.type);


    expect(
      request.request.headers.has('Content-Type')
    ).toBeFalse();

    request.flush(fileEvidence);
  });

  it('should download file evidence as a blob', () => {
    const evidenceId = 2;

    const fileContent = new Blob(
      ['PDF content'],
      { type: 'application/pdf' }
    );

    service.downloadEvidence(
      evaluationId,
      evidenceId
    ).subscribe(blob => {
      expect(blob).toBe(fileContent);
    });

    const request = httpMock.expectOne(
      `${baseUrl}/${evidenceId}/download`
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');

    request.flush(fileContent);
  });

});
