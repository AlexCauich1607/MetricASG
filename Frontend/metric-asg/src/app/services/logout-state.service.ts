import { computed, Injectable, signal } from '@angular/core';

export type LogoutPhase =
  | 'idle'
  | 'authorizing'
  | 'logging-out';

@Injectable({
  providedIn: 'root'
})
export class LogoutStateService {
  private readonly currentPhase = signal<LogoutPhase>('idle');

  readonly phase = this.currentPhase.asReadonly();

  readonly inProgress = computed(
    () => this.phase() !== 'idle'
  );

  readonly isLoggingOut = computed(
    () => this.phase() === 'logging-out'
  );

  private logoutGeneration = 0;

  get generation(): number {
    return this.logoutGeneration;
  }

  beginAuthorization(): boolean {
    if (this.inProgress()) {
      return false;
    }

    this.currentPhase.set('authorizing');

    return true;
  }

  authorizeLogout(): boolean {
    if (this.phase() !== 'authorizing') {
      return false;
    }

    this.logoutGeneration++;
    this.currentPhase.set('logging-out');

    return true;
  }

  cancelAuthorization(): void {
    if (this.phase() === 'authorizing') {
      this.currentPhase.set('idle');
    }
  }

  finishLogout(): void {
    if (this.isLoggingOut()) {
      this.currentPhase.set('idle');
    }
  }
}