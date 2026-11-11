
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { UserNavbarComponent } from './user-navbar.component';
import { NotificationService } from '../../../services/notification.service';
import { ReevaluationNotification } from '../../../models/notification';
import { CompanyContextService } from '../../../services/company-context.service';

import { signal, computed } from '@angular/core';
import {
  CompanyRole,
  UserCompanyMembership
} from '../../../models/company_membership';

describe('UserNavbarComponent', () => {
  let component: UserNavbarComponent;
  let fixture: ComponentFixture<UserNavbarComponent>;
  let notificationService: jasmine.SpyObj<NotificationService>;
  let companyContext: jasmine.SpyObj<CompanyContextService>;

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
    companyContext = jasmine.createSpyObj<CompanyContextService>(
      'CompanyContextService',
      ['loadMemberships', 'selectCompany']
    );

    const memberships = signal<UserCompanyMembership[]>([]);

    const selectedCompanyId = signal<number | null>(null);

    const selectedMembership = computed(
      () => memberships().find(
        membership => membership.company_id === selectedCompanyId()
      ) ?? null
    );

    const selectedRole = computed<CompanyRole | null>(
      () => selectedMembership()?.role ?? null
    );

    Object.assign(companyContext, {
      memberships,
      selectedCompanyId,
      loading: signal(false),
      error: signal(false),
      selectedMembership,
      selectedRole
    });

    companyContext.selectCompany.and.callFake(companyId => {
      if (memberships().some(membership => membership.company_id === companyId)) {
        selectedCompanyId.set(companyId);
      }
    });
    await TestBed.configureTestingModule({
      imports: [UserNavbarComponent],
      providers: [
        provideHttpClient(withXhr()),
        provideRouter([]),
        {
          provide: NotificationService,
          useValue: notificationService
        },
        {
          provide: CompanyContextService,
          useValue: companyContext
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

  it('should load company memberships on initialization', () => {
    fixture.detectChanges();

    expect(companyContext.loadMemberships)
      .toHaveBeenCalledTimes(1);

    expect(notificationService.getMyNotifications)
      .toHaveBeenCalledTimes(1);
  });

  it('should display memberships and allow changing the selected company', () => {
    const memberships: UserCompanyMembership[] = [
      {
        membership_id: 10,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-09T10:00:00'
      },
      {
        membership_id: 18,
        company_id: 7,
        company_name: 'Empresa B',
        role: CompanyRole.COLLABORATOR,
        joined_at: '2026-11-09T10:30:00'
      }
    ];

    companyContext.memberships.set(memberships);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();

    const select: HTMLSelectElement =
      fixture.nativeElement.querySelector('#selected-company');

    expect(select).not.toBeNull();
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('3');

    select.value = '7';
    select.dispatchEvent(new Event('change'));

    expect(companyContext.selectCompany).toHaveBeenCalledWith(7);
    expect(companyContext.selectedCompanyId()).toBe(7);
  });

  it('should prevent changing companies while evaluating', () => {
    const router = TestBed.inject(Router);

    spyOnProperty(router, 'url', 'get').and.returnValue(
      '/user/evaluation'
    );

    component.selectCompany(7);

    expect(component.companySelectionLocked).toBeTrue();

    expect(
      companyContext.selectCompany
    ).not.toHaveBeenCalled();
  });

  it('should allow changing companies outside the evaluation form', () => {
    const router = TestBed.inject(Router);

    spyOnProperty(router, 'url', 'get').and.returnValue(
      '/user/history'
    );

    component.selectCompany(7);

    expect(component.companySelectionLocked).toBeFalse();

    expect(
      companyContext.selectCompany
    ).toHaveBeenCalledOnceWith(7);
  });

  it('should update members navigation when switching company roles', () => {
    const memberships: UserCompanyMembership[] = [
      {
        membership_id: 10,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-09T10:00:00'
      },
      {
        membership_id: 18,
        company_id: 7,
        company_name: 'Empresa B',
        role: CompanyRole.COLLABORATOR,
        joined_at: '2026-11-09T10:30:00'
      }
    ];

    companyContext.memberships.set(memberships);
    companyContext.selectedCompanyId.set(3);

    // Simular que el usuario ya completó su primer acceso.
    component.first = null;

    fixture.detectChanges();

    let membersLink: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector(
        'a[routerLink="/user/members"]'
      );

    expect(component.canManageMembers).toBeTrue();
    expect(membersLink).not.toBeNull();

    // Cambiar a la empresa donde es colaborador.
    component.selectCompany(7);

    fixture.detectChanges();

    membersLink = fixture.nativeElement.querySelector(
      'a[routerLink="/user/members"]'
    );

    expect(companyContext.selectedRole())
      .toBe(CompanyRole.COLLABORATOR);

    expect(component.canManageMembers).toBeFalse();
    expect(membersLink).toBeNull();

    // Regresar a la empresa donde es administrador.
    component.selectCompany(3);

    fixture.detectChanges();

    membersLink = fixture.nativeElement.querySelector(
      'a[routerLink="/user/members"]'
    );

    expect(component.canManageMembers).toBeTrue();
    expect(membersLink).not.toBeNull();
  });

  it('should hide members navigation for non-admin company roles', () => {
    const restrictedRoles = [
      CompanyRole.ASG_MANAGER,
      CompanyRole.COLLABORATOR,
      CompanyRole.AUDITOR
    ];

    component.first = null;

    for (const role of restrictedRoles) {
      companyContext.memberships.set([
        {
          membership_id: 10,
          company_id: 3,
          company_name: 'Empresa A',
          role,
          joined_at: '2026-11-09T10:00:00'
        }
      ]);

      companyContext.selectedCompanyId.set(3);

      fixture.detectChanges();

      const membersLink: HTMLAnchorElement | null =
        fixture.nativeElement.querySelector(
          'a[href="/user/members"]'
        );

      expect(companyContext.selectedRole()).toBe(role);
      expect(component.canManageMembers).toBeFalse();
      expect(membersLink).toBeNull();
    }
  });

});
