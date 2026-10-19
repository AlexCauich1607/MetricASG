import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { User } from '../models/user';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService extends BaseService < User > {

  constructor(http: HttpClient) {
    super(http, 'users');
  }


   getMe(): Observable<User> {
      return this.http.get<User>(`${this.apiUrl}profile/me`);
  }

}
