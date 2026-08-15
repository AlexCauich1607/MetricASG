import { Injectable } from '@angular/core';
import { AuthResponse, AuthUserResponse, ChangePassword, RefreshToken, UserLogin, UserRegister } from '../models/auth';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user';
import { HttpClient } from '@angular/common/http';
import { SessionService } from '../shared/class/temporalStorage';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `http://localhost:8000/api/auth/`;

  constructor(protected http: HttpClient) { }

  createUser(data: UserRegister): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}register`, data);
  }


  createAdmin(data: UserRegister): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}create-admin`, data);
  }

  login(data: UserLogin): Observable<AuthResponse> {
    let response = this.http.post<AuthResponse>(`${this.apiUrl}login`, data, {
      withCredentials: true
    }).pipe((tap(
      res => {
        SessionService.setSessionItem('user', res.user.name);
        SessionService.setSessionItem('role', res.user.role);
        SessionService.setSessionItem('token', res.access_token);
        SessionService.setSessionItem('company', res.user.company_name);
        SessionService.setSessionItem('id', res.user.id);
        SessionService.setSessionItem('photo', res.user.profile_photo);
      }
    )))

    return response;
  }

  changePaassword(data: ChangePassword): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}change-password`, data);
  }

  refreshToken() {
    return this.http.post<RefreshToken>(
      `${this.apiUrl}refresh-token`,
      {},
      { withCredentials: true }
    );
  }
}
