import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';
import { SessionService } from '../../shared/class/temporalStorage';

describe('authGuard', () => {
  let router: jasmine.SpyObj<Router>;

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
});