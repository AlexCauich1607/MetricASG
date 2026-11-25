import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../../shared/class/temporalStorage';
import { LogoutStateService } from '../../services/logout-state.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const logoutState = inject(LogoutStateService);

  if (logoutState.isLoggingOut()) {
    router.navigate(['/home']);
    return false;
  }

  if (!SessionService.getSessionItem('token')) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};