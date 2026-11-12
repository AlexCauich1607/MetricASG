import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { BenchmarkService } from './benchmark.service';
import { CompanyContextService } from './company-context.service';
import { BenchmarkResult } from '../models/benchmark';

describe('BenchmarkService', () => {
  let service: BenchmarkService;
  let httpMock: HttpTestingController;
  let companyContext: CompanyContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BenchmarkService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(BenchmarkService);
    httpMock = TestBed.inject(HttpTestingController);
    companyContext = TestBed.inject(CompanyContextService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request benchmark for selected company and methodology', () => {
    companyContext.selectedCompanyId.set(10);

    const expected: BenchmarkResult = {
      available: true,
      methodology_id: 3,
      global_average: 8.0,
      ambits: [
        {
          ambit_id: 1,
          name: 'Ambiental',
          letter: 'A',
          average: 7.5
        }
      ]
    };

    let result: BenchmarkResult | undefined;

    service.getBenchmark(3).subscribe(response => {
      result = response;
    });

    const request = httpMock.expectOne(req =>
      req.url === 'http://localhost:8000/api/benchmark'
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('company_id')).toBe('10');
    expect(request.request.params.get('methodology_id')).toBe('3');
    expect(request.request.params.has('sector_id')).toBeFalse();
    expect(request.request.params.has('size_id')).toBeFalse();

    request.flush(expected);

    expect(result).toEqual(expected);
  });

  it('should include sector and size filters when supplied', () => {
    companyContext.selectedCompanyId.set(10);

    service.getBenchmark(3, 5, 2).subscribe();

    const request = httpMock.expectOne(
      'http://localhost:8000/api/benchmark?company_id=10&methodology_id=3&sector_id=5&size_id=2'
    );

    expect(request.request.method).toBe('GET');

    request.flush({
      available: false,
      methodology_id: 3,
      global_average: null,
      ambits: []
    });
  });

  it('should reject requests without selected company', () => {
    companyContext.selectedCompanyId.set(null);

    let errorMessage: string | undefined;

    service.getBenchmark(3).subscribe({
      error: error => {
        errorMessage = error.message;
      }
    });

    expect(errorMessage).toBe('No hay una empresa seleccionada.');

    httpMock.expectNone(
      'http://localhost:8000/api/benchmark'
    );
  });

  it('should propagate HTTP errors', () => {
    companyContext.selectedCompanyId.set(10);

    let errorStatus: number | undefined;

    service.getBenchmark(3).subscribe({
      error: error => {
        errorStatus = error.status;
      }
    });

    const request = httpMock.expectOne(
      req => req.url === 'http://localhost:8000/api/benchmark'
    );

    request.flush(
      { detail: 'Active company membership required' },
      {
        status: 403,
        statusText: 'Forbidden'
      }
    );

    expect(errorStatus).toBe(403);
  });
});
