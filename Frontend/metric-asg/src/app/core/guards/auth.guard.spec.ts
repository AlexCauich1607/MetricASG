import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { SessionService } from '../../shared/class/temporalStorage';
import { LogoutStateService } from '../../services/logout-state.service';

describe('authGuard', () => {
  let router: jasmine.SpyObj<Router>;
  let logoutState: LogoutStateService;

  beforeEach(() => {
    sessionStorage.clear();

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: router
        }
      ]
    });
    logoutState = TestBed.inject(LogoutStateService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should allow access when token exists', () => {
    SessionService.setSessionItem('token', 'test-token');

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should redirect to login when token does not exist', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
  it('should allow access while logout authorization is pending', () => {
    SessionService.setSessionItem('token', 'test-token');

    logoutState.beginAuthorization();

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should prevent access to protected routes during authorized logout', () => {
    SessionService.setSessionItem('token', 'test-token');

    logoutState.beginAuthorization();
    logoutState.authorizeLogout();

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeFalse();

    expect(router.navigate)
      .toHaveBeenCalledOnceWith(['/home']);

    expect(SessionService.getSessionItem('token'))
      .toBe('test-token');
  });

  it('should allow access after logout authorization is cancelled', () => {
    SessionService.setSessionItem('token', 'test-token');

    logoutState.beginAuthorization();
    logoutState.cancelAuthorization();

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});