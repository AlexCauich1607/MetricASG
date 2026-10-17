import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../../shared/class/temporalStorage';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (!SessionService.getSessionItem('token')) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};