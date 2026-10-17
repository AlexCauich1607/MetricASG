import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { userGuard } from './user.guard';
import { SessionService } from '../../shared/class/temporalStorage';

describe('userGuard', () => {
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

  it('should allow access with user role and token', () => {
    SessionService.setSessionItem('token', 'test-token');
    SessionService.setSessionItem('role', 'user');

    const result = TestBed.runInInjectionContext(() =>
      userGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should redirect when token does not exist', () => {
    SessionService.setSessionItem('role', 'user');

    const result = TestBed.runInInjectionContext(() =>
      userGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should redirect when role is not user', () => {
    SessionService.setSessionItem('token', 'test-token');
    SessionService.setSessionItem('role', 'admin');

    const result = TestBed.runInInjectionContext(() =>
      userGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});