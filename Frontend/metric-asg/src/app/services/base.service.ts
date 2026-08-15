import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QueryOptions {
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export class BaseService<T> {
  protected apiUrl: string;

  constructor(
    protected http: HttpClient,
    endpoint: string
  ) {
    this.apiUrl = `http://localhost:8000/api/${endpoint}/`;
  }

  getAll(options?: QueryOptions): Observable<T[]> {
    let params = new HttpParams();

    if (options?.orderBy) {
      params = params.set('order_by', options.orderBy);
    }

    if (options?.orderDir) {
      params = params.set('order_dir', options.orderDir);
    }

    if (options?.filters) {
      params = params.set('filters', JSON.stringify(options.filters));
    }

    return this.http.get<T[]>(this.apiUrl, { params });
  }

  getById(id: number): Observable<T> {
    return this.http.get<T>(`${this.apiUrl}${id}`);
  }

  create(data: Partial<T>): Observable<T> {
    return this.http.post<T>(this.apiUrl, data);
  }

  update(id: number, data: Partial<T>): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.apiUrl}${id}`);
  }
}
