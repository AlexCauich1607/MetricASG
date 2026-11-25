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
  finalize,
  Observable,
  switchMap,
  take,
  throwError
} from 'rxjs';

import { SessionService } from '../../shared/class/temporalStorage';
import { AuthService } from '../../services/auth.service';
import { LogoutStateService } from '../../services/logout-state.service';

let isRefreshing = false;
let refreshSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);
  const logoutState = inject(LogoutStateService);

  const requestGeneration = logoutState.generation;

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
      if (
        err.status === 401 &&
        !req.url.endsWith('/logout') &&
        !logoutState.isLoggingOut() &&
        requestGeneration === logoutState.generation
      ) {
        return handle401(
          req,
          next,
          auth,
          logoutState,
          requestGeneration
        );
      }

      return throwError(() => err);
    })
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  logoutState: LogoutStateService,
  requestGeneration: number
): Observable<HttpEvent<unknown>> {
  const isRequestInvalidated = (): boolean =>
    logoutState.isLoggingOut() ||
    requestGeneration !== logoutState.generation;

  if (isRequestInvalidated()) {
    return throwError(
      () => new Error('Session invalidated by logout')
    );
  }

  if (!isRefreshing) {
    isRefreshing = true;

    const currentRefreshSubject =
      new BehaviorSubject<string | null>(null);

    refreshSubject = currentRefreshSubject;

    let refreshSettled = false;

    return auth.refreshToken().pipe(
      switchMap(res => {
        if (isRequestInvalidated()) {
          return throwError(
            () => new Error('Session invalidated by logout')
          );
        }

        SessionService.setSessionItem('token', res.token);

        refreshSettled = true;
        isRefreshing = false;

        currentRefreshSubject.next(res.token);
        currentRefreshSubject.complete();

        return next(
          req.clone({
            setHeaders: {
              Authorization: `Bearer ${res.token}`
            }
          })
        );
      }),
      catchError(err => {
        if (!refreshSettled) {
          refreshSettled = true;
          isRefreshing = false;

          currentRefreshSubject.error(err);
        }

        return throwError(() => err);
      }),
      finalize(() => {
        if (!refreshSettled) {
          refreshSettled = true;
          isRefreshing = false;

          currentRefreshSubject.error(
            new Error('Token refresh cancelled')
          );
        }
      })
    );
  }

  return refreshSubject.pipe(
    filter(token => token !== null),
    take(1),
    switchMap(token => {
      if (isRequestInvalidated()) {
        return throwError(
          () => new Error('Session invalidated by logout')
        );
      }

      return next(
        req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      );
    })
  );
}
