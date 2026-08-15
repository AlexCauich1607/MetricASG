import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { BehaviorSubject, catchError, filter, Observable, switchMap, take, throwError } from 'rxjs';
import { SessionService } from '../../shared/class/temporalStorage';
import { AuthService } from '../../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);
  constructor(private auth: AuthService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    const token = SessionService.getSessionItem('token');
   
    if (token) { 
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(req).pipe(
      catchError(err => {
        if (err.status === 401) {
          return this.handle401(req, next);
        }
        return throwError(() => err);
      })
    );
  }
  private handle401(req: HttpRequest<any>, next: HttpHandler) {

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshSubject.next(null);

      return this.auth.refreshToken().pipe(
        switchMap(res => {
          this.isRefreshing = false;
          SessionService.setSessionItem("token", res.token)
          this.refreshSubject.next(res.token);

          return next.handle(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${res.token}`
              }
            })
          );
        }),
        catchError(err => {
          this.isRefreshing = false;
          return throwError(() => err);
        })
      );
    }

    return this.refreshSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token =>
        next.handle(
          req.clone({
            setHeaders: { Authorization: `Bearer ${token}` }
          })
        )
      )
    );
  }
}
