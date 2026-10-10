import { Router } from '@angular/router';
import { AdminGuard } from './admin.guard';
import { SessionService } from '../../shared/class/temporalStorage';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    sessionStorage.clear();

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    guard = new AdminGuard(router);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should allow access with admin role and token', () => {
    SessionService.setSessionItem('token', 'test-token');
    SessionService.setSessionItem('role', 'admin');

    expect(guard.canActivate()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should redirect when token does not exist', () => {
    SessionService.setSessionItem('role', 'admin');

    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should redirect when role is not admin', () => {
    SessionService.setSessionItem('token', 'test-token');
    SessionService.setSessionItem('role', 'user');

    expect(guard.canActivate()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});