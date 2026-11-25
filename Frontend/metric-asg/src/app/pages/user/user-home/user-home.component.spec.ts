
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';

import {
  CompanyRole,
  UserCompanyMembership
} from '../../../models/company_membership';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { UserHomeComponent } from './user-home.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { CompanyContextService } from '../../../services/company-context.service';
import { UserService } from '../../../services/user.service';
import { ResultEvaluation } from '../../../models/evaluation_result';

import { CompanyInvitationService } from '../../../services/company-invitation.service';
import { CompanyMembershipService } from
  '../../../services/company-membership.service';

import { CompanyDetailResponse } from
  '../../../models/company_membership';

import { Router } from '@angular/router';

describe('UserHomeComponent', () => {
  function selectCompanyWithRole(role: CompanyRole): void {
    memberships.set([
      {
        membership_id: 1,
        company_id: 3,
        company_name: 'Empresa A',
        role,
        joined_at: '2026-11-23T12:00:00'
      }
    ]);

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();
  }
  function prepareCompanyMemberships(): void {
    memberships.set([
      {
        membership_id: 1,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-23T12:00:00'
      },
      {
        membership_id: 2,
        company_id: 7,
        company_name: 'Empresa B',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-23T12:00:00'
      }
    ]);
  }
  let component: UserHomeComponent;
  let fixture: ComponentFixture<UserHomeComponent>;

  let evaluationService: jasmine.SpyObj<EvaluationService>;
  let userService: jasmine.SpyObj<UserService>;
  let invitationService: jasmine.SpyObj<CompanyInvitationService>;
  let companyContext: CompanyContextService;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;
  let memberships: ReturnType<
    typeof signal<UserCompanyMembership[]>
  >;
  let companyMembershipService:
    jasmine.SpyObj<CompanyMembershipService>;
  const companyAResults: ResultEvaluation = {
    evaluation_id: 10,
    date: '2026-09-15T12:00:00',
    global_score: 8,
    global_maturity_level: 'Intermedio',
    global_maturity_color: '#eac84f',
    ambits: [
      {
        ambit_id: 1,
        ambit_name: 'Ambiental',
        score: 8.5,
        letter: 'A',
        color: '#00AA00',
        maturity_level: 'Avanzado',
        maturity_color: '#15b91d',
        feedback: ''
      }
    ]
  };

  const companyBResults: ResultEvaluation = {
    evaluation_id: 20,
    date: '2026-10-20T12:00:00',
    global_score: 7,
    global_maturity_level: 'Intermedio',
    global_maturity_color: '#c28c20',
    ambits: [
      {
        ambit_id: 2,
        ambit_name: 'Social',
        score: 7.5,
        letter: 'S',
        color: '#0000AA',
        maturity_level: 'Intermedio',
        maturity_color: '#eac84f',
        feedback: ''
      }
    ]
  };

  beforeEach(async () => {
    selectedCompanyId = signal<number | null>(null);
    memberships = signal<UserCompanyMembership[]>([]);

    evaluationService = jasmine.createSpyObj<EvaluationService>(
      'EvaluationService',
      ['getLastEvaluationResult']
    );

    evaluationService.getLastEvaluationResult.and.returnValue(
      of(companyAResults)
    );

    userService = jasmine.createSpyObj<UserService>(
      'UserService',
      ['getMe']
    );
    invitationService = jasmine.createSpyObj<CompanyInvitationService>(
      'CompanyInvitationService',
      ['acceptInvitation']
    );
    companyMembershipService =
      jasmine.createSpyObj<CompanyMembershipService>(
        'CompanyMembershipService',
        ['getCompany']
      );

    companyMembershipService.getCompany.and.callFake(
      (companyId: number) => of({
        id: companyId,
        name: `Empresa ${companyId}`,
        sector_id: 1,
        size_id: 1,
        active: true,
        biannual_evaluation: false,
        next_evaluation: null
      } as CompanyDetailResponse)
    );
    await TestBed.configureTestingModule({
      imports: [UserHomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: EvaluationService,
          useValue: evaluationService
        },
        {
          provide: UserService,
          useValue: userService
        },
        {
          provide: CompanyInvitationService,
          useValue: invitationService
        },
        {
          provide: CompanyContextService,
          useValue: {
            selectedCompanyId,
            memberships,
            loading: signal(false),
            error: signal(false),

            selectedMembership: computed(() =>
              memberships().find(
                membership =>
                  membership.company_id === selectedCompanyId()
              ) ?? null
            ),

            refreshMemberships: jasmine.createSpy('refreshMemberships')
          }
        },
        {
          provide: CompanyMembershipService,
          useValue: companyMembershipService
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserHomeComponent);
    component = fixture.componentInstance;
    companyContext = TestBed.inject(CompanyContextService);
    // Evitar que la carga del perfil interfiera con estas pruebas.
    spyOn(component, 'loadUser');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not request results without a selected company', async () => {
    await fixture.whenStable();

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();

    expect(component.results).toBeNull();
  });



  it('should reload results and chart data when switching companies', () => {
    prepareCompanyMemberships();
    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      of(companyBResults)
    );

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toEqual(companyAResults);
    expect(component.ambits).toEqual(['Ambiental']);
    expect(component.scores).toEqual([8.5]);

    selectedCompanyId.set(7);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toEqual(companyBResults);
    expect(component.ambits).toEqual(['Social']);
    expect(component.scores).toEqual([7.5]);

    expect(
      evaluationService.getLastEvaluationResult
    ).toHaveBeenCalledTimes(2);
  });



  it('should clear previous results while loading another company', () => {
    prepareCompanyMemberships();
    const pendingResults = new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      pendingResults.asObservable()
    );

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toEqual(companyAResults);

    selectedCompanyId.set(7);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toBeNull();
    expect(component.ambits).toEqual([]);
    expect(component.scores).toEqual([]);
    expect(component.loadingChart).toBeFalse();
    expect(component.resultsStatus).toBe('loading');

    pendingResults.next(companyBResults);
    fixture.detectChanges();

    expect(component.results).toEqual(companyBResults);
    expect(component.resultsStatus).toBe('success');

    pendingResults.complete();
  });


  it('should show loading while results are pending', async () => {
    prepareCompanyMemberships();
    const pendingResults = new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult.and.returnValue(
      pendingResults.asObservable()
    );

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('loading');
    expect(component.results).toBeNull();

    const state = fixture.nativeElement.querySelector(
      '.asg-state--loading'
    );

    expect(state).not.toBeNull();

    pendingResults.complete();
  });

  it('should show empty when no completed evaluations exist', async () => {
    prepareCompanyMemberships();
    evaluationService.getLastEvaluationResult.and.returnValue(
      throwError(() => ({
        status: 404,
        error: { detail: 'No evaluations found' }
      }))
    );

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('empty');
    expect(component.results).toBeNull();

    const emptyState: HTMLElement =
      fixture.nativeElement.querySelector('.dashboard-empty');

    expect(emptyState).not.toBeNull();

    expect(emptyState.textContent)
      .toContain('Aún no hay resultados empresariales');

    expect(emptyState.textContent)
      .toContain('Primera evaluación pendiente');

    expect(
      emptyState.querySelectorAll('.dashboard-empty__benefit').length
    ).toBe(3);

    expect(
      emptyState.querySelector('.dashboard-period__action')
    ).not.toBeNull();

    expect(
      fixture.nativeElement.querySelector('.dashboard-performance')
    ).toBeNull();

    expect(
      fixture.nativeElement.querySelector('.asg-state--error')
    ).toBeNull();
  });

  it('should show error for service failures', async () => {
    prepareCompanyMemberships();
    evaluationService.getLastEvaluationResult.and.returnValue(
      throwError(() => ({
        status: 500,
        error: { detail: 'Internal Server Error' }
      }))
    );

    spyOn(console, 'error');

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('error');
    expect(component.results).toBeNull();

    expect(
      fixture.nativeElement.querySelector('.asg-state--error')
    ).not.toBeNull();
  });

  it('should not treat unrelated 404 errors as empty', async () => {
    prepareCompanyMemberships();
    evaluationService.getLastEvaluationResult.and.returnValue(
      throwError(() => ({
        status: 404,
        error: { detail: 'Company not found' }
      }))
    );

    spyOn(console, 'error');

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('error');
  });
  it('should retry membership synchronization without resending the invitation', () => {
    const acceptedMembership = {
      membership_id: 25,
      company_id: 15,
      company_name: 'Empresa Invitada',
      role: 'COLLABORATOR',
      joined_at: '2026-11-23T12:00:00'
    };

    const contextMock = companyContext as unknown as {
      selectedCompanyId: ReturnType<typeof signal<number | null>>;
      memberships: ReturnType<typeof signal<any[]>>;
      error: ReturnType<typeof signal<boolean>>;
      refreshMemberships: jasmine.Spy;
    };

    invitationService.acceptInvitation.and.returnValue(of({}));

    contextMock.refreshMemberships.and.callFake(() => {
      if (contextMock.refreshMemberships.calls.count() === 1) {
        contextMock.error.set(true);
        return of([]);
      }

      contextMock.error.set(false);
      contextMock.memberships.set([acceptedMembership]);
      contextMock.selectedCompanyId.set(15);

      return of([acceptedMembership]);
    });

    component.invitationToken = 'token-de-prueba';
    component.acceptInvitation();

    expect(invitationService.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(contextMock.refreshMemberships).toHaveBeenCalledTimes(1);
    expect(component.invitationAcceptedPendingSync).toBeTrue();
    expect(component.invitationError).toContain('actualizar tus empresas');

    component.syncAcceptedInvitation();

    expect(invitationService.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(contextMock.refreshMemberships).toHaveBeenCalledTimes(2);
    expect(component.invitationAcceptedPendingSync).toBeFalse();
    expect(component.invitationSuccess).toBeTrue();
    expect(contextMock.selectedCompanyId()).toBe(15);
  });
  it('should display a personal welcome without a selected company', () => {
    selectedCompanyId.set(null);

    TestBed.tick();
    fixture.detectChanges();

    const welcome = fixture.nativeElement.querySelector(
      '.dashboard-welcome__title'
    );

    const companyHeader = fixture.nativeElement.querySelector(
      '.dashboard-company'
    );

    expect(welcome.textContent).toContain('Bienvenido');
    expect(companyHeader).toBeNull();
  });


  it('should display the selected company name', () => {
    memberships.set([
      {
        membership_id: 1,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-23T12:00:00'
      }
    ]);

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    const companyTitle = fixture.nativeElement.querySelector(
      '.dashboard-company__title'
    );

    expect(companyTitle.textContent.trim()).toBe('Empresa A');
  });


  it('should update the company header when switching companies', () => {
    memberships.set([
      {
        membership_id: 1,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-23T12:00:00'
      },
      {
        membership_id: 2,
        company_id: 7,
        company_name: 'Empresa B',
        role: CompanyRole.COLLABORATOR,
        joined_at: '2026-11-23T12:00:00'
      }
    ]);

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-company__title'
      ).textContent.trim()
    ).toBe('Empresa A');

    selectedCompanyId.set(7);

    TestBed.tick();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-company__title'
      ).textContent.trim()
    ).toBe('Empresa B');
  });
  [
    {
      role: CompanyRole.COMPANY_ADMIN,
      allowed: true,
      label: 'Realizar autodiagnóstico'
    },
    {
      role: CompanyRole.ASG_MANAGER,
      allowed: true,
      label: 'Realizar autodiagnóstico'
    },
    {
      role: CompanyRole.COLLABORATOR,
      allowed: true,
      label: 'Trabajar en borrador'
    },
    {
      role: CompanyRole.AUDITOR,
      allowed: false,
      label: 'Acceso de solo lectura'
    }
  ].forEach(({ role, allowed, label }) => {

    it(`should configure evaluation access for ${role}`, () => {
      selectCompanyWithRole(role);

      expect(component.canStartEvaluation).toBe(allowed);
      expect(component.evaluationActionLabel).toBe(label);

      const button: HTMLButtonElement =
        fixture.nativeElement.querySelector(
          '.dashboard-period__action'
        );

      expect(button.disabled).toBe(!allowed);
      expect(button.textContent).toContain(label);
    });

  });

  it('should block evaluation without a valid membership', () => {
    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.canStartEvaluation).toBeFalse();
  });

  it('should block evaluation for an inactive company', () => {
    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    component.company = {
      ...component.company!,
      active: false
    };

    fixture.detectChanges();

    expect(component.canStartEvaluation).toBeFalse();
  });

  it('should block evaluation before the scheduled date', () => {
    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    component.company = {
      ...component.company!,
      biannual_evaluation: true,
      next_evaluation: '2099-01-01'
    };

    fixture.detectChanges();

    expect(component.canStartEvaluation).toBeFalse();

    expect(
      component.evaluationUnavailableReason
    ).toContain('aún no está disponible');
  });

  it('should allow evaluation after the scheduled date', () => {
    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    component.company = {
      ...component.company!,
      biannual_evaluation: true,
      next_evaluation: '2000-01-01'
    };

    fixture.detectChanges();

    expect(component.canStartEvaluation).toBeTrue();
  });

  it('should block evaluation when company context does not match', () => {
    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    component.company = {
      ...component.company!,
      id: 99
    };

    fixture.detectChanges();

    expect(component.canStartEvaluation).toBeFalse();
  });

  it('should prevent auditors from navigating to evaluation', () => {
    selectCompanyWithRole(CompanyRole.AUDITOR);

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');

    component.goEvaluation();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('should allow collaborators to navigate to their draft', () => {
    selectCompanyWithRole(CompanyRole.COLLABORATOR);

    const router = TestBed.inject(Router);

    const navigate = spyOn(router, 'navigate')
      .and.resolveTo(true);

    component.goEvaluation();

    expect(navigate).toHaveBeenCalledWith([
      '/user/evaluation'
    ]);
  });

  it('should navigate to results for authorized members', () => {
    selectCompanyWithRole(CompanyRole.AUDITOR);

    const router = TestBed.inject(Router);

    const navigate = spyOn(router, 'navigate')
      .and.resolveTo(true);

    component.goToResults();

    expect(navigate).toHaveBeenCalledWith([
      '/user/results'
    ]);
  });

  it('should render the global and ambit dashboard cards', () => {
    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    const cards = fixture.nativeElement.querySelectorAll(
      '.dashboard-kpi'
    );

    expect(cards.length).toBe(2);

    expect(cards[0].textContent).toContain('Nivel ASG global');
    expect(cards[0].textContent).toContain('8.0');

    expect(cards[1].textContent).toContain('Ambiental');
    expect(cards[1].textContent).toContain('8.5');
  });
  it('should highlight only the global ASG card', () => {
    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    const featuredCards =
      fixture.nativeElement.querySelectorAll(
        '.dashboard-kpi--featured'
      );

    expect(featuredCards.length).toBe(1);

    expect(featuredCards[0].textContent)
      .toContain('Nivel ASG global');
  });

  it('should navigate to results from the featured card', () => {
    selectCompanyWithRole(CompanyRole.AUDITOR);

    const router = TestBed.inject(Router);

    const navigate = spyOn(router, 'navigate')
      .and.resolveTo(true);

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.dashboard-global-action'
      );

    expect(button).not.toBeNull();

    button.click();

    expect(navigate).toHaveBeenCalledWith([
      '/user/results'
    ]);
  });
  it('should render maturity colors received from the evaluation', () => {
    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    const globalLevel: HTMLElement =
      fixture.nativeElement.querySelector(
        '.dashboard-global-card .dashboard-kpi__level'
      );

    const ambitLevel: HTMLElement =
      fixture.nativeElement.querySelector(
        '.dashboard-performance__grid app-ambit-card:not(.dashboard-global-card) .dashboard-kpi__level'
      );

    expect(globalLevel).not.toBeNull();
    expect(ambitLevel).not.toBeNull();

    expect(
      globalLevel.style.getPropertyValue('--maturity-color').trim()
    ).toBe('#eac84f');

    expect(
      ambitLevel.style.getPropertyValue('--maturity-color').trim()
    ).toBe('#15b91d');
  });
  it('should update the global maturity color when switching companies', () => {
    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      of(companyBResults)
    );

    memberships.set([
      {
        membership_id: 1,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-23T12:00:00'
      },
      {
        membership_id: 2,
        company_id: 7,
        company_name: 'Empresa B',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-23T12:00:00'
      }
    ]);

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    const getGlobalLevel = (): HTMLElement =>
      fixture.nativeElement.querySelector(
        '.dashboard-global-card .dashboard-kpi__level'
      );

    expect(
      getGlobalLevel().style.getPropertyValue('--maturity-color').trim()
    ).toBe('#eac84f');

    selectedCompanyId.set(7);

    TestBed.tick();
    fixture.detectChanges();

    expect(
      getGlobalLevel().style.getPropertyValue('--maturity-color').trim()
    ).toBe('#c28c20');

    expect(component.results?.evaluation_id)
      .toBe(20);
  });
  it('should support results without a global maturity color', () => {
    evaluationService.getLastEvaluationResult.and.returnValue(
      of({
        ...companyAResults,
        global_maturity_color: undefined
      })
    );

    selectCompanyWithRole(CompanyRole.COMPANY_ADMIN);

    const globalLevel: HTMLElement =
      fixture.nativeElement.querySelector(
        '.dashboard-global-card .dashboard-kpi__level'
      );

    expect(globalLevel).not.toBeNull();

    expect(globalLevel.textContent?.trim())
      .toBe('Intermedio');

    expect(
      globalLevel.style.getPropertyValue('--maturity-color').trim()
    ).toBe('');
  });
  it('should display both onboarding options without a company', () => {
    selectedCompanyId.set(null);

    TestBed.tick();
    fixture.detectChanges();

    const onboarding: HTMLElement =
      fixture.nativeElement.querySelector('.company-onboarding');

    expect(onboarding).not.toBeNull();

    expect(
      onboarding.querySelectorAll('.company-onboarding__card').length
    ).toBe(2);

    expect(onboarding.textContent)
      .toContain('Configura tu primera empresa');

    expect(onboarding.textContent)
      .toContain('Crear una empresa');

    expect(onboarding.textContent)
      .toContain('Aceptar una invitación');

    expect(
      fixture.nativeElement.querySelector('.dashboard-empty')
    ).toBeNull();

    expect(
      fixture.nativeElement.querySelector('.dashboard-performance')
    ).toBeNull();
  });
  it('should disable invitation submission when the token is empty', () => {
    selectedCompanyId.set(null);
    component.invitationToken = '';

    TestBed.tick();
    fixture.detectChanges();

    const submitButton: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.company-onboarding__invitation button[type="submit"]'
      );

    expect(submitButton).not.toBeNull();
    expect(submitButton.disabled).toBeTrue();

    component.invitationToken = '   ';

    fixture.detectChanges();

    expect(submitButton.disabled).toBeTrue();
  });
  it('should enable invitation submission when a token is provided', () => {
    selectedCompanyId.set(null);

    TestBed.tick();
    fixture.detectChanges();

    const tokenInput: HTMLInputElement =
      fixture.nativeElement.querySelector('#invitation-token');

    const submitButton: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.company-onboarding__invitation button[type="submit"]'
      );

    expect(tokenInput).not.toBeNull();
    expect(submitButton).not.toBeNull();

    tokenInput.value = 'example-invitation-token';

    tokenInput.dispatchEvent(new Event('input'));

    fixture.detectChanges();

    expect(component.invitationToken)
      .toBe('example-invitation-token');

    expect(submitButton.disabled).toBeFalse();
  });
  it('should prioritize context loading over other dashboard states', () => {
    prepareCompanyMemberships();

    companyContext.loading.set(true);
    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(component.dashboardStatus)
      .toBe('context-loading');

    expect(
      element.querySelector('.dashboard-skeleton-context')
    ).not.toBeNull();

    expect(
      element.querySelector('.dashboard-skeleton-card')
    ).toBeNull();

    expect(
      element.querySelector('.company-onboarding')
    ).toBeNull();

    expect(
      element.querySelector('.dashboard-empty')
    ).toBeNull();

    expect(
      element.querySelector('.dashboard-performance')
    ).toBeNull();

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();

    expect(
      companyMembershipService.getCompany
    ).not.toHaveBeenCalled();
  });
  it('should recover from a membership error through the retry action', () => {
    prepareCompanyMemberships();

    selectedCompanyId.set(3);
    companyContext.error.set(true);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.dashboardStatus)
      .toBe('context-error');

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();

    const refreshMemberships =
      companyContext.refreshMemberships as jasmine.Spy;

    refreshMemberships.and.callFake(() => {
      companyContext.error.set(false);

      return of(memberships());
    });

    const retryButton: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.dashboard-error__actions button'
      );

    expect(retryButton).not.toBeNull();

    retryButton.click();

    TestBed.tick();
    fixture.detectChanges();

    expect(refreshMemberships)
      .toHaveBeenCalledTimes(1);

    expect(component.dashboardStatus)
      .toBe('success');

    expect(component.results)
      .toEqual(companyAResults);

    expect(
      fixture.nativeElement.querySelector(
        '.asg-state--error'
      )
    ).toBeNull();
  });
  it('should request a company selection when memberships exist', () => {
    prepareCompanyMemberships();

    selectedCompanyId.set(null);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.dashboardStatus)
      .toBe('no-selection');

    expect(
      fixture.nativeElement.textContent
    ).toContain('Selecciona una empresa');

    expect(
      fixture.nativeElement.querySelector(
        '.company-onboarding'
      )
    ).toBeNull();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-empty'
      )
    ).toBeNull();

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();
  });
  it('should not request company data for an invalid membership', () => {
    prepareCompanyMemberships();

    selectedCompanyId.set(99);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.dashboardStatus)
      .toBe('no-selection');

    expect(component.hasCurrentResults)
      .toBeFalse();

    expect(component.canStartEvaluation)
      .toBeFalse();

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();

    expect(
      companyMembershipService.getCompany
    ).not.toHaveBeenCalled();
  });
  it('should retry failed results without reloading company details', () => {
    prepareCompanyMemberships();

    spyOn(console, 'error');

    const pendingResults =
      new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        throwError(() => ({
          status: 500,
          error: {
            detail: 'Internal Server Error'
          }
        })),
        pendingResults.asObservable()
      );

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.dashboardStatus)
      .toBe('error');

    const retryButton: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.dashboard-error__actions button'
      );

    expect(retryButton).not.toBeNull();

    retryButton.click();

    // Un segundo intento durante la carga no debe
    // generar otra solicitud.
    component.retryResults();

    TestBed.tick();
    fixture.detectChanges();

    expect(component.dashboardStatus)
      .toBe('loading');

    expect(
      fixture.nativeElement.querySelector(
        'app-dashboard-skeleton'
      )
    ).not.toBeNull();

    expect(
      evaluationService.getLastEvaluationResult
    ).toHaveBeenCalledTimes(2);

    expect(
      companyMembershipService.getCompany
    ).toHaveBeenCalledTimes(1);

    pendingResults.next(companyAResults);
    pendingResults.complete();

    fixture.detectChanges();

    expect(component.dashboardStatus)
      .toBe('success');

    expect(component.results)
      .toEqual(companyAResults);

    expect(component.scores)
      .toEqual([8.5]);

    expect(
      fixture.nativeElement.querySelector(
        'app-dashboard-skeleton'
      )
    ).toBeNull();
  });
  it('should discard stale results when switching companies', () => {
    prepareCompanyMemberships();

    const pendingA =
      new Subject<ResultEvaluation>();

    const pendingB =
      new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        pendingA.asObservable(),
        pendingB.asObservable()
      );

    selectedCompanyId.set(3);

    TestBed.tick();

    pendingA.next(companyAResults);

    fixture.detectChanges();

    expect(component.hasCurrentResults)
      .toBeTrue();

    selectedCompanyId.set(7);

    // La selección cambió, aunque toObservable todavía
    // no haya procesado la nueva solicitud.
    expect(component.hasCurrentResults)
      .toBeFalse();

    expect(component.dashboardStatus)
      .toBe('loading');

    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');

    component.goToResults();

    expect(navigate).not.toHaveBeenCalled();

    pendingA.next({
      ...companyAResults,
      global_score: 9.9
    });

    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toBeNull();

    expect(component.scores).toEqual([]);

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-company__period'
      )
    ).toBeNull();

    expect(
      fixture.nativeElement.querySelector(
        '.dashboard-performance'
      )
    ).toBeNull();

    pendingB.next(companyBResults);

    // Simular una respuesta tardía de la empresa anterior.
    pendingA.next(companyAResults);

    fixture.detectChanges();

    expect(component.results)
      .toEqual(companyBResults);

    expect(component.ambits)
      .toEqual(['Social']);

    expect(component.scores)
      .toEqual([7.5]);

    expect(component.hasCurrentResults)
      .toBeTrue();

    pendingA.complete();
    pendingB.complete();
  });
  it('should discard stale company details after switching companies', () => {
    prepareCompanyMemberships();

    const pendingA =
      new Subject<CompanyDetailResponse>();

    const pendingB =
      new Subject<CompanyDetailResponse>();

    const companyA = {
      id: 3,
      name: 'Empresa A',
      sector_id: 1,
      size_id: 1,
      active: true,
      biannual_evaluation: true,
      next_evaluation: '2099-01-15T12:00:00'
    } as CompanyDetailResponse;

    const companyB = {
      ...companyA,
      id: 7,
      name: 'Empresa B',
      biannual_evaluation: false,
      next_evaluation: '2099-02-20T12:00:00'
    } as CompanyDetailResponse;

    companyMembershipService.getCompany
      .and.returnValues(
        pendingA.asObservable(),
        pendingB.asObservable()
      );

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        of(companyAResults),
        of(companyBResults)
      );

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.isCompanyLoading)
      .toBeTrue();

    selectedCompanyId.set(7);

    pendingA.next(companyA);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.company).toBeNull();

    expect(component.evaluationDate).toBe('');

    expect(component.canStartEvaluation)
      .toBeFalse();

    pendingB.next(companyB);

    pendingA.next(companyA);

    fixture.detectChanges();

    expect(component.company?.id)
      .toBe(7);

    expect(component.evaluationDate)
      .toBe('20/02/2099');

    expect(component.isCompanyLoading)
      .toBeFalse();

    expect(component.canStartEvaluation)
      .toBeTrue();

    pendingA.complete();
    pendingB.complete();
  });
  it('should recreate the chart when switching evaluation results', () => {
    prepareCompanyMemberships();

    evaluationService.getLastEvaluationResult
      .and.returnValues(
        of(companyAResults),
        of(companyBResults)
      );

    selectedCompanyId.set(3);

    TestBed.tick();
    fixture.detectChanges();

    const chartA = fixture.nativeElement.querySelector(
      'app-bar-chart'
    );

    expect(chartA).not.toBeNull();

    selectedCompanyId.set(7);

    TestBed.tick();
    fixture.detectChanges();

    const chartB = fixture.nativeElement.querySelector(
      'app-bar-chart'
    );

    expect(chartB).not.toBeNull();

    expect(chartB).not.toBe(chartA);

    expect(component.ambits)
      .toEqual(['Social']);

    expect(component.scores)
      .toEqual([7.5]);
  });
  [
    {
      description: 'with completed evaluations',
      hasResults: true,
      expectedStatus: 'success',
      container: '.dashboard-schedule__footer'
    },
    {
      description: 'without completed evaluations',
      hasResults: false,
      expectedStatus: 'empty',
      container: '.dashboard-empty__actions'
    }
  ].forEach((scenario) => {

    it(`should recover company details ${scenario.description}`, () => {
      prepareCompanyMemberships();

      spyOn(console, 'error');

      evaluationService.getLastEvaluationResult
        .and.returnValue(
          scenario.hasResults
            ? of(companyAResults)
            : throwError(() => ({
              status: 404,
              error: {
                detail: 'No evaluations found'
              }
            }))
        );

      const pendingCompany =
        new Subject<CompanyDetailResponse>();

      companyMembershipService.getCompany
        .and.returnValues(
          throwError(() => ({
            status: 500
          })),
          pendingCompany.asObservable()
        );

      selectedCompanyId.set(3);

      TestBed.tick();
      fixture.detectChanges();

      expect(component.dashboardStatus)
        .toBe(scenario.expectedStatus);

      expect(component.hasCompanyError)
        .toBeTrue();

      expect(component.canStartEvaluation)
        .toBeFalse();

      const actionButton: HTMLButtonElement =
        fixture.nativeElement.querySelector(
          `${scenario.container} .dashboard-period__action`
        );

      expect(actionButton).not.toBeNull();

      expect(actionButton.disabled)
        .toBeTrue();

      const retryButton: HTMLButtonElement =
        fixture.nativeElement.querySelector(
          `${scenario.container} .asg-btn--secondary`
        );

      expect(retryButton).not.toBeNull();

      retryButton.click();

      // Evitar solicitudes duplicadas.
      component.retryCompanyDetails();

      TestBed.tick();
      fixture.detectChanges();

      expect(component.isCompanyLoading)
        .toBeTrue();

      expect(component.dashboardStatus)
        .toBe(scenario.expectedStatus);

      expect(
        companyMembershipService.getCompany
      ).toHaveBeenCalledTimes(2);

      expect(
        evaluationService.getLastEvaluationResult
      ).toHaveBeenCalledTimes(1);

      pendingCompany.next({
        id: 3,
        name: 'Empresa A',
        sector_id: 1,
        size_id: 1,
        active: true,
        biannual_evaluation: false,
        next_evaluation: null
      } as CompanyDetailResponse);

      pendingCompany.complete();

      fixture.detectChanges();

      expect(component.hasCompanyError)
        .toBeFalse();

      expect(component.isCompanyLoading)
        .toBeFalse();

      expect(component.canStartEvaluation)
        .toBeTrue();

      expect(component.dashboardStatus)
        .toBe(scenario.expectedStatus);

      expect(component.results)
        .toEqual(
          scenario.hasResults
            ? companyAResults
            : null
        );

      expect(
        fixture.nativeElement.querySelector(
          `${scenario.container} .asg-btn--secondary`
        )
      ).toBeNull();

    });

  });
});
