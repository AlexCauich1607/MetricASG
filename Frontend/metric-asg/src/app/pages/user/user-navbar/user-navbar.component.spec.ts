
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { UserNavbarComponent } from './user-navbar.component';
import { NotificationService } from '../../../services/notification.service';
import { ReevaluationNotification } from '../../../models/notification';

describe('UserNavbarComponent', () => {
  let component: UserNavbarComponent;
  let fixture: ComponentFixture<UserNavbarComponent>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const mockNotifications: ReevaluationNotification[] = [
    {
      id: 1,
      target_date: '2027-05-05',
      reminder_type: 'FIRST',
      created_at: '2027-04-05T09:00:00'
    },
    {
      id: 2,
      target_date: '2027-05-05',
      reminder_type: 'SECOND',
      created_at: '2027-04-28T09:00:00'
    },
    {
      id: 3,
      target_date: '2027-05-05',
      reminder_type: 'DUE',
      created_at: '2027-05-05T09:00:00'
    }
  ];

  beforeEach(async () => {
    notificationService = jasmine.createSpyObj<NotificationService>(
      'NotificationService',
      ['getMyNotifications']
    );

    notificationService.getMyNotifications.and.returnValue(
      of([])
    );

    await TestBed.configureTestingModule({
      imports: [UserNavbarComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideRouter([]),
        {
          provide: NotificationService,
          useValue: notificationService
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserNavbarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should load notifications on initialization', () => {
    notificationService.getMyNotifications.and.returnValue(
      of(mockNotifications)
    );

    fixture.detectChanges();

    expect(notificationService.getMyNotifications)
      .toHaveBeenCalledTimes(1);

    expect(component.notifications.length).toBe(3);
    expect(component.notificationsError).toBeFalse();
  });

  it('should display an empty state', () => {
    fixture.detectChanges();

    const element: HTMLElement =
      fixture.nativeElement;

    expect(element.textContent)
      .toContain('No tienes recordatorios por el momento.');
  });

  it('should display notification messages', () => {
    notificationService.getMyNotifications.and.returnValue(
      of(mockNotifications)
    );

    fixture.detectChanges();

    const element: HTMLElement =
      fixture.nativeElement;

    expect(element.textContent)
      .toContain('Faltan 30 días');

    expect(element.textContent)
      .toContain('Faltan 7 días');

    expect(element.textContent)
      .toContain('Hoy corresponde realizar');
  });

  it('should format the evaluation date', () => {
    fixture.detectChanges();

    expect(component.formatReminderDate('2027-05-05'))
      .toBe('05/05/2027');
  });

  it('should handle notification loading errors', () => {
    notificationService.getMyNotifications.and.returnValue(
      throwError(() => new Error('Network error'))
    );

    fixture.detectChanges();

    expect(component.notificationsError).toBeTrue();
    expect(component.notifications).toEqual([]);

    const element: HTMLElement =
      fixture.nativeElement;

    expect(element.textContent)
      .toContain('No se pudieron cargar los recordatorios.');
  });

  it('should retry after a failed request', () => {
    notificationService.getMyNotifications.and.returnValues(
      throwError(() => new Error('Network error')),
      of(mockNotifications)
    );

    fixture.detectChanges();

    expect(component.notificationsError).toBeTrue();

    component.loadNotifications();
    fixture.detectChanges();

    expect(component.notificationsError).toBeFalse();
    expect(component.notifications.length).toBe(3);

    expect(notificationService.getMyNotifications)
      .toHaveBeenCalledTimes(2);
  });

  it('should display loading state while request is pending', () => {
    const pendingRequest =
      new Subject<ReevaluationNotification[]>();

    notificationService.getMyNotifications.and.returnValue(
      pendingRequest.asObservable()
    );

    fixture.detectChanges();

    expect(component.notificationsLoading).toBeTrue();

    const element: HTMLElement =
      fixture.nativeElement;

    expect(element.textContent)
      .toContain('Cargando recordatorios...');

    pendingRequest.next(mockNotifications);
    pendingRequest.complete();

    fixture.detectChanges();

    expect(component.notificationsLoading).toBeFalse();
  });
});
