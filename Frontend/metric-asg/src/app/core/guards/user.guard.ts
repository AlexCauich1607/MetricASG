import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SessionService } from '../../shared/class/temporalStorage';

@Injectable({ providedIn: 'root' })
export class UserGuard implements CanActivate {

  constructor(
    private router: Router
  ) {}

  canActivate(): boolean {
    if (!SessionService.getSessionItem("token") || !(SessionService.getSessionItem("role")=="user")) {
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}
