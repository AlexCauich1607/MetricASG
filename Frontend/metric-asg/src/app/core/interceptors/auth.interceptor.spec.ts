import { TestBed } from '@angular/core/testing';
import {
  HttpRequest,
  HttpResponse,
  HttpHandlerFn
} from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../shared/class/temporalStorage';
import { authInterceptor } from './auth.interceptor';
import { Observable, of, Subject, throwError } from 'rxjs';
import { LogoutStateService } from '../../services/logout-state.service';

describe('AuthInterceptor', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let logoutState: LogoutStateService;

  beforeEach(() => {
    sessionStorage.clear();

    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['refreshToken']
    );

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: authService
        }
      ]
    });

    logoutState = TestBed.inject(LogoutStateService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  function executeInterceptor(
    request: HttpRequest<any>,
    next: HttpHandlerFn
  ): Observable<any> {
    return TestBed.runInInjectionContext(() =>
      authInterceptor(request, next)
    );
  }

  it('should add authorization header when token exists', () => {
    SessionService.setSessionItem('token', 'test-token');

    const request = new HttpRequest('GET', '/api/test');

    const next = jasmine.createSpy('next').and.returnValue(
      of(new HttpResponse({ status: 200 }))
    );

    executeInterceptor(request, next).subscribe();

    expect(next).toHaveBeenCalled();

    const interceptedRequest = next.calls.mostRecent()
      .args[0] as HttpRequest<any>;

    expect(
      interceptedRequest.headers.get('Authorization')
    ).toBe('Bearer test-token');
  });

  it('should not add authorization header when token does not exist', () => {
    const request = new HttpRequest('GET', '/api/test');

    const next = jasmine.createSpy('next').and.returnValue(
      of(new HttpResponse({ status: 200 }))
    );

    executeInterceptor(request, next).subscribe();

    expect(next).toHaveBeenCalled();

    const interceptedRequest = next.calls.mostRecent()
      .args[0] as HttpRequest<any>;

    expect(
      interceptedRequest.headers.has('Authorization')
    ).toBeFalse();
  });

  it('should propagate errors different from 401', () => {
    const request = new HttpRequest('GET', '/api/test');

    const error = {
      status: 500,
      message: 'Internal server error'
    };

    const next = jasmine.createSpy('next').and.returnValue(
      throwError(() => error)
    );

    let receivedError: any;

    executeInterceptor(request, next).subscribe({
      error: err => {
        receivedError = err;
      }
    });

    expect(receivedError).toBe(error);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('should propagate 403 errors without refreshing the token', () => {
    SessionService.setSessionItem('token', 'test-token');

    const forbiddenError = {
      status: 403,
      message: 'Forbidden'
    };

    const request = new HttpRequest('GET', '/api/test');

    const next = jasmine.createSpy('next').and.returnValue(
      throwError(() => forbiddenError)
    );

    let receivedError: any;

    executeInterceptor(request, next).subscribe({
      error: error => {
        receivedError = error;
      }
    });

    expect(receivedError).toBe(forbiddenError);
    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should refresh token and retry request after 401', () => {
    SessionService.setSessionItem('token', 'old-token');

    authService.refreshToken.and.returnValue(
      of({ token: 'new-token' })
    );

    const request = new HttpRequest('GET', '/api/test');

    let requestCount = 0;

    const next = jasmine.createSpy('next').and.callFake(
      (req: HttpRequest<any>): Observable<any> => {
        requestCount++;

        if (requestCount === 1) {
          expect(
            req.headers.get('Authorization')
          ).toBe('Bearer old-token');

          return throwError(() => ({
            status: 401
          }));
        }

        expect(
          req.headers.get('Authorization')
        ).toBe('Bearer new-token');

        return of(
          new HttpResponse({
            status: 200,
            body: { success: true }
          })
        );
      }
    );

    let response: any;

    executeInterceptor(request, next).subscribe({
      next: value => {
        response = value;
      }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(SessionService.getSessionItem('token')).toBe('new-token');
    expect(next).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
  });

  it('should propagate refresh token errors', () => {
    SessionService.setSessionItem('token', 'old-token');

    const refreshError = {
      status: 401,
      message: 'Refresh token expired'
    };

    authService.refreshToken.and.returnValue(
      throwError(() => refreshError)
    );

    const request = new HttpRequest('GET', '/api/test');

    const next = jasmine.createSpy('next').and.returnValue(
      throwError(() => ({
        status: 401
      }))
    );

    let receivedError: any;

    executeInterceptor(request, next).subscribe({
      error: error => {
        receivedError = error;
      }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(receivedError).toBe(refreshError);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should not refresh the token during authorized logout', () => {
    SessionService.setSessionItem('token', 'old-token');

    logoutState.beginAuthorization();
    logoutState.authorizeLogout();

    authService.refreshToken.and.returnValue(
      of({ token: 'new-token' })
    );

    const unauthorizedError = { status: 401 };

    const request = new HttpRequest('GET', '/api/test');

    const next = jasmine.createSpy('next').and.returnValue(
      throwError(() => unauthorizedError)
    );

    let receivedError: any;

    executeInterceptor(request, next).subscribe({
      error: error => {
        receivedError = error;
      }
    });

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(receivedError).toBe(unauthorizedError);

    expect(SessionService.getSessionItem('token'))
      .toBe('old-token');
  });

  it('should not refresh the token when logout returns 401', () => {
    SessionService.setSessionItem('token', 'old-token');

    authService.refreshToken.and.returnValue(
      of({ token: 'new-token' })
    );

    const unauthorizedError = { status: 401 };

    const request = new HttpRequest(
      'POST',
      '/api/auth/logout',
      {}
    );

    const next = jasmine.createSpy('next').and.returnValue(
      throwError(() => unauthorizedError)
    );

    let receivedError: any;

    executeInterceptor(request, next).subscribe({
      error: error => {
        receivedError = error;
      }
    });

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(receivedError).toBe(unauthorizedError);
  });
  it('should discard a refresh response received after logout', () => {
    SessionService.setSessionItem('token', 'old-token');

    const pendingRefresh = new Subject<{ token: string }>();

    authService.refreshToken.and.returnValue(
      pendingRefresh.asObservable()
    );

    const request = new HttpRequest('GET', '/api/test');

    const next = jasmine.createSpy('next').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    let receivedResponse: any;

    executeInterceptor(request, next).subscribe({
      next: response => {
        receivedResponse = response;
      },
      error: () => { }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);

    logoutState.beginAuthorization();
    logoutState.authorizeLogout();

    SessionService.logout();

    logoutState.finishLogout();

    pendingRefresh.next({ token: 'late-token' });
    pendingRefresh.complete();

    expect(SessionService.getSessionItem('token')).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(receivedResponse).toBeUndefined();
  });
  it('should allow token refresh while logout authorization is pending', () => {
    SessionService.setSessionItem('token', 'old-token');

    logoutState.beginAuthorization();

    authService.refreshToken.and.returnValue(
      of({ token: 'new-token' })
    );

    const request = new HttpRequest('GET', '/api/test');

    const next = jasmine.createSpy('next').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    let receivedResponse: any;

    executeInterceptor(request, next).subscribe({
      next: response => {
        receivedResponse = response;
      }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);

    expect(SessionService.getSessionItem('token'))
      .toBe('new-token');

    expect(receivedResponse.status).toBe(200);
    expect(logoutState.phase()).toBe('authorizing');

    logoutState.cancelAuthorization();
  });
  it('should share one token refresh between concurrent requests', () => {
    SessionService.setSessionItem('token', 'old-token');

    const pendingRefresh = new Subject<{ token: string }>();

    authService.refreshToken.and.returnValue(
      pendingRefresh.asObservable()
    );

    const firstRequest = new HttpRequest('GET', '/api/first');
    const secondRequest = new HttpRequest('GET', '/api/second');

    const firstNext = jasmine.createSpy('firstNext').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    const secondNext = jasmine.createSpy('secondNext').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    const firstResponse = jasmine.createSpy('firstResponse');
    const secondResponse = jasmine.createSpy('secondResponse');

    executeInterceptor(firstRequest, firstNext).subscribe({
      next: firstResponse
    });

    executeInterceptor(secondRequest, secondNext).subscribe({
      next: secondResponse
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondNext).toHaveBeenCalledTimes(1);

    pendingRefresh.next({ token: 'new-token' });
    pendingRefresh.complete();

    expect(firstNext).toHaveBeenCalledTimes(2);
    expect(secondNext).toHaveBeenCalledTimes(2);

    expect(firstResponse).toHaveBeenCalledTimes(1);
    expect(secondResponse).toHaveBeenCalledTimes(1);

    expect(SessionService.getSessionItem('token'))
      .toBe('new-token');
  });
  it('should invalidate concurrent refresh requests during logout', () => {
    SessionService.setSessionItem('token', 'old-token');

    const pendingRefresh = new Subject<{ token: string }>();

    authService.refreshToken.and.returnValue(
      pendingRefresh.asObservable()
    );

    const firstNext = jasmine.createSpy('firstNext').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    const secondNext = jasmine.createSpy('secondNext').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    const firstResponse = jasmine.createSpy('firstResponse');
    const secondResponse = jasmine.createSpy('secondResponse');

    const firstError = jasmine.createSpy('firstError');
    const secondError = jasmine.createSpy('secondError');

    executeInterceptor(
      new HttpRequest('GET', '/api/first'),
      firstNext
    ).subscribe({
      next: firstResponse,
      error: firstError
    });

    executeInterceptor(
      new HttpRequest('GET', '/api/second'),
      secondNext
    ).subscribe({
      next: secondResponse,
      error: secondError
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);

    logoutState.beginAuthorization();
    logoutState.authorizeLogout();

    pendingRefresh.next({ token: 'invalid-token' });
    pendingRefresh.complete();

    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondNext).toHaveBeenCalledTimes(1);

    expect(firstResponse).not.toHaveBeenCalled();
    expect(secondResponse).not.toHaveBeenCalled();

    expect(firstError).toHaveBeenCalledTimes(1);
    expect(secondError).toHaveBeenCalledTimes(1);

    expect(SessionService.getSessionItem('token'))
      .toBe('old-token');

    SessionService.logout();
    logoutState.finishLogout();
  });
  it('should allow token refresh in a new session after logout', () => {
    SessionService.setSessionItem('token', 'old-token');

    const pendingRefresh = new Subject<{ token: string }>();

    authService.refreshToken.and.returnValue(
      pendingRefresh.asObservable()
    );

    const oldNext = jasmine.createSpy('oldNext').and.returnValue(
      throwError(() => ({ status: 401 }))
    );

    executeInterceptor(
      new HttpRequest('GET', '/api/old-session'),
      oldNext
    ).subscribe({
      error: () => { }
    });

    logoutState.beginAuthorization();
    logoutState.authorizeLogout();

    SessionService.logout();
    logoutState.finishLogout();

    pendingRefresh.next({ token: 'invalid-token' });
    pendingRefresh.complete();

    expect(SessionService.getSessionItem('token')).toBeNull();

    // Simular un nuevo inicio de sesión.
    SessionService.setSessionItem('token', 'new-session-token');

    authService.refreshToken.and.returnValue(
      of({ token: 'renewed-session-token' })
    );

    const newNext = jasmine.createSpy('newNext').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    const newResponse = jasmine.createSpy('newResponse');

    executeInterceptor(
      new HttpRequest('GET', '/api/new-session'),
      newNext
    ).subscribe({
      next: newResponse
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(2);
    expect(newNext).toHaveBeenCalledTimes(2);
    expect(newResponse).toHaveBeenCalledTimes(1);

    expect(SessionService.getSessionItem('token'))
      .toBe('renewed-session-token');
  });
  it('should allow a new refresh after the active refresh is cancelled', () => {
    SessionService.setSessionItem('token', 'old-token');

    const pendingRefresh = new Subject<{ token: string }>();

    authService.refreshToken.and.returnValue(
      pendingRefresh.asObservable()
    );

    const firstNext = jasmine.createSpy('firstNext').and.returnValue(
      throwError(() => ({ status: 401 }))
    );

    const firstSubscription = executeInterceptor(
      new HttpRequest('GET', '/api/first'),
      firstNext
    ).subscribe({
      error: () => { }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);

    // Cancelar la solicitud antes de recibir el token.
    firstSubscription.unsubscribe();

    pendingRefresh.complete();

    // Una nueva solicitud debe poder iniciar otra renovación.
    authService.refreshToken.and.returnValue(
      of({ token: 'new-token' })
    );

    const secondNext = jasmine.createSpy('secondNext').and.returnValues(
      throwError(() => ({ status: 401 })),
      of(new HttpResponse({ status: 200 }))
    );

    const secondResponse = jasmine.createSpy('secondResponse');

    const secondSubscription = executeInterceptor(
      new HttpRequest('GET', '/api/second'),
      secondNext
    ).subscribe({
      next: secondResponse,
      error: () => { }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(2);
    expect(secondNext).toHaveBeenCalledTimes(2);
    expect(secondResponse).toHaveBeenCalledTimes(1);

    expect(SessionService.getSessionItem('token'))
      .toBe('new-token');

    secondSubscription.unsubscribe();
  });
  it('should notify waiting requests when the active refresh is cancelled', () => {
    SessionService.setSessionItem('token', 'old-token');

    const pendingRefresh = new Subject<{ token: string }>();

    authService.refreshToken.and.returnValue(
      pendingRefresh.asObservable()
    );

    const firstNext = jasmine.createSpy('firstNext').and.returnValue(
      throwError(() => ({ status: 401 }))
    );

    const secondNext = jasmine.createSpy('secondNext').and.returnValue(
      throwError(() => ({ status: 401 }))
    );

    const secondResponse = jasmine.createSpy('secondResponse');
    const secondError = jasmine.createSpy('secondError');

    const firstSubscription = executeInterceptor(
      new HttpRequest('GET', '/api/first'),
      firstNext
    ).subscribe({
      error: () => { }
    });

    const secondSubscription = executeInterceptor(
      new HttpRequest('GET', '/api/second'),
      secondNext
    ).subscribe({
      next: secondResponse,
      error: secondError
    });

    // Ambas solicitudes comparten una renovación.
    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondNext).toHaveBeenCalledTimes(1);
    expect(secondSubscription.closed).toBeFalse();

    // Cancelar la solicitud que inició la renovación.
    firstSubscription.unsubscribe();

    // La solicitud en espera debe recibir el error.
    expect(secondError).toHaveBeenCalledTimes(1);

    expect(secondError).toHaveBeenCalledWith(
      jasmine.any(Error)
    );

    expect(secondError.calls.mostRecent().args[0].message)
      .toBe('Token refresh cancelled');

    expect(secondResponse).not.toHaveBeenCalled();
    expect(secondNext).toHaveBeenCalledTimes(1);
    expect(secondSubscription.closed).toBeTrue();

    // No debe modificarse el token existente.
    expect(SessionService.getSessionItem('token'))
      .toBe('old-token');

    pendingRefresh.complete();
    secondSubscription.unsubscribe();
  });

});
