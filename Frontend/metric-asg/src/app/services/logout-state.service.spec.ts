import { TestBed } from '@angular/core/testing';
import { LogoutStateService } from './logout-state.service';

describe('LogoutStateService', () => {
  let service: LogoutStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogoutStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize in the idle phase', () => {
    expect(service.phase()).toBe('idle');
    expect(service.inProgress()).toBeFalse();
    expect(service.isLoggingOut()).toBeFalse();
    expect(service.generation).toBe(0);
  });

  it('should begin logout authorization', () => {
    expect(service.beginAuthorization()).toBeTrue();

    expect(service.phase()).toBe('authorizing');
    expect(service.inProgress()).toBeTrue();
    expect(service.isLoggingOut()).toBeFalse();
    expect(service.generation).toBe(0);
  });

  it('should prevent duplicate authorization requests', () => {
    expect(service.beginAuthorization()).toBeTrue();
    expect(service.beginAuthorization()).toBeFalse();

    expect(service.phase()).toBe('authorizing');
    expect(service.generation).toBe(0);
  });

  it('should return to idle when authorization is cancelled', () => {
    service.beginAuthorization();
    service.cancelAuthorization();

    expect(service.phase()).toBe('idle');
    expect(service.inProgress()).toBeFalse();
    expect(service.isLoggingOut()).toBeFalse();
    expect(service.generation).toBe(0);
  });

  it('should allow retrying after authorization is cancelled', () => {
    service.beginAuthorization();
    service.cancelAuthorization();

    expect(service.beginAuthorization()).toBeTrue();
    expect(service.phase()).toBe('authorizing');
  });

  it('should authorize logout and increment the generation', () => {
    service.beginAuthorization();

    expect(service.authorizeLogout()).toBeTrue();

    expect(service.phase()).toBe('logging-out');
    expect(service.inProgress()).toBeTrue();
    expect(service.isLoggingOut()).toBeTrue();
    expect(service.generation).toBe(1);
  });

  it('should reject logout without previous authorization', () => {
    expect(service.authorizeLogout()).toBeFalse();

    expect(service.phase()).toBe('idle');
    expect(service.generation).toBe(0);
  });

  it('should prevent duplicate requests during logout', () => {
    service.beginAuthorization();
    service.authorizeLogout();

    expect(service.beginAuthorization()).toBeFalse();
    expect(service.authorizeLogout()).toBeFalse();

    expect(service.phase()).toBe('logging-out');
    expect(service.generation).toBe(1);
  });

  it('should not cancel an already authorized logout', () => {
    service.beginAuthorization();
    service.authorizeLogout();

    service.cancelAuthorization();

    expect(service.phase()).toBe('logging-out');
    expect(service.isLoggingOut()).toBeTrue();
    expect(service.generation).toBe(1);
  });

  it('should finish logout and preserve the generation', () => {
    service.beginAuthorization();
    service.authorizeLogout();
    service.finishLogout();

    expect(service.phase()).toBe('idle');
    expect(service.inProgress()).toBeFalse();
    expect(service.isLoggingOut()).toBeFalse();
    expect(service.generation).toBe(1);
  });

  it('should not finish logout while authorization is pending', () => {
    service.beginAuthorization();
    service.finishLogout();

    expect(service.phase()).toBe('authorizing');
    expect(service.inProgress()).toBeTrue();
    expect(service.generation).toBe(0);
  });

  it('should increment the generation for each authorized logout', () => {
    service.beginAuthorization();
    service.authorizeLogout();
    service.finishLogout();

    expect(service.generation).toBe(1);

    service.beginAuthorization();
    service.authorizeLogout();
    service.finishLogout();

    expect(service.generation).toBe(2);
    expect(service.phase()).toBe('idle');
  });

  it('should share the same state across consumers', () => {
    const anotherConsumer = TestBed.inject(LogoutStateService);

    expect(anotherConsumer).toBe(service);

    service.beginAuthorization();

    expect(anotherConsumer.phase()).toBe('authorizing');

    service.authorizeLogout();

    expect(anotherConsumer.isLoggingOut()).toBeTrue();
    expect(anotherConsumer.generation).toBe(1);

    anotherConsumer.finishLogout();

    expect(service.phase()).toBe('idle');
  });
});