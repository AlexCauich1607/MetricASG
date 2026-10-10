import { Router } from '@angular/router';
import { AuthGuard } from './auth.guard';
import { SessionService } from '../../shared/class/temporalStorage';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    sessionStorage.clear();

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    guard = new AuthGuard(router);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should allow access when token exists', () => {
    SessionService.setSessionItem('token', 'test-token');

    expect(guard.canActivate()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should redirect to login when token does not exist', () => {
    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});