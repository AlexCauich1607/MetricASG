import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AllUsers, Sumary } from '../models/admin';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

   private apiUrl = `http://localhost:8000/api/admin`;

  constructor(protected http: HttpClient) { }

  getSummary(): Observable<Sumary> {
    return this.http.get<Sumary>(`${this.apiUrl}/summary`);
  }
  getAllUsers(): Observable<AllUsers> {
    return this.http.get<AllUsers>(`${this.apiUrl}/users`);
  }

  changeUserState(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/change-user-state/${id}`,null);
  }
}
