import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import { BenchmarkResult } from '../models/benchmark';
import { CompanyContextService } from './company-context.service';

@Injectable({
  providedIn: 'root'
})
export class BenchmarkService {
  private readonly endpoint = 'http://localhost:8000/api/benchmark';

  constructor(
    private http: HttpClient,
    private companyContext: CompanyContextService
  ) {}

  getBenchmark(
    methodologyId: number,
    sectorId?: number,
    sizeId?: number
  ): Observable<BenchmarkResult> {
    const companyId = this.companyContext.selectedCompanyId();

    if (companyId === null) {
      return throwError(
        () => new Error('No hay una empresa seleccionada.')
      );
    }

    let params = new HttpParams()
      .set('company_id', companyId)
      .set('methodology_id', methodologyId);

    if (sectorId !== undefined) {
      params = params.set('sector_id', sectorId);
    }

    if (sizeId !== undefined) {
      params = params.set('size_id', sizeId);
    }

    return this.http.get<BenchmarkResult>(
      this.endpoint,
      { params }
    );
  }
}
