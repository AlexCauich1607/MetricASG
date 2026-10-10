import { HttpRequest, HttpResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../shared/class/temporalStorage';
import { AuthInterceptor } from './auth.interceptor';
import { Observable, of, throwError } from 'rxjs';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    sessionStorage.clear();

    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['refreshToken']
    );

    interceptor = new AuthInterceptor(authService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should add authorization header when token exists', () => {
    SessionService.setSessionItem('token', 'test-token');

    const request = new HttpRequest('GET', '/api/test');

    const next = {
      handle: jasmine.createSpy('handle').and.returnValue(
        of(new HttpResponse({ status: 200 }))
      )
    };

    interceptor.intercept(request, next).subscribe();

    expect(next.handle).toHaveBeenCalled();

    const interceptedRequest = next.handle.calls.mostRecent()
      .args[0] as HttpRequest<any>;

    expect(
      interceptedRequest.headers.get('Authorization')
    ).toBe('Bearer test-token');
  });

  it('should not add authorization header when token does not exist', () => {
    const request = new HttpRequest('GET', '/api/test');

    const next = {
      handle: jasmine.createSpy('handle').and.returnValue(
        of(new HttpResponse({ status: 200 }))
      )
    };

    interceptor.intercept(request, next).subscribe();

    expect(next.handle).toHaveBeenCalled();

    const interceptedRequest = next.handle.calls.mostRecent()
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

    const next = {
      handle: jasmine.createSpy('handle').and.returnValue(
        throwError(() => error)
      )
    };

    let receivedError: any;

    interceptor.intercept(request, next).subscribe({
      error: err => {
        receivedError = err;
      }
    });

    expect(receivedError).toBe(error);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('should refresh token and retry request after 401', () => {
    SessionService.setSessionItem('token', 'old-token');

    authService.refreshToken.and.returnValue(
      of({ token: 'new-token' })
    );

    const request = new HttpRequest('GET', '/api/test');

    let requestCount = 0;

    const next = {
      handle: jasmine.createSpy('handle').and.callFake(
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

          return of(new HttpResponse({
            status: 200,
            body: { success: true }
          }));
        }
      )
    };

    let response: any;

    interceptor.intercept(request, next).subscribe({
      next: value => {
        response = value;
      }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(SessionService.getSessionItem('token')).toBe('new-token');
    expect(next.handle).toHaveBeenCalledTimes(2);
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

    const next = {
      handle: jasmine.createSpy('handle').and.returnValue(
        throwError(() => ({
          status: 401
        }))
      )
    };

    let receivedError: any;

    interceptor.intercept(request, next).subscribe({
      error: error => {
        receivedError = error;
      }
    });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(receivedError).toBe(refreshError);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});