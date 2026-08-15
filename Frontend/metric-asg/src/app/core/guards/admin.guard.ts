import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SessionService } from '../../shared/class/temporalStorage';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {

  constructor(
    private router: Router
  ) {}

  canActivate(): boolean {
    if (!SessionService.getSessionItem("token") || !(SessionService.getSessionItem("role")=="admin")) {
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}
