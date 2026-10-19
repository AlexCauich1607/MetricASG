import { inject } from '@angular/core';
import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import {
  BehaviorSubject,
  catchError,
  filter,
  Observable,
  switchMap,
  take,
  throwError
} from 'rxjs';
import { SessionService } from '../../shared/class/temporalStorage';
import { AuthService } from '../../services/auth.service';

let isRefreshing = false;
let refreshSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);

  if (req.url.endsWith('/refresh-token')) {
    return next(req);
  }

  const token = SessionService.getSessionItem('token');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError(err => {
      if (err.status === 401) {
        return handle401(req, next, auth);
      }

      return throwError(() => err);
    })
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshSubject.next(null);

    return auth.refreshToken().pipe(
      switchMap(res => {
        SessionService.setSessionItem('token', res.token);
        refreshSubject.next(res.token);
        isRefreshing = false;

        return next(
          req.clone({
            setHeaders: {
              Authorization: `Bearer ${res.token}`
            }
          })
        );
      }),
      catchError(err => {
        isRefreshing = false;
        refreshSubject.error(err);
        refreshSubject = new BehaviorSubject<string | null>(null);

        return throwError(() => err);
      })
    );
  }

  return refreshSubject.pipe(
    filter(token => token !== null),
    take(1),
    switchMap(token =>
      next(
        req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      )
    )
  );
}
