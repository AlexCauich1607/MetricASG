import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../../shared/class/temporalStorage';

export const userGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (
    !SessionService.getSessionItem('token') ||
    SessionService.getSessionItem('role') !== 'user'
  ) {
    router.navigate(['/']);
    return false;
  }

  return true;
};