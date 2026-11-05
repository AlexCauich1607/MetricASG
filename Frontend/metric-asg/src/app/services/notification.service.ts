
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  ReevaluationNotification,
  NotificationPreference,
  NotificationPreferenceUpdate
} from '../models/notification';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private readonly apiUrl =
    'http://localhost:8000/api/notifications';

  constructor(private http: HttpClient) {}

  getMyNotifications(): Observable<ReevaluationNotification[]> {
    return this.http.get<ReevaluationNotification[]>(
      `${this.apiUrl}/me`
    );
  }

  getMyPreferences(): Observable<NotificationPreference> {
    return this.http.get<NotificationPreference>(
      `${this.apiUrl}/preferences/me`
    );
  }

  updateMyPreferences(
    preferences: NotificationPreferenceUpdate
  ): Observable<NotificationPreference> {
    return this.http.put<NotificationPreference>(
      `${this.apiUrl}/preferences/me`,
      preferences
    );
  }
}
