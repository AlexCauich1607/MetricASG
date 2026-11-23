
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { UserNavbarComponent } from './user-navbar.component';
import { NotificationService } from '../../../services/notification.service';
import { ReevaluationNotification } from '../../../models/notification';
import { CompanyContextService } from '../../../services/company-context.service';

import { MatDialog } from '@angular/material/dialog';
import { CreateCompanyComponent } from '../../modals/create-company/create-company.component';

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
  let dialog: jasmine.SpyObj<MatDialog>;
  let dialogClosed$: Subject<any>;

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
    dialogClosed$ = new Subject<any>();

    dialog = jasmine.createSpyObj<MatDialog>(
      'MatDialog',
      ['open']
    );

    dialog.open.and.returnValue({
      afterClosed: () => dialogClosed$.asObservable()
    } as any);

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
        },
        {
          provide: MatDialog,
          useValue: dialog
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


  it('should keep company management navigation available when switching company roles', () => {
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

    const getManagementLink = (): HTMLAnchorElement | null =>
      fixture.nativeElement.querySelector(
        'a[routerLink="/user/company-settings"]'
      );

    // El administrador puede acceder a Gestión empresarial.
    expect(component.canManageMembers).toBeTrue();
    expect(getManagementLink()).not.toBeNull();

    // Cambiar a la empresa donde es colaborador.
    component.selectCompany(7);

    fixture.detectChanges();

    expect(companyContext.selectedRole())
      .toBe(CompanyRole.COLLABORATOR);

    // Pierde permisos administrativos, pero conserva acceso de lectura.
    expect(component.canManageMembers).toBeFalse();
    expect(getManagementLink()).not.toBeNull();

    // Regresar a la empresa donde es administrador.
    component.selectCompany(3);

    fixture.detectChanges();

    expect(component.canManageMembers).toBeTrue();
    expect(getManagementLink()).not.toBeNull();
  });

  it('should hide members navigation for non-admin company roles', () => {
    const restrictedRoles = [
      CompanyRole.ASG_MANAGER,
      CompanyRole.COLLABORATOR,
      CompanyRole.AUDITOR
    ];


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

  describe('HU-050 T02 - Accesibilidad del menú móvil', () => {
    it('should expose accessible attributes on the navbar toggler', () => {
      fixture.detectChanges();

      const toggler: HTMLButtonElement =
        fixture.nativeElement.querySelector('.navbar-toggler');

      const menu: HTMLElement =
        fixture.nativeElement.querySelector('#mainNavbar');

      expect(toggler).not.toBeNull();
      expect(menu).not.toBeNull();

      expect(toggler.getAttribute('aria-controls'))
        .toBe('mainNavbar');

      expect(toggler.getAttribute('aria-expanded'))
        .toBe('false');

      expect(toggler.getAttribute('aria-label'))
        .toBe('Abrir o cerrar menú de navegación');
    });

    it('should close an open menu on Escape and restore focus', () => {
      fixture.detectChanges();

      const toggler: HTMLButtonElement =
        fixture.nativeElement.querySelector('.navbar-toggler');

      const menu: HTMLElement =
        fixture.nativeElement.querySelector('#mainNavbar');

      // Simular el estado abierto sin depender de Bootstrap global.
      menu.classList.add('show');
      toggler.setAttribute('aria-expanded', 'true');

      const clickSpy = spyOn(toggler, 'click').and.callFake(() => {
        menu.classList.remove('show');
        toggler.setAttribute('aria-expanded', 'false');
      });

      component.onEscape();

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(menu.classList.contains('show')).toBeFalse();
      expect(toggler.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggler);
    });

    it('should not toggle the menu on Escape when it is closed', () => {
      fixture.detectChanges();

      const toggler: HTMLButtonElement =
        fixture.nativeElement.querySelector('.navbar-toggler');

      const clickSpy = spyOn(toggler, 'click');

      component.onEscape();

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('HU-054 T06 - Creación empresarial', () => {

    it('should display the create company button without memberships', () => {
      fixture.detectChanges();

      const button: HTMLButtonElement | null =
        fixture.nativeElement.querySelector(
          'button[aria-label="Crear una nueva empresa"]'
        );

      expect(companyContext.memberships()).toEqual([]);
      expect(button).not.toBeNull();
      expect(button?.disabled).toBeFalse();
    });

    it('should open the company creation dialog', () => {
      fixture.detectChanges();

      const button: HTMLButtonElement =
        fixture.nativeElement.querySelector(
          'button[aria-label="Crear una nueva empresa"]'
        );

      button.click();

      expect(dialog.open).toHaveBeenCalledOnceWith(
        CreateCompanyComponent,
        jasmine.objectContaining({
          width: '520px',
          disableClose: true
        })
      );
    });

    it('should refresh memberships and select the created company', () => {
      fixture.detectChanges();

      component.openCreateCompany();

      dialogClosed$.next({
        id: 25,
        name: 'Empresa Nueva',
        sector_id: null,
        size_id: null,
        active: true
      });

      dialogClosed$.complete();

      expect(companyContext.loadMemberships)
        .toHaveBeenCalledWith(25);
    });

    it('should not refresh memberships when creation is cancelled', () => {
      fixture.detectChanges();

      companyContext.loadMemberships.calls.reset();

      component.openCreateCompany();

      dialogClosed$.next(null);
      dialogClosed$.complete();

      expect(companyContext.loadMemberships)
        .not.toHaveBeenCalled();
    });

    it('should prevent opening the dialog during an evaluation', () => {
      const router = TestBed.inject(Router);

      spyOnProperty(router, 'url', 'get').and.returnValue(
        '/user/evaluation'
      );

      fixture.detectChanges();

      const button: HTMLButtonElement =
        fixture.nativeElement.querySelector(
          'button[aria-label="Crear una nueva empresa"]'
        );

      expect(button.disabled).toBeTrue();

      component.openCreateCompany();

      expect(dialog.open).not.toHaveBeenCalled();
    });

  });

});
